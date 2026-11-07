import secrets
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple, Any
from sqlalchemy import select, and_, func, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status

from app.models.group_booking import (
    GroupBooking, GroupMember, GroupNotification,
    GroupBookingStatusEnum, GroupTimeoutPolicyEnum,
    GroupMemberRoleEnum, MemberPaymentStatusEnum
)
from app.models.showtime import Showtime, SeatInventory, SeatStatusEnum
from app.models.booking import Booking, BookingSeat, Ticket, BookingStatusEnum
from app.models.cinema import Seat
from app.models.auth import User
from app.models.payment import Payment, PaymentStatusEnum
from app.services.hold_service import hold_seats, release_seats, broadcast_seat_update
from app.services.ticket_service import generate_ticket_signature, generate_qr_data, generate_qr_code_base64
from app.services.group_payment_sm import reduce, check_invariants, GroupEvent, Effect, GroupState, create_group, Share
from app.services.group_ws_manager import group_ws_manager


MEMBER_COLORS = [
    "#E50914", "#1E40AF", "#047857", "#B45309",
    "#6D28D9", "#BE185D", "#0E7490", "#4D7C0F"
]


def _initials(name: Optional[str], email: Optional[str]) -> str:
    if name and name.strip():
        parts = name.strip().split()
        if len(parts) >= 2:
            return (parts[0][0] + parts[1][0]).upper()
        return parts[0][:2].upper()
    if email:
        return email[:2].upper()
    return "ME"


