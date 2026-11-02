from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.booking import Booking, Ticket
from app.models.showtime import Showtime
from app.schemas.booking import TicketResponse

router = APIRouter()


@router.get("/{booking_id}/qr", response_model=TicketResponse)
async def get_ticket_qr(booking_id: int, db: AsyncSession = Depends(get_db)):
    stmt = select(Ticket).where(Ticket.booking_id == booking_id)
    result = await db.execute(stmt)
    ticket = result.scalars().first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found or booking not yet confirmed")

    return TicketResponse(
        ticket_number=ticket.ticket_number,
        qr_data=ticket.qr_data,
        qr_code_url=ticket.qr_code_url,
        hmac_signature=ticket.hmac_signature,
        issued_at=ticket.issued_at
    )


@router.get("/{booking_code}/print", response_class=HTMLResponse)
async def print_ticket(booking_code: str, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Booking)
        .where(Booking.booking_code == booking_code)
        .options(
            selectinload(Booking.seats),
            selectinload(Booking.showtime).selectinload(Showtime.movie),
            selectinload(Booking.showtime).selectinload(Showtime.cinema),
            selectinload(Booking.showtime).selectinload(Showtime.auditorium),
            selectinload(Booking.ticket)
        )
    )
    result = await db.execute(stmt)
    booking = result.scalars().first()
    if not booking or not booking.ticket:
        raise HTTPException(status_code=404, detail="Confirmed booking ticket not found")

    st = booking.showtime
    seat_list = ", ".join(s.seat_id for s in booking.seats)

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>CineVerse E-Ticket - {booking.booking_code}</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0b0c10; color: #fff; margin: 0; padding: 24px; }}
    .ticket-card {{ max-width: 500px; margin: auto; background: #16181f; border: 1px solid #2a2d3d; border-radius: 16px; padding: 28px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }}
    .header {{ text-align: center; border-bottom: 1px dashed #3a3f55; padding-bottom: 16px; margin-bottom: 20px; }}
    .logo {{ color: #e50914; font-size: 24px; font-weight: 800; letter-spacing: 2px; }}
    .movie-title {{ font-size: 22px; font-weight: 700; margin: 12px 0 4px; }}
    .meta {{ color: #9ca3af; font-size: 14px; margin-bottom: 16px; }}
    .grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px; font-size: 14px; }}
    .grid div span {{ display: block; color: #9ca3af; font-size: 12px; }}
    .qr-container {{ text-align: center; margin: 20px 0; background: #0f1014; padding: 16px; border-radius: 12px; }}
    .qr-img {{ width: 180px; height: 180px; border-radius: 8px; }}
    .footer {{ text-align: center; font-size: 11px; color: #6b7280; margin-top: 16px; }}
  </style>
</head>
<body>
  <div class="ticket-card">
    <div class="header">
      <div class="logo">CINEVERSE</div>
      <div class="movie-title">{st.movie.title}</div>
      <div class="meta">{st.format} | {st.language} | {st.auditorium.name}</div>
    </div>
    <div class="grid">
      <div><span>CINEMA</span><strong>{st.cinema.name}</strong></div>
      <div><span>DATE & TIME</span><strong>{st.start_time.strftime('%a, %d %b %Y, %I:%M %p')}</strong></div>
      <div><span>SEATS ({len(booking.seats)})</span><strong style="color: #e50914;">{seat_list}</strong></div>
      <div><span>TOTAL PAID</span><strong>₹{booking.final_total_amount}</strong></div>
    </div>
    <div class="qr-container">
      <img src="{booking.ticket.qr_code_url}" class="qr-img" alt="Gate QR Entry" />
      <div style="font-family: monospace; font-size: 13px; color: #9ca3af; margin-top: 8px;">{booking.ticket.ticket_number}</div>
    </div>
    <div class="footer">
      Gate Admission Token: {booking.booking_code}<br/>
      Please present this verifiable QR code at the cinema entrance.
    </div>
  </div>
</body>
</html>"""
    return HTMLResponse(content=html)

