import secrets
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple, Any
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status

from app.models.group_booking import (
    GroupBooking, GroupMember, GroupNotification,
    GroupBookingStatusEnum, GroupTimeoutPolicyEnum,
    GroupMemberRoleEnum, MemberPaymentStatusEnum
)
from app.models.showtime import Showtime, SeatInventory, SeatStatusEnum
from app.models.booking import Booking, BookingStatusEnum
from app.models.cinema import Seat
from app.models.auth import User
from app.services.hold_service import hold_seats, release_seats
from app.services.group_payment_sm import reduce, check_invariants, GroupEvent, Effect, GroupState, create_group, Share


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

        group.hold_id = hold_result["hold_id"]
        group.hold_expires_at = hold_result["expires_at"]
        group.total_ticket_amount = hold_result.get("total_price", 0.0)
        group.convenience_fee = hold_result.get("convenience_fee", 0.0)
        group.gst_amount = hold_result.get("taxes", 0.0)
        group.total_amount = hold_result.get("total_amount", 0.0)
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

        await db.commit()
        await db.refresh(group)
        return group
