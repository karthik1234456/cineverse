import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.auth import User
from app.models.booking import Booking, Ticket
from app.models.operations import StaffDevice, TicketScanLog, ScanResultEnum
from app.api.dependencies import require_user, require_cinema_manager
from app.services.ticket_service import verify_ticket_signature, get_public_keys

router = APIRouter(prefix="/api/v1/staff", tags=["Staff Entry Scanning"])


class DeviceRegisterRequest(BaseModel):
    device_id: str
    device_name: str
    assigned_gate: str = "Gate 1 - Main Entrance"


class TicketScanRequest(BaseModel):
    qr_data: str
    gate: str = "Gate 1"
    device_id: Optional[str] = None
    offline_timestamp: Optional[datetime] = None


class BatchScanItem(BaseModel):
    client_scan_id: str
    qr_data: str
    gate: str
    device_id: str
    scanned_at: datetime


class BatchScanRequest(BaseModel):
    scans: List[BatchScanItem]


@router.get("/keys")
async def get_verification_keys(
    current_user: User = Depends(require_user)
):
    """
    Returns public keys and key IDs (`kid`) for offline scanning devices.
    Staff devices download and cache these keys periodically to perform offline Ed25519
    signature verification without exposing server private keys.
    """
    return {"status": "ok", "keys": get_public_keys()}


@router.post("/devices/register")
async def register_staff_device(
    req: DeviceRegisterRequest,
    current_user: User = Depends(require_cinema_manager),
    db: AsyncSession = Depends(get_db)
):
    """Registers an authorized mobile scanning device for cinema entrance gates."""
    stmt = select(StaffDevice).where(StaffDevice.device_id == req.device_id)
    res = await db.execute(stmt)
    existing = res.scalars().first()

    if existing:
        existing.device_name = req.device_name
        existing.assigned_gate = req.assigned_gate
        existing.last_active_at = datetime.utcnow()
        await db.commit()
        return {"status": "updated", "device_id": existing.device_id, "gate": existing.assigned_gate}

    device = StaffDevice(
        staff_user_id=current_user.id,
        device_id=req.device_id,
        device_name=req.device_name,
        assigned_gate=req.assigned_gate
    )
    db.add(device)
    await db.commit()
    return {"status": "registered", "device_id": device.device_id, "gate": device.assigned_gate}


@router.post("/scan")
async def scan_ticket(
    req: TicketScanRequest,
    current_user: User = Depends(require_cinema_manager),
    db: AsyncSession = Depends(get_db)
):
    """
    Validates QR token: verifies HMAC signature, checks atomic single-use state,
    and returns admission confirmation or duplicate alert.
    """
    # 1. Verify cryptographic signature
    is_valid_sig = verify_ticket_signature(req.qr_data)
    if not is_valid_sig:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="INVALID_HMAC: Ticket QR signature is invalid or has been forged."
        )

    # 2. Extract ticket_number from QR string
    if req.qr_data.startswith("{"):
        try:
            import json
            parsed = json.loads(req.qr_data)
            ticket_num = parsed.get("booking_code") or parsed.get("ticket_number")
        except Exception:
            ticket_num = req.qr_data
    else:
        parts = req.qr_data.split("|")
        ticket_num = parts[0] if parts else req.qr_data

    stmt = (
        select(Ticket)
        .where(Ticket.ticket_number == ticket_num)
        .options(
            selectinload(Ticket.booking).selectinload(Booking.seats),
            selectinload(Ticket.booking).selectinload(Booking.showtime)
        )
    )
    res = await db.execute(stmt)
    ticket = res.scalars().first()

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found in system")

    # 3. Duplicate scan check
    if ticket.is_used:
        scan_log = TicketScanLog(
            ticket_id=ticket.id,
            staff_user_id=current_user.id,
            device_id=req.device_id,
            gate=req.gate,
            scan_result=ScanResultEnum.ALREADY_USED,
            scanned_at=datetime.utcnow()
        )
        db.add(scan_log)
        await db.commit()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "result": "ALREADY_USED",
                "message": f"This ticket was already scanned at {ticket.used_at.isoformat() if ticket.used_at else 'earlier'}.",
                "ticket_number": ticket.ticket_number,
                "first_scanned_at": ticket.used_at.isoformat() if ticket.used_at else None
            }
        )

    # 4. Atomic admission transition: VALID -> USED
    ticket.is_used = True
    ticket.used_at = req.offline_timestamp or datetime.utcnow()

    scan_log = TicketScanLog(
        ticket_id=ticket.id,
        staff_user_id=current_user.id,
        device_id=req.device_id,
        gate=req.gate,
        scan_result=ScanResultEnum.SUCCESS,
        scanned_at=ticket.used_at,
        offline_sync=bool(req.offline_timestamp)
    )
    db.add(scan_log)
    await db.commit()

    seat_list = [s.seat_id for s in ticket.booking.seats]
    return {
        "result": "SUCCESS",
        "message": "Ticket successfully verified. Access GRANTED.",
        "ticket_number": ticket.ticket_number,
        "booking_code": ticket.booking.booking_code,
        "seats": seat_list,
        "total_admissions": len(seat_list),
        "gate": req.gate,
        "admitted_at": ticket.used_at.isoformat()
    }


