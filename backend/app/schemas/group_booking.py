from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime


class CreateGroupRequest(BaseModel):
    showtime_id: int
    timeout_policy: str = Field(default="AUTO_REFUND", description="HOST_COVERS or AUTO_REFUND")
    max_members: int = Field(default=8, ge=2, le=8)


class ProposeSeatsRequest(BaseModel):
    seat_ids: List[str] = Field(..., min_items=1)


class AssignSharesRequest(BaseModel):
    # Member user_id mapped to amount in paise
    shares: Dict[int, int]


class JoinGroupRequest(BaseModel):
    invite_token: str


class ConfirmSelectionRequest(BaseModel):
    seat_allocations: Dict[int, List[str]]
    share_amounts_paise: Optional[Dict[int, int]] = None


class RecordPaymentRequest(BaseModel):
    payment_id: str
    amount_paise: int


class ExtendHoldResponse(BaseModel):
    success: bool
    hold_expires_at: datetime
    hold_extended_count: int
    message: str


class GroupTicketResponse(BaseModel):
    member_id: int
    user_id: int
    user_name: str
    ticket_number: str
    seats: List[str]
    qr_data: str
    qr_code_url: Optional[str] = None
    movie_title: str
    cinema_name: str
    show_time: datetime
    is_paid: bool


class GroupMemberResponse(BaseModel):
    id: int
    user_id: int
    user_name: str
    user_email: str
    role: str
    color: str
    initials: str
    proposed_seats: List[str]
    assigned_seats: List[str]
    share_amount: float
    share_amount_paise: int
    payment_status: str
    razorpay_order_id: Optional[str] = None
    joined_at: datetime
    paid_at: Optional[datetime] = None


class GroupBookingResponse(BaseModel):
    id: int
    group_code: str
    showtime_id: int
    host_user_id: int
    status: str
    timeout_policy: str
    invite_token: str
    invite_url: str
    max_members: int
    hold_id: Optional[str] = None
    hold_expires_at: Optional[datetime] = None
    hold_extended_count: int = 0
    total_amount: float
    total_amount_paise: int
    members: List[GroupMemberResponse]
    created_at: datetime
