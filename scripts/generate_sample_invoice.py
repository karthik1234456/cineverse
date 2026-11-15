import sys
import os
import asyncio
sys.path.insert(0, os.path.abspath('backend'))

from app.database import AsyncSessionLocal, init_db
from app.services.tax_invoice_service import TaxInvoiceService
from app.models.booking import Booking
from app.models.tax import Invoice
from sqlalchemy import select

async def main():
    await init_db()
    async with AsyncSessionLocal() as db:
        # Check booking 88001
        res = await db.execute(select(Booking).where(Booking.id == 88001))
        b = res.scalars().first()
        if not b:
            print("Booking 88001 not found!")
            return
        
        # Add B2B customer GSTIN for rich sample
        b.customer_gstin = "36AAECP4589D1ZF"
        b.customer_business_name = "Pinnacle Media & Tech Solutions LLP"
        b.customer_business_address = "Suite 404, Tech Park, Madhapur, Hyderabad"
        b.customer_state_code = "36"
        await db.commit()

        print(f"Generating tax invoices for Booking {b.id} ({b.booking_code})...")
        invoices = await TaxInvoiceService.generate_invoice_for_booking(db, b.id)
        print(f"Generated {len(invoices)} invoices!")

        os.makedirs("docs/evidence/invoices", exist_ok=True)

        for inv in invoices:
            print(f"\n--- Invoice: {inv.invoice_number} ---")
            print(f"Type: {inv.invoice_type}, FY: {inv.financial_year}")
            print(f"Issuer: {inv.issuer_type} ({inv.seller_snapshot.get('legal_name')})")
            print(f"Place of Supply: {inv.place_of_supply_state} ({inv.place_of_supply_state_code})")
            print(f"Inter-State: {inv.is_inter_state}")
            print(f"Draft Watermark: {inv.watermark_text}")
            print(f"Taxable: ₹{inv.taxable_amount_paise / 100:.2f} ({inv.taxable_amount_paise} paise)")
            print(f"CGST: ₹{inv.cgst_amount_paise / 100:.2f} ({inv.cgst_amount_paise} paise)")
            print(f"SGST: ₹{inv.sgst_amount_paise / 100:.2f} ({inv.sgst_amount_paise} paise)")
            print(f"IGST: ₹{inv.igst_amount_paise / 100:.2f} ({inv.igst_amount_paise} paise)")
            print(f"Total: ₹{inv.final_total_paise / 100:.2f} ({inv.final_total_paise} paise)")
            
            # Render PDF
            pdf_bytes = TaxInvoiceService.render_invoice_pdf(inv)
            filename = f"docs/evidence/invoices/{inv.invoice_number.replace('/', '_')}.pdf"
            with open(filename, "wb") as f:
                f.write(pdf_bytes)
            print(f"Rendered PDF: {filename} ({len(pdf_bytes)} bytes)")

        # Also generate a sample Credit Note for Booking 88002
        res2 = await db.execute(select(Booking).where(Booking.id == 88002))
        b2 = res2.scalars().first()
        if b2:
            print(f"\nGenerating tax invoices & Credit Note for Cancelled Booking 88002...")
            invs2 = await TaxInvoiceService.generate_invoice_for_booking(db, b2.id)
            if invs2:
                orig_inv = invs2[0]
                cn = await TaxInvoiceService.create_credit_note_for_refund(
                    db,
                    original_invoice_id=orig_inv.id,
                    refunded_amount_paise=round(775.0 * 100),
                    reason="Customer cancellation within policy window"
                )
                print(f"Generated Credit Note: {cn.invoice_number}")
                cn_pdf = TaxInvoiceService.render_invoice_pdf(cn)
                cn_filename = f"docs/evidence/invoices/{cn.invoice_number.replace('/', '_')}.pdf"
                with open(cn_filename, "wb") as f:
                    f.write(cn_pdf)
                print(f"Rendered Credit Note PDF: {cn_filename} ({len(cn_pdf)} bytes)")

if __name__ == '__main__':
    asyncio.run(main())
