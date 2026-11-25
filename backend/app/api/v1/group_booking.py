from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from typing import List, Dict, Any, Optional

from app.database import get_db
from app.api.v1.auth import get_current_user
from app.models.auth import User
from app.models.group_booking import (
    GroupBooking, GroupMember, GroupNotification,
    GroupBookingStatusEnum, GroupMemberRoleEnum, MemberPaymentStatusEnum
)
from app.schemas.group_booking import (
    CreateGroupRequest, ProposeSeatsRequest, AssignSharesRequest,
    JoinGroupRequest, ConfirmSelectionRequest, RecordPaymentRequest,
    ExtendHoldResponse, GroupTicketResponse,
    GroupBookingResponse, GroupMemberResponse
)
from app.services.group_booking_service import GroupBookingService, _initials
from app.services.group_ws_manager import group_ws_manager

router = APIRouter()


def _format_member(m: GroupMember) -> GroupMemberResponse:
    u = m.user
    share_paise = int(round(m.share_amount * 100))
    return GroupMemberResponse(
        id=m.id,
        user_id=m.user_id,
        user_name=u.full_name if u else "Guest",
        user_email=u.email if u else "",
        role=m.role.value,
        color=m.color,
        initials=m.initials,
        proposed_seats=m.proposed_seats or [],
        assigned_seats=m.assigned_seats or [],
        share_amount=m.share_amount,
        share_amount_paise=share_paise,
        payment_status=m.payment_status.value,
        razorpay_order_id=m.razorpay_order_id,
        joined_at=m.joined_at,
        paid_at=m.paid_at
    )


def _format_group(g: GroupBooking) -> GroupBookingResponse:
    total_paise = int(round(g.total_amount * 100))
    members = [_format_member(m) for m in g.members]
    return GroupBookingResponse(
        id=g.id,
        group_code=g.group_code,
        showtime_id=g.showtime_id,
        host_user_id=g.host_user_id,
        status=g.status.value,
        timeout_policy=g.timeout_policy.value,
        invite_token=g.invite_token,
        invite_url=f"/booking/group/join?token={g.invite_token}",
        max_members=g.max_members,
        hold_id=g.hold_id,
        hold_expires_at=g.hold_expires_at,
        hold_extended_count=g.hold_extended_count,
        total_amount=g.total_amount,
        total_amount_paise=total_paise,
        members=members,
        created_at=g.created_at
    )


