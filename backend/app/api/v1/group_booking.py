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
    JoinGroupRequest, GroupBookingResponse, GroupMemberResponse
)
from app.services.group_booking_service import GroupBookingService
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
    # Reload with members
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
    """Get active group booking state."""
    stmt = (
        select(GroupBooking)
        .where(GroupBooking.group_code == group_code)
        .options(selectinload(GroupBooking.members).selectinload(GroupMember.user))
    )
    group = (await db.execute(stmt)).scalars().first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Access control: user must be host or a member of this group
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
    # Broadcast to room
    await group_ws_manager.broadcast_to_group(group_id, {
        "type": "SEATS_PROPOSED",
        "user_id": current_user.id,
        "seat_ids": req.seat_ids
    })
    stmt = select(GroupMember).where(GroupMember.id == member.id).options(selectinload(GroupMember.user))
    loaded = (await db.execute(stmt)).scalars().first()
    return _format_member(loaded)


@router.websocket("/ws/{group_id}")
async def group_selection_websocket(
    websocket: WebSocket,
    group_id: int,
    token: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """WebSocket for live cursor, proposed seat updates, and member presence in 2D and 3D."""
    # Authenticate token or fallback
    from app.services.auth_service import decode_token
    user_meta = {"user_id": 0, "name": "Guest", "initials": "G", "color": "#E50914"}
    if token:
        try:
            payload = decode_token(token)
            if payload and "sub" in payload:
                user_id = int(payload["sub"])
                u = await db.get(User, user_id)
                if u:
                    user_meta = {
                        "user_id": u.id,
                        "name": u.name or u.email,
                        "initials": _initials(u.name, u.email),
                        "color": "#E50914"
                    }
        except Exception:
            pass

    await group_ws_manager.connect(websocket, group_id, user_meta)
    try:
        while True:
            data = await websocket.receive_json()
            # Broadcast user cursor/hover or seat update to the group room
            msg_type = data.get("type")
            if msg_type in ["HOVER_SEAT", "SELECT_SEAT", "VIEW_MODE_CHANGE"]:
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
