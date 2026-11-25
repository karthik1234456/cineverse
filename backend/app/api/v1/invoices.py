# backend/app/api/v1/invoices.py
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.auth import User, RoleEnum
from app.models.booking import Booking, BookingStatusEnum
from app.models.tax import Invoice, InvoiceItem
from app.services.auth_service import require_user
from app.services.tax_invoice_service import TaxInvoiceService

router = APIRouter()


@router.get("/bookings/{booking_id}/invoices")
async def get_booking_invoices(
    booking_id: int,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieves all tax invoices and credit notes for a booking.
    Generates invoices if the booking is confirmed and invoices are not yet generated.
    Enforces that only the booking owner or an admin can access.
    """
    stmt = (
        select(Booking)
        .where(Booking.id == booking_id)
    )
    res = await db.execute(stmt)
    booking = res.scalars().first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Access control: only owner or admin
    if booking.user_id != user.id and user.role not in [RoleEnum.ADMIN, "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You can only view invoices for your own bookings"
        )

    # If confirmed and no invoices exist, generate them
    if booking.status in [BookingStatusEnum.CONFIRMED, "CONFIRMED", BookingStatusEnum.CANCELLED, "CANCELLED"]:
        await TaxInvoiceService.generate_invoice_for_booking(db, booking.id)

    # Fetch all invoices for booking
    inv_stmt = (
        select(Invoice)
        .options(
            selectinload(Invoice.items),
            selectinload(Invoice.issuer_entity)
        )
        .where(Invoice.booking_id == booking_id)
        .order_by(Invoice.id.asc())
    )
    inv_res = await db.execute(inv_stmt)
    invoices = inv_res.scalars().all()

    output = []
    for inv in invoices:
        items_out = []
        for it in inv.items:
            items_out.append({
                "id": it.id,
                "item_type": it.item_type,
                "description": it.description,
                "sac_hsn_code": it.sac_hsn_code,
                "quantity": it.quantity,
                "taxable_amount_paise": it.taxable_amount_paise,
                "taxable_amount_rupees": it.taxable_amount_paise / 100.0,
                "tax_rate_percent": it.tax_rate_percent,
                "cgst_rate": it.cgst_rate,
                "cgst_paise": it.cgst_paise,
                "sgst_rate": it.sgst_rate,
                "sgst_paise": it.sgst_paise,
                "igst_rate": it.igst_rate,
                "igst_paise": it.igst_paise,
                "total_item_paise": it.total_item_paise,
                "total_item_rupees": it.total_item_paise / 100.0,
            })

        output.append({
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "invoice_type": inv.invoice_type,
            "financial_year": inv.financial_year,
            "booking_id": inv.booking_id,
            "original_invoice_id": inv.original_invoice_id,
            "issuer_type": inv.issuer_type,
            "invoice_date": inv.invoice_date.isoformat(),
            "place_of_supply_state": inv.place_of_supply_state,
            "place_of_supply_state_code": inv.place_of_supply_state_code,
            "is_inter_state": inv.is_inter_state,
            "is_draft": inv.is_draft,
            "watermark_text": inv.watermark_text,
            "seller": inv.seller_snapshot,
            "buyer": inv.buyer_snapshot,
            "taxable_amount_paise": inv.taxable_amount_paise,
            "taxable_amount_rupees": inv.taxable_amount_paise / 100.0,
            "cgst_amount_paise": inv.cgst_amount_paise,
            "cgst_amount_rupees": inv.cgst_amount_paise / 100.0,
            "sgst_amount_paise": inv.sgst_amount_paise,
            "sgst_amount_rupees": inv.sgst_amount_paise / 100.0,
            "igst_amount_paise": inv.igst_amount_paise,
            "igst_amount_rupees": inv.igst_amount_paise / 100.0,
            "total_tax_paise": inv.total_tax_paise,
            "total_tax_rupees": inv.total_tax_paise / 100.0,
            "final_total_paise": inv.final_total_paise,
            "final_total_rupees": inv.final_total_paise / 100.0,
            "items": items_out,
            "download_url": f"/api/v1/invoices/{inv.id}/pdf"
        })

    return output


@router.get("/invoices/{invoice_id}/pdf")
async def download_invoice_pdf(
    invoice_id: int,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Downloads official GST tax invoice or credit note PDF.
    Enforces owner-only access: only the booking owner or an admin can download.
    """
    stmt = (
        select(Invoice)
        .options(
            selectinload(Invoice.items),
            selectinload(Invoice.issuer_entity),
            selectinload(Invoice.booking)
        )
        .where(Invoice.id == invoice_id)
    )
    res = await db.execute(stmt)
    inv = res.scalars().first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    # Authorization check: only booking owner or admin
    if inv.booking.user_id != user.id and user.role not in [RoleEnum.ADMIN, "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You can only download invoices for your own bookings"
        )

    pdf_bytes = TaxInvoiceService.render_invoice_pdf(inv)
    clean_num = inv.invoice_number.replace("/", "_")
    filename = f"{clean_num}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{filename}"'
        }
    )


@router.get("/admin/invoices/export")
async def export_invoices_admin(
    financial_year: Optional[str] = None,
    issuer_type: Optional[str] = None,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Admin-only tax invoice register export.
    """
    if user.role not in [RoleEnum.ADMIN, "ADMIN"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    stmt = select(Invoice).options(selectinload(Invoice.items)).order_by(Invoice.id.desc())
    if financial_year:
        stmt = stmt.where(Invoice.financial_year == financial_year)
    if issuer_type:
        stmt = stmt.where(Invoice.issuer_type == issuer_type)

    res = await db.execute(stmt)
    invoices = res.scalars().all()

    register = []
    for inv in invoices:
        register.append({
            "invoice_number": inv.invoice_number,
            "invoice_type": inv.invoice_type,
            "financial_year": inv.financial_year,
            "invoice_date": inv.invoice_date.isoformat(),
            "booking_id": inv.booking_id,
            "issuer_legal_name": inv.seller_snapshot.get("legal_name"),
            "issuer_gstin": inv.seller_snapshot.get("gstin"),
            "customer_name": inv.buyer_snapshot.get("name"),
            "customer_gstin": inv.buyer_snapshot.get("customer_gstin"),
            "place_of_supply": inv.place_of_supply_state,
            "place_of_supply_code": inv.place_of_supply_state_code,
            "is_inter_state": inv.is_inter_state,
            "taxable_amount_paise": inv.taxable_amount_paise,
            "cgst_amount_paise": inv.cgst_amount_paise,
            "sgst_amount_paise": inv.sgst_amount_paise,
            "igst_amount_paise": inv.igst_amount_paise,
            "total_tax_paise": inv.total_tax_paise,
            "final_total_paise": inv.final_total_paise,
            "is_draft": inv.is_draft,
        })

    return {
        "count": len(register),
        "invoices": register
    }