@router.post("", response_model=GroupBookingResponse, status_code=status.HTTP_201_CREATED)
async def create_group(
    req: CreateGroupRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Host creates a new group booking session."""
    group = await GroupBookingService.create_group_session(
        db=db,
        user=current_user,
        showtime_id=req.showtime_id,
        timeout_policy=req.timeout_policy,
        max_members=req.max_members
    )
    stmt = select(GroupBooking).where(GroupBooking.id == group.id).options(
        selectinload(GroupBooking.members).selectinload(GroupMember.user)
    )
    loaded = (await db.execute(stmt)).scalars().first()
    return _format_group(loaded)


@router.post("/join", response_model=GroupBookingResponse)
async def join_group(
    req: JoinGroupRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Member joins an existing group using the invite token."""
    group, _ = await GroupBookingService.join_group_by_token(
        db=db,
        user=current_user,
        invite_token=req.invite_token
    )
    stmt = select(GroupBooking).where(GroupBooking.id == group.id).options(
        selectinload(GroupBooking.members).selectinload(GroupMember.user)
    )
    loaded = (await db.execute(stmt)).scalars().first()
    return _format_group(loaded)


@router.get("/{group_code}", response_model=GroupBookingResponse)
async def get_group_details(
    group_code: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get active group booking state by group code or numeric group id."""
    if group_code.isdigit():
        stmt = (
            select(GroupBooking)
            .where(GroupBooking.id == int(group_code))
            .options(selectinload(GroupBooking.members).selectinload(GroupMember.user))
        )
    else:
        stmt = (
            select(GroupBooking)
            .where(GroupBooking.group_code == group_code)
            .options(selectinload(GroupBooking.members).selectinload(GroupMember.user))
        )
    group = (await db.execute(stmt)).scalars().first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    is_member = any(m.user_id == current_user.id for m in group.members)
    if not is_member and group.host_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied: You are not a member of this group")

    return _format_group(group)


@router.post("/{group_id}/propose-seats", response_model=GroupMemberResponse)
async def propose_seats(
    group_id: int,
    req: ProposeSeatsRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Member proposes their desired seats in real time."""
    member = await GroupBookingService.propose_seats(
        db=db,
        group_id=group_id,
        user_id=current_user.id,
        seat_ids=req.seat_ids
    )
    await group_ws_manager.broadcast_to_group(group_id, {
        "type": "SEATS_PROPOSED",
        "user_id": current_user.id,
        "seat_ids": req.seat_ids
    })
    stmt = select(GroupMember).where(GroupMember.id == member.id).options(selectinload(GroupMember.user))
    loaded = (await db.execute(stmt)).scalars().first()
    return _format_member(loaded)


@router.post("/{group_id}/confirm", response_model=GroupBookingResponse)
async def confirm_selection(
    group_id: int,
    req: ConfirmSelectionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Host confirms final seat allocations and initiates hold."""
    group = await GroupBookingService.host_confirm_selection_and_hold(
        db=db,
        group_id=group_id,
        host_user=current_user,
        seat_allocations=req.seat_allocations,
        share_amounts_paise=req.share_amounts_paise
    )
    stmt = select(GroupBooking).where(GroupBooking.id == group.id).options(
        selectinload(GroupBooking.members).selectinload(GroupMember.user)
    )
    loaded = (await db.execute(stmt)).scalars().first()
    return _format_group(loaded)


@router.post("/{group_id}/extend", response_model=ExtendHoldResponse)
async def extend_hold(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Host extends the group hold window (max 1 extension allowed)."""
    group = await GroupBookingService.extend_group_hold(
        db=db,
        group_id=group_id,
        host_user=current_user
    )
    return ExtendHoldResponse(
        success=True,
        hold_expires_at=group.hold_expires_at,
        hold_extended_count=group.hold_extended_count,
        message="Group hold extended by 5 minutes successfully"
    )


@router.post("/{group_id}/order")
async def create_member_order(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Generate Razorpay order for member's allocated share."""
    order_data = await GroupBookingService.create_member_order(
        db=db,
        group_id=group_id,
        user_id=current_user.id
    )
    return order_data


@router.post("/{group_id}/pay-share", response_model=GroupBookingResponse)
async def pay_share(
    group_id: int,
    req: RecordPaymentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Records member payment capture and checks all state invariants."""
    group, _ = await GroupBookingService.record_member_payment(
        db=db,
        group_id=group_id,
        user_id=current_user.id,
        payment_id=req.payment_id,
        amount_paise=req.amount_paise
    )
    stmt = select(GroupBooking).where(GroupBooking.id == group.id).options(
        selectinload(GroupBooking.members).selectinload(GroupMember.user)
    )
    loaded = (await db.execute(stmt)).scalars().first()
    return _format_group(loaded)


@router.post("/{group_id}/timeout", response_model=GroupBookingResponse)
async def trigger_timeout(
    group_id: int,
    force: bool = Query(False),
    db: AsyncSession = Depends(get_db)
):
    """Applies timeout policy: AUTO_REFUND releases seats and refunds; HOST_COVERS attempts remainder charge."""
    group = await GroupBookingService.handle_group_timeout(db=db, group_id=group_id, force=force)
    stmt = select(GroupBooking).where(GroupBooking.id == group.id).options(
        selectinload(GroupBooking.members).selectinload(GroupMember.user)
    )
    loaded = (await db.execute(stmt)).scalars().first()
    return _format_group(loaded)


@router.get("/{group_id}/tickets", response_model=List[GroupTicketResponse])
async def get_tickets(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve individual QR tickets for confirmed group members."""
    tickets = await GroupBookingService.get_member_tickets(
        db=db,
        group_id=group_id,
        user_id=current_user.id
    )
    return tickets


@router.post("/{group_id}/revoke-invite")
async def revoke_invite(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Host revokes the group invite token."""
    stmt = select(GroupBooking).where(GroupBooking.id == group_id)
    group = (await db.execute(stmt)).scalars().first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if group.host_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only host can revoke invite link")

    group.is_invite_revoked = True
    await db.commit()
    return {"success": True, "message": "Invite link has been revoked"}


@router.websocket("/ws/{group_id}")
async def group_selection_websocket(
    websocket: WebSocket,
    group_id: int,
    token: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """WebSocket for live cursor, proposed seat updates, and member presence in 2D and 3D."""
    from app.services.auth_service import decode_access_token
    user_meta = {"user_id": 0, "name": "Guest", "initials": "G", "color": "#E50914"}
    if token:
        try:
            payload = decode_access_token(token)
            if payload and "sub" in payload:
                user_id = int(payload["sub"])
                u = await db.get(User, user_id)
                if u:
                    user_meta = {
                        "user_id": u.id,
                        "name": u.full_name or u.email,
                        "initials": _initials(u.full_name, u.email),
                        "color": "#E50914"
                    }
        except Exception:
            pass

    await group_ws_manager.connect(websocket, group_id, user_meta)
    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            if msg_type in ["HOVER_SEAT", "SELECT_SEAT", "PROPOSE_SEAT", "VIEW_MODE_CHANGE"]:
                await group_ws_manager.broadcast_to_group(group_id, {
                    "type": msg_type,
                    "user": user_meta,
                    "payload": data.get("payload", {})
                })
    except WebSocketDisconnect:
        meta = group_ws_manager.disconnect(websocket, group_id)
        if meta:
            await group_ws_manager.broadcast_to_group(group_id, {
                "type": "PRESENCE_LEAVE",
                "user": meta
            })