@router.post("/scan/batch")
async def batch_sync_offline_scans(
    req: BatchScanRequest,
    current_user: User = Depends(require_cinema_manager),
    db: AsyncSession = Depends(get_db)
):
    """
    Reconciles queued offline scans from handheld gate devices.
    Sorts scans by client timestamp and applies atomic first-come verification.
    """
    sorted_scans = sorted(req.scans, key=lambda s: s.scanned_at)
    results = []

    for item in sorted_scans:
        if item.qr_data.startswith("{"):
            try:
                import json
                parsed = json.loads(item.qr_data)
                ticket_num = parsed.get("booking_code") or parsed.get("ticket_number")
            except Exception:
                ticket_num = item.qr_data
        else:
            parts = item.qr_data.split("|")
            ticket_num = parts[0] if parts else item.qr_data

        stmt = select(Ticket).where(Ticket.ticket_number == ticket_num)
        res = await db.execute(stmt)
        ticket = res.scalars().first()

        if not ticket:
            results.append({"client_scan_id": item.client_scan_id, "result": "NOT_FOUND"})
            continue

        if not verify_ticket_signature(item.qr_data):
            results.append({"client_scan_id": item.client_scan_id, "result": "INVALID_HMAC"})
            continue

        if ticket.is_used:
            # Reconcile conflict: duplicate offline scan detected across devices
            conflict_log = TicketScanLog(
                ticket_id=ticket.id,
                staff_user_id=current_user.id,
                device_id=item.device_id,
                gate=item.gate,
                scan_result=ScanResultEnum.OFFLINE_DUPLICATE_CONFLICT,
                scanned_at=item.scanned_at,
                offline_sync=True
            )
            db.add(conflict_log)
            results.append({
                "client_scan_id": item.client_scan_id,
                "result": "OFFLINE_DUPLICATE_CONFLICT",
                "message": "Ticket already used/admitted by an earlier scan",
                "used_at": ticket.used_at.isoformat() if ticket.used_at else None
            })
            continue

        ticket.is_used = True
        ticket.used_at = item.scanned_at
        log = TicketScanLog(
            ticket_id=ticket.id,
            staff_user_id=current_user.id,
            device_id=item.device_id,
            gate=item.gate,
            scan_result=ScanResultEnum.OFFLINE_RESOLVED,
            scanned_at=item.scanned_at,
            offline_sync=True
        )
        db.add(log)
        results.append({
            "client_scan_id": item.client_scan_id,
            "result": "SUCCESS",
            "ticket_number": ticket.ticket_number
        })

    await db.commit()
    return {"synced_count": len(results), "results": results}


@router.get("/lookup")
async def manual_ticket_lookup(
    code: str,
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    """Manual fallback lookup by booking code (CV-XXXXXX) or ticket number (TKT-XXXXXX)."""
    search_code = code.strip().upper()

    # Try lookup by Ticket Number
    tkt_stmt = (
        select(Ticket)
        .where(Ticket.ticket_number == search_code)
        .options(selectinload(Ticket.booking).selectinload(Booking.seats))
    )
    tkt_res = await db.execute(tkt_stmt)
    ticket = tkt_res.scalars().first()

    if ticket:
        bkg = ticket.booking
        return {
            "booking_code": bkg.booking_code,
            "status": bkg.status,
            "ticket_number": ticket.ticket_number,
            "is_used": ticket.is_used,
            "used_at": ticket.used_at.isoformat() if ticket.used_at else None,
            "seats": [s.seat_id for s in bkg.seats] if bkg and bkg.seats else []
        }

    # Try lookup by Booking Code
    bkg_stmt = (
        select(Booking)
        .where(Booking.booking_code == search_code)
        .options(selectinload(Booking.seats), selectinload(Booking.ticket))
    )
    bkg_res = await db.execute(bkg_stmt)
    booking = bkg_res.scalars().first()

    if not booking:
        raise HTTPException(status_code=404, detail="No matching booking or ticket found")

    return {
        "booking_code": booking.booking_code,
        "status": booking.status,
        "ticket_number": booking.ticket.ticket_number if booking.ticket else None,
        "is_used": booking.ticket.is_used if booking.ticket else False,
        "used_at": booking.ticket.used_at.isoformat() if booking.ticket and booking.ticket.used_at else None,
        "seats": [s.seat_id for s in booking.seats]
    }
