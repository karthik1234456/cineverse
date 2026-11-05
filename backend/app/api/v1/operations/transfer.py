import uuid
from datetime import datetime, timedelta
from pydantic import BaseModel, EmailStr
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.config import settings
from app.models.auth import User
from app.models.booking import Booking, Ticket
from app.models.showtime import Showtime
from app.models.operations import TicketTransferLog
from app.api.dependencies import require_user
from app.services.ticket_service import generate_qr_data, generate_ticket_signature, generate_qr_code_base64

router = APIRouter(prefix="/api/v1/tickets", tags=["Ticket Transfer"])


class TicketTransferRequest(BaseModel):
    recipient_email: EmailStr


@router.post("/{ticket_id}/transfer")
async def transfer_ticket(
    ticket_id: int,
    req: TicketTransferRequest,
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Safely transfers an unused ticket to another registered CineVerse account.
    Invalidates the original QR code, generates a fresh signed token for the recipient,
    and logs the transaction for fraud prevention.
    """
    if not settings.ENABLE_TICKET_TRANSFERS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ticket transfer feature is currently disabled by venue policy."
        )

    # 1. Fetch ticket and booking
    stmt = (
        select(Ticket)
        .where(Ticket.id == ticket_id)
        .options(
            selectinload(Ticket.booking).selectinload(Booking.seats),
            selectinload(Ticket.booking).selectinload(Booking.showtime)
        )
    )
    res = await db.execute(stmt)
    ticket = res.scalars().first()

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    booking = ticket.booking
    if booking.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to transfer this ticket")

    if ticket.is_used:
        raise HTTPException(status_code=400, detail="Cannot transfer an already used or admitted ticket")

    # 2. Check transfer frequency limit: max 5 transfers per month
    month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0)
    limit_stmt = select(func.count(TicketTransferLog.id)).where(
        TicketTransferLog.from_user_id == current_user.id,
        TicketTransferLog.transferred_at >= month_start
    )
    count_res = await db.execute(limit_stmt)
    transfers_this_month = count_res.scalar() or 0
    if transfers_this_month >= 5:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Monthly transfer limit reached. A user may transfer up to 5 tickets per calendar month."
        )

    # 3. Cutoff check: at least 2 hours before showtime
    showtime = booking.showtime
    cutoff = showtime.start_time - timedelta(hours=2)
    if datetime.utcnow() > cutoff:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Transfer window closed. Tickets cannot be transferred within 2 hours of showtime."
        )

    # 4. Find recipient user
    recip_stmt = select(User).where(User.email == req.recipient_email.lower())
    recip_res = await db.execute(recip_stmt)
    recipient = recip_res.scalars().first()

    if not recipient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipient account not found. The recipient must have a registered CineVerse account."
        )

    if recipient.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot transfer ticket to yourself")

    # 5. Invalidate original state and reissue fresh ticket token
    old_ticket_number = ticket.ticket_number
    new_ticket_number = f"TKT-{uuid.uuid4().hex[:10].upper()}"
    seat_ids = [s.seat_id for s in booking.seats]
    sig = generate_ticket_signature(new_ticket_number, showtime.id, seat_ids)
    qr_data = generate_qr_data(new_ticket_number, showtime.id, seat_ids, sig)
    qr_b64 = generate_qr_code_base64(qr_data)

    ticket.ticket_number = new_ticket_number
    ticket.qr_data = qr_data
    ticket.qr_code_url = qr_b64
    ticket.hmac_signature = sig
    ticket.is_used = False
    ticket.used_at = None

    # Reassign booking user
    booking.user_id = recipient.id
    booking.contact_email = recipient.email

    await db.flush()

    # 6. Audit log
    transfer_log = TicketTransferLog(
        original_ticket_id=ticket.id,
        from_user_id=current_user.id,
        to_user_id=recipient.id,
        to_email=recipient.email,
        new_ticket_id=ticket.id,
        transfer_status="COMPLETED"
    )
    db.add(transfer_log)
    await db.commit()

    return {
        "status": "success",
        "message": f"Ticket successfully transferred to {recipient.email}.",
        "new_ticket_number": ticket.ticket_number,
        "recipient_email": recipient.email,
        "transferred_at": transfer_log.transferred_at.isoformat()
    }