class GroupBookingService:
    @staticmethod
    async def create_group_session(
        db: AsyncSession,
        user: User,
        showtime_id: int,
        timeout_policy: str = "AUTO_REFUND",
        max_members: int = 8
    ) -> GroupBooking:
        # Anti-hoarding check: max 2 active non-terminal groups per host
        active_count_query = select(func.count(GroupBooking.id)).where(
            and_(
                GroupBooking.host_user_id == user.id,
                GroupBooking.status.in_([
                    GroupBookingStatusEnum.FORMATION,
                    GroupBookingStatusEnum.HELD,
                    GroupBookingStatusEnum.PARTIALLY_PAID
                ])
            )
        )
        active_count = (await db.execute(active_count_query)).scalar() or 0
        if active_count >= 2:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="You have reached the limit of active group bookings (max 2). Please complete or cancel existing groups."
            )

        showtime = await db.get(Showtime, showtime_id)
        if not showtime:
            raise HTTPException(status_code=404, detail="Showtime not found")

        group_code = f"GRP-{uuid.uuid4().hex[:8].upper()}"
        invite_token = secrets.token_urlsafe(32)
        token_expires = datetime.utcnow() + timedelta(hours=24)

        policy_enum = (
            GroupTimeoutPolicyEnum.HOST_COVERS
            if timeout_policy.upper() == "HOST_COVERS"
            else GroupTimeoutPolicyEnum.AUTO_REFUND
        )

        group = GroupBooking(
            group_code=group_code,
            showtime_id=showtime_id,
            host_user_id=user.id,
            status=GroupBookingStatusEnum.FORMATION,
            timeout_policy=policy_enum,
            invite_token=invite_token,
            invite_token_expires_at=token_expires,
            max_members=max_members
        )
        db.add(group)
        await db.flush()

        # Add host as first member
        host_member = GroupMember(
            group_id=group.id,
            user_id=user.id,
            role=GroupMemberRoleEnum.HOST,
            color=MEMBER_COLORS[0],
            initials=_initials(user.full_name, user.email),
            payment_status=MemberPaymentStatusEnum.UNPAID
        )
        db.add(host_member)
        await db.commit()
        await db.refresh(group)
        return group

    @staticmethod
    async def join_group_by_token(
        db: AsyncSession,
        user: User,
        invite_token: str
    ) -> Tuple[GroupBooking, GroupMember]:
        stmt = (
            select(GroupBooking)
            .where(GroupBooking.invite_token == invite_token)
            .options(selectinload(GroupBooking.members).selectinload(GroupMember.user))
        )
        result = await db.execute(stmt)
        group = result.scalars().first()

        if not group:
            raise HTTPException(status_code=404, detail="Invalid group invite token")
        if group.is_invite_revoked:
            raise HTTPException(status_code=410, detail="This group invite link has been revoked by the host")
        if group.invite_token_expires_at < datetime.utcnow():
            raise HTTPException(status_code=410, detail="This group invite link has expired")
        if group.status in [GroupBookingStatusEnum.CONFIRMED, GroupBookingStatusEnum.CANCELLED, GroupBookingStatusEnum.EXPIRED]:
            raise HTTPException(status_code=400, detail=f"Cannot join group in {group.status.value} status")

        # Check if already a member
        for m in group.members:
            if m.user_id == user.id:
                return group, m

        if len(group.members) >= group.max_members:
            raise HTTPException(status_code=400, detail=f"Group has reached its maximum size of {group.max_members}")

        idx = len(group.members) % len(MEMBER_COLORS)
        new_member = GroupMember(
            group_id=group.id,
            user_id=user.id,
            role=GroupMemberRoleEnum.MEMBER,
            color=MEMBER_COLORS[idx],
            initials=_initials(user.full_name, user.email),
            payment_status=MemberPaymentStatusEnum.UNPAID
        )
        db.add(new_member)

        # Notification to host
        notif = GroupNotification(
            group_id=group.id,
            user_id=group.host_user_id,
            event_type="JOIN",
            title="Friend Joined Group",
            message=f"{user.full_name or user.email} joined your group booking."
        )
        db.add(notif)
        await db.commit()
        await db.refresh(group)

        # WS broadcast
        await group_ws_manager.broadcast_to_group(group.id, {
            "type": "MEMBER_JOINED",
            "member": {
                "id": new_member.id,
                "user_id": user.id,
                "user_name": user.full_name or user.email,
                "role": "MEMBER",
                "color": new_member.color,
                "initials": new_member.initials
            }
        })
        return group, new_member

    @staticmethod
    async def propose_seats(
        db: AsyncSession,
        group_id: int,
        user_id: int,
        seat_ids: List[str]
    ) -> GroupMember:
        stmt = select(GroupMember).where(and_(GroupMember.group_id == group_id, GroupMember.user_id == user_id))
        member = (await db.execute(stmt)).scalars().first()
        if not member:
            raise HTTPException(status_code=403, detail="You are not a member of this group")

        group = await db.get(GroupBooking, group_id)
        if not group or group.status != GroupBookingStatusEnum.FORMATION:
            raise HTTPException(status_code=400, detail="Cannot propose seats after group hold is locked")

        member.proposed_seats = seat_ids
        await db.commit()
        await db.refresh(member)
        return member

    @staticmethod
    async def host_confirm_selection_and_hold(
        db: AsyncSession,
        group_id: int,
        host_user: User,
        seat_allocations: Dict[int, List[str]],  # member_id -> [seat_ids]
        share_amounts_paise: Optional[Dict[int, int]] = None
    ) -> GroupBooking:
        stmt = (
            select(GroupBooking)
            .where(GroupBooking.id == group_id)
            .options(selectinload(GroupBooking.members))
        )
        group = (await db.execute(stmt)).scalars().first()
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        if group.host_user_id != host_user.id:
            raise HTTPException(status_code=403, detail="Only the host can confirm seat selection and initiate hold")
        if group.status != GroupBookingStatusEnum.FORMATION:
            raise HTTPException(status_code=400, detail=f"Group is already in {group.status.value} status")

        # Collect all unique seats
        all_seats = []
        for s_list in seat_allocations.values():
            all_seats.extend(s_list)

        if not all_seats:
            raise HTTPException(status_code=400, detail="At least one seat must be selected")
        if len(set(all_seats)) != len(all_seats):
            raise HTTPException(status_code=400, detail="Duplicate seat allocations across members")

        # Request single shared hold via hold_service
        hold_result = await hold_seats(
            db=db,
            showtime_id=group.showtime_id,
            seat_ids=all_seats,
            user_id=host_user.id
        )

        from app.services.hold_service import get_hold_quote
        quote = await get_hold_quote(db, hold_result["hold_id"], host_user)

        group.hold_id = hold_result["hold_id"]
        group.hold_expires_at = hold_result["expires_at"]
        group.total_ticket_amount = quote["ticket_subtotal"]
        group.convenience_fee = quote["convenience_fee"]
        group.gst_amount = quote["gst_amount"]
        group.total_amount = quote["final_total"]
        group.status = GroupBookingStatusEnum.HELD

        total_paise = int(round(group.total_amount * 100))

        # Split calculation
        member_map = {m.id: m for m in group.members}
        if share_amounts_paise:
            # Custom split: verify sum == total_paise exactly
            if sum(share_amounts_paise.values()) != total_paise:
                raise HTTPException(
                    status_code=400,
                    detail=f"Share amounts sum ({sum(share_amounts_paise.values())}) must equal total ({total_paise})"
                )
            for m_id, amt_p in share_amounts_paise.items():
                if m_id in member_map:
                    member_map[m_id].share_amount = amt_p / 100.0
                    member_map[m_id].assigned_seats = seat_allocations.get(m_id, [])
        else:
            # Equal split with deterministic remainder distribution
            n = len(group.members)
            base = total_paise // n
            rem = total_paise % n
            for i, m in enumerate(group.members):
                m_amt = base + (1 if i < rem else 0)
                m.share_amount = m_amt / 100.0
                m.assigned_seats = seat_allocations.get(m.id, [])

        # Add notification for members
        for m in group.members:
            notif = GroupNotification(
                group_id=group.id,
                user_id=m.user_id,
                event_type="FINALIZED",
                title="Seats Finalized & Hold Started",
                message=f"Host finalized seats. Your share is ₹{m.share_amount:.2f}. Please pay before the hold expires."
            )
            db.add(notif)

        await db.commit()
        await db.refresh(group)

        # Broadcast HOLD_LOCKED
        await group_ws_manager.broadcast_to_group(group.id, {
            "type": "HOLD_LOCKED",
            "hold_id": group.hold_id,
            "hold_expires_at": group.hold_expires_at.isoformat() if group.hold_expires_at else None,
            "total_amount": group.total_amount,
            "total_amount_paise": total_paise
        })

        return group

    @staticmethod
    async def extend_group_hold(
        db: AsyncSession,
        group_id: int,
        host_user: User,
        additional_minutes: int = 5
    ) -> GroupBooking:
        stmt = select(GroupBooking).where(GroupBooking.id == group_id).options(selectinload(GroupBooking.members))
        group = (await db.execute(stmt)).scalars().first()
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        if group.host_user_id != host_user.id:
            raise HTTPException(status_code=403, detail="Only host can extend group hold")
        if group.status not in [GroupBookingStatusEnum.HELD, GroupBookingStatusEnum.PARTIALLY_PAID]:
            raise HTTPException(status_code=400, detail=f"Cannot extend hold in {group.status.value} status")
        if group.hold_extended_count >= 1:
            raise HTTPException(status_code=400, detail="Group hold can only be extended once")

        new_expires_at = (group.hold_expires_at or datetime.utcnow()) + timedelta(minutes=additional_minutes)
        group.hold_expires_at = new_expires_at
        group.hold_extended_count += 1

        # Also update underlying seat inventories
        if group.hold_id:
            await db.execute(
                update(SeatInventory)
                .where(SeatInventory.hold_id == group.hold_id)
                .values(hold_expires_at=new_expires_at)
            )

        # Add notification
        for m in group.members:
            notif = GroupNotification(
                group_id=group.id,
                user_id=m.user_id,
                event_type="HOLD_EXTENDED",
                title="Hold Extended",
                message=f"Hold extended by {additional_minutes} minutes. New deadline: {new_expires_at.strftime('%H:%M:%S')}."
            )
            db.add(notif)

        await db.commit()
        await db.refresh(group)

        # Broadcast
        await group_ws_manager.broadcast_to_group(group.id, {
            "type": "HOLD_EXTENDED",
            "hold_expires_at": new_expires_at.isoformat(),
            "hold_extended_count": group.hold_extended_count
        })

        return group

    @staticmethod
    async def create_member_order(
        db: AsyncSession,
        group_id: int,
        user_id: int
    ) -> Dict[str, Any]:
        stmt = (
            select(GroupBooking)
            .where(GroupBooking.id == group_id)
            .options(selectinload(GroupBooking.members))
        )
        group = (await db.execute(stmt)).scalars().first()
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        if group.status not in [GroupBookingStatusEnum.HELD, GroupBookingStatusEnum.PARTIALLY_PAID]:
            raise HTTPException(status_code=400, detail=f"Group is in {group.status.value} status, cannot create order")

        member = next((m for m in group.members if m.user_id == user_id), None)
        if not member:
            raise HTTPException(status_code=403, detail="You are not a member of this group")
        if member.payment_status == MemberPaymentStatusEnum.PAID:
            raise HTTPException(status_code=400, detail="You have already paid your share")

        share_paise = int(round(member.share_amount * 100))
        order_id = f"order_grp_{group.id}_{member.id}_{secrets.token_hex(4)}"
        member.razorpay_order_id = order_id
        member.payment_status = MemberPaymentStatusEnum.PAYMENT_PENDING
        await db.commit()

        return {
            "order_id": order_id,
            "amount_paise": share_paise,
            "currency": "INR",
            "group_id": group.id,
            "member_id": member.id
        }

    @staticmethod
    async def record_member_payment(
        db: AsyncSession,
        group_id: int,
        user_id: int,
        payment_id: str,
        amount_paise: int
    ) -> Tuple[GroupBooking, List[Effect]]:
        stmt = (
            select(GroupBooking)
            .where(GroupBooking.id == group_id)
            .options(
                selectinload(GroupBooking.members).selectinload(GroupMember.user),
                selectinload(GroupBooking.showtime).selectinload(Showtime.movie),
                selectinload(GroupBooking.showtime).selectinload(Showtime.auditorium),
                selectinload(GroupBooking.showtime).selectinload(Showtime.cinema)
            )
        )
        group = (await db.execute(stmt)).scalars().first()
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")

        member = next((m for m in group.members if m.user_id == user_id), None)
        if not member:
            raise HTTPException(status_code=403, detail="You are not a member of this group")

        # Reconstruct SM GroupState
        host_m = next((m for m in group.members if m.role == GroupMemberRoleEnum.HOST), group.members[0])
        shares_data = [
            {"member_id": str(m.id), "amount": int(round(m.share_amount * 100))}
            for m in group.members
        ]
        policy_str = "host_covers" if group.timeout_policy == GroupTimeoutPolicyEnum.HOST_COVERS else "refund_all"
        state = create_group(host_id=str(host_m.id), shares=shares_data, policy=policy_str)

        # Restore state of existing paid members
        captured_so_far = 0
        for m in group.members:
            if m.payment_status == MemberPaymentStatusEnum.PAID and m.razorpay_payment_id:
                state.shares[str(m.id)].status = "PAID"
                state.shares[str(m.id)].payment_id = m.razorpay_payment_id
                state.seen_payments.append(m.razorpay_payment_id)
                captured_so_far += state.shares[str(m.id)].amount
        state.captured_total = captured_so_far
        if captured_so_far > 0 and captured_so_far < state.total:
            state.phase = "PARTIALLY_PAID"

        # Apply state machine transition
        evt = GroupEvent(
            id=f"evt_{uuid.uuid4().hex[:8]}",
            type="PAYMENT_CAPTURED",
            member_id=str(member.id),
            payment_id=payment_id,
            amount=amount_paise
        )
        next_state, effects = reduce(state, evt)
        check_invariants(next_state, effects)

        # Update member record
        member.payment_status = MemberPaymentStatusEnum.PAID
        member.paid_at = datetime.utcnow()
        member.razorpay_payment_id = payment_id

        # Process effects
        for eff in effects:
            if eff.kind == "confirmBooking":
                # Create confirmed booking and individual member tickets
                all_assigned = []
                for m in group.members:
                    all_assigned.extend(m.assigned_seats or [])

                master_booking = Booking(
                    booking_code=f"CV-GRP-{uuid.uuid4().hex[:6].upper()}",
                    user_id=group.host_user_id,
                    showtime_id=group.showtime_id,
                    status=BookingStatusEnum.CONFIRMED,
                    total_ticket_amount=group.total_ticket_amount,
                    convenience_fee=group.convenience_fee,
                    gst_amount=group.gst_amount,
                    final_total_amount=group.total_amount
                )
                db.add(master_booking)
                await db.flush()

                for s_id in all_assigned:
                    b_seat = BookingSeat(
                        booking_id=master_booking.id,
                        showtime_id=group.showtime_id,
                        seat_id=s_id,
                        category="Group",
                        price=group.total_amount / max(1, len(all_assigned))
                    )
                    db.add(b_seat)

                # Update seat inventories to BOOKED
                if group.hold_id:
                    await db.execute(
                        update(SeatInventory)
                        .where(SeatInventory.hold_id == group.hold_id)
                        .values(
                            status=SeatStatusEnum.BOOKED,
                            booking_id=master_booking.id,
                            hold_id=None,
                            hold_expires_at=None
                        )
                    )

                # Generate individual tickets for each member
                for m in group.members:
                    m_seats = m.assigned_seats or []
                    if m_seats:
                        # Individual sub-booking for member ticket linkage
                        mem_booking = Booking(
                            booking_code=f"CV-MBR-{uuid.uuid4().hex[:6].upper()}",
                            user_id=m.user_id,
                            showtime_id=group.showtime_id,
                            status=BookingStatusEnum.CONFIRMED,
                            total_ticket_amount=m.share_amount,
                            final_total_amount=m.share_amount
                        )
                        db.add(mem_booking)
                        await db.flush()

                        tkt_num = f"TKT-GRP-{uuid.uuid4().hex[:8].upper()}"
                        sig = generate_ticket_signature(mem_booking.booking_code, group.showtime_id, m_seats)
                        qr_data = generate_qr_data(mem_booking.booking_code, group.showtime_id, m_seats, sig)
                        qr_b64 = generate_qr_code_base64(qr_data)

                        tkt = Ticket(
                            booking_id=mem_booking.id,
                            ticket_number=tkt_num,
                            qr_data=qr_data,
                            qr_code_url=qr_b64,
                            hmac_signature=sig
                        )
                        db.add(tkt)
                        await db.flush()
                        m.ticket_id = tkt.id

                group.status = GroupBookingStatusEnum.CONFIRMED
                group.booking_id = master_booking.id

                # Broadcast seat update to theatre and group
                await broadcast_seat_update(group.showtime_id, {
                    "event": "SEATS_BOOKED",
                    "showtime_id": group.showtime_id,
                    "seat_ids": all_assigned,
                    "status": "BOOKED"
                })
                await group_ws_manager.broadcast_to_group(group.id, {
                    "type": "BOOKING_CONFIRMED",
                    "group_code": group.group_code,
                    "booking_id": master_booking.id
                })

            elif eff.kind == "refund":
                member.payment_status = MemberPaymentStatusEnum.REFUNDED

        if group.status != GroupBookingStatusEnum.CONFIRMED:
            group.status = GroupBookingStatusEnum.PARTIALLY_PAID

        # WS broadcast member paid
        await group_ws_manager.broadcast_to_group(group.id, {
            "type": "MEMBER_PAID",
            "member_id": member.id,
            "user_id": user_id,
            "amount_paise": amount_paise,
            "status": group.status.value
        })

        await db.commit()
        await db.refresh(group)
        return group, effects

    @staticmethod
    async def handle_group_timeout(
        db: AsyncSession,
        group_id: int,
        force: bool = False
    ) -> GroupBooking:
        stmt = (
            select(GroupBooking)
            .where(GroupBooking.id == group_id)
            .options(selectinload(GroupBooking.members))
        )
        group = (await db.execute(stmt)).scalars().first()
        if not group or (group.status != GroupBookingStatusEnum.HELD and group.status != GroupBookingStatusEnum.PARTIALLY_PAID):
            return group
        if not force and group.hold_expires_at and group.hold_expires_at > datetime.utcnow():
            return group

        # If Auto-Refund: release seats and mark all paid members refunded
        if group.timeout_policy == GroupTimeoutPolicyEnum.AUTO_REFUND:
            if group.hold_id:
                await release_seats(db, group.hold_id)

            for m in group.members:
                if m.payment_status == MemberPaymentStatusEnum.PAID:
                    m.payment_status = MemberPaymentStatusEnum.REFUNDED
                    notif = GroupNotification(
                        group_id=group.id,
                        user_id=m.user_id,
                        event_type="REFUNDED",
                        title="Group Booking Timed Out - Refund Issued",
                        message=f"Hold expired before all members paid. Your share of ₹{m.share_amount:.2f} has been refunded."
                    )
                    db.add(notif)

            group.status = GroupBookingStatusEnum.EXPIRED
            await db.commit()
            await db.refresh(group)

            await group_ws_manager.broadcast_to_group(group.id, {
                "type": "GROUP_EXPIRED",
                "policy": "AUTO_REFUND",
                "message": "Hold expired. All payments have been refunded and seats released."
            })
            return group

        elif group.timeout_policy == GroupTimeoutPolicyEnum.HOST_COVERS:
            # Check paid total vs total paise
            total_paise = int(round(group.total_amount * 100))
            paid_paise = sum(int(round(m.share_amount * 100)) for m in group.members if m.payment_status == MemberPaymentStatusEnum.PAID)
            remainder = total_paise - paid_paise

            if remainder <= 0:
                # Fully paid already
                return group

            # Host cover remainder payment attempt
            host_m = next((m for m in group.members if m.role == GroupMemberRoleEnum.HOST), None)
            if host_m:
                # Charge host remainder
                host_cover_payment_id = f"pay_host_cover_{secrets.token_hex(6)}"
                # Simulate host cover payment success
                # Confirm booking for group
                all_assigned = []
                for m in group.members:
                    all_assigned.extend(m.assigned_seats or [])

                master_booking = Booking(
                    booking_code=f"CV-GRP-{uuid.uuid4().hex[:6].upper()}",
                    user_id=group.host_user_id,
                    showtime_id=group.showtime_id,
                    status=BookingStatusEnum.CONFIRMED,
                    total_ticket_amount=group.total_ticket_amount,
                    final_total_amount=group.total_amount
                )
                db.add(master_booking)
                await db.flush()

                # Update seat inventories to BOOKED
                if group.hold_id:
                    await db.execute(
                        update(SeatInventory)
                        .where(SeatInventory.hold_id == group.hold_id)
                        .values(
                            status=SeatStatusEnum.BOOKED,
                            booking_id=master_booking.id,
                            hold_id=None,
                            hold_expires_at=None
                        )
                    )

                for m in group.members:
                    m.payment_status = MemberPaymentStatusEnum.PAID
                    m_seats = m.assigned_seats or []
                    if m_seats:
                        mem_booking = Booking(
                            booking_code=f"CV-MBR-{uuid.uuid4().hex[:6].upper()}",
                            user_id=m.user_id,
                            showtime_id=group.showtime_id,
                            status=BookingStatusEnum.CONFIRMED,
                            final_total_amount=m.share_amount
                        )
                        db.add(mem_booking)
                        await db.flush()

                        tkt_num = f"TKT-GRP-{uuid.uuid4().hex[:8].upper()}"
                        sig = generate_ticket_signature(mem_booking.booking_code, group.showtime_id, m_seats)
                        qr_data = generate_qr_data(mem_booking.booking_code, group.showtime_id, m_seats, sig)
                        qr_b64 = generate_qr_code_base64(qr_data)

                        tkt = Ticket(
                            booking_id=mem_booking.id,
                            ticket_number=tkt_num,
                            qr_data=qr_data,
                            qr_code_url=qr_b64,
                            hmac_signature=sig
                        )
                        db.add(tkt)
                        await db.flush()
                        m.ticket_id = tkt.id

                group.status = GroupBookingStatusEnum.CONFIRMED
                group.booking_id = master_booking.id
                await db.commit()
                await db.refresh(group)

                await group_ws_manager.broadcast_to_group(group.id, {
                    "type": "BOOKING_CONFIRMED",
                    "policy": "HOST_COVERS",
                    "message": f"Host covered remaining ₹{remainder / 100:.2f}. Booking is confirmed!"
                })
            return group

        return group

    @staticmethod
    async def get_member_tickets(
        db: AsyncSession,
        group_id: int,
        user_id: int
    ) -> List[Dict[str, Any]]:
        stmt = (
            select(GroupBooking)
            .where(GroupBooking.id == group_id)
            .options(
                selectinload(GroupBooking.members).selectinload(GroupMember.user),
                selectinload(GroupBooking.members).selectinload(GroupMember.ticket),
                selectinload(GroupBooking.showtime).selectinload(Showtime.movie),
                selectinload(GroupBooking.showtime).selectinload(Showtime.cinema)
            )
        )
        group = (await db.execute(stmt)).scalars().first()
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        if group.status != GroupBookingStatusEnum.CONFIRMED:
            raise HTTPException(status_code=400, detail="Tickets are only available once the group booking is confirmed")

        movie_title = group.showtime.movie.title if group.showtime and group.showtime.movie else "Movie"
        cinema_name = group.showtime.cinema.name if group.showtime and group.showtime.cinema else "Cinema"
        show_time = group.showtime.start_time if group.showtime else datetime.utcnow()

        tickets = []
        for m in group.members:
            # If user is not host and not this member, skip
            if group.host_user_id != user_id and m.user_id != user_id:
                continue

            tkt = m.ticket
            ticket_number = tkt.ticket_number if tkt else f"TKT-GRP-{m.id}"
            qr_data = tkt.qr_data if tkt else f"GRP:{group.group_code}:{m.id}"
            qr_url = tkt.qr_code_url if tkt else None

            tickets.append({
                "member_id": m.id,
                "user_id": m.user_id,
                "user_name": m.user.full_name if m.user else "Member",
                "ticket_number": ticket_number,
                "seats": m.assigned_seats or [],
                "qr_data": qr_data,
                "qr_code_url": qr_url,
                "movie_title": movie_title,
                "cinema_name": cinema_name,
                "show_time": show_time,
                "is_paid": m.payment_status == MemberPaymentStatusEnum.PAID
            })

        return tickets
