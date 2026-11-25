"""Group split-payment state machine (Phase 10). Pure reducer in Python.

Matches frontend/lib/groupPayment.ts behavior exactly:
(state, event) -> (state, [effects])

Rules enforced here:
1. A booking is never confirmed unless the exact total has been captured.
2. Duplicate events (by event id AND payment id) are no-ops.
3. Payments that arrive too late / wrong amount / unknown member are refunded.
4. Every captured paisa is either kept for the confirmed booking or refund-requested (conservation).
"""
import copy
from typing import Dict, List, Literal, Optional, Tuple, Any, Set
from dataclasses import dataclass, field

Phase = Literal["HELD", "PARTIALLY_PAID", "HOST_COVER_PENDING", "CONFIRMED", "EXPIRED", "CANCELLED"]
Policy = Literal["host_covers", "refund_all"]
ShareStatus = Literal["UNPAID", "PAID", "REFUND_PENDING", "REFUNDED"]


@dataclass
class Share:
    member_id: str
    amount: int  # Paise
    status: ShareStatus = "UNPAID"
    payment_id: Optional[str] = None


@dataclass
class Effect:
    kind: Literal["confirmBooking", "releaseSeats", "extendHold", "refund", "chargeHost", "notify"]
    payment_id: Optional[str] = None
    amount: Optional[int] = None
    reason: Optional[str] = None
    seconds: Optional[int] = None
    what: Optional[str] = None


@dataclass
class GroupEvent:
    id: str
    type: Literal[
        "PAYMENT_CAPTURED", "PAYMENT_FAILED", "HOLD_EXPIRED",
        "HOST_COVER_CAPTURED", "HOST_COVER_FAILED", "CANCEL", "REFUND_COMPLETED"
    ]
    member_id: Optional[str] = None
    payment_id: Optional[str] = None
    amount: Optional[int] = None
    by_member_id: Optional[str] = None


@dataclass
class GroupState:
    phase: Phase
    total: int  # Paise
    policy: Policy
    host_id: str
    shares: Dict[str, Share]
    seats_held: bool = True
    seats_booked: bool = False
    host_cover_due: int = 0
    host_cover_amount: int = 0
    host_cover_payment_id: Optional[str] = None
    captured_total: int = 0
    refund_requested: int = 0
    processed_events: List[str] = field(default_factory=list)
    seen_payments: List[str] = field(default_factory=list)
    confirm_emitted: bool = False


def create_group(
    host_id: str,
    shares: List[Dict[str, Any]],
    policy: Policy = "refund_all"
) -> GroupState:
    """Creates a new initial GroupState."""
    member_ids = [s["member_id"] for s in shares]
    if host_id not in member_ids:
        raise ValueError("host must hold a share")
    if len(set(member_ids)) != len(shares):
        raise ValueError("duplicate member")
    for s in shares:
        amt = s["amount"]
        if not isinstance(amt, int) or amt <= 0:
            raise ValueError("share must be a positive integer in paise")

    total = sum(s["amount"] for s in shares)
    shares_dict = {
        s["member_id"]: Share(member_id=s["member_id"], amount=s["amount"], status="UNPAID")
        for s in shares
    }
    return GroupState(
        phase="HELD",
        total=total,
        policy=policy,
        host_id=host_id,
        shares=shares_dict,
        seats_held=True,
        seats_booked=False,
        host_cover_due=0,
        host_cover_amount=0,
        captured_total=0,
        refund_requested=0,
        processed_events=[],
        seen_payments=[],
        confirm_emitted=False,
    )


def is_terminal(p: Phase) -> bool:
    return p in ("CONFIRMED", "EXPIRED", "CANCELLED")


def refund_all_paid(s: GroupState, fx: List[Effect], reason: str) -> None:
    for sh in s.shares.values():
        if sh.status == "PAID" and sh.payment_id:
            sh.status = "REFUND_PENDING"
            s.refund_requested += sh.amount
            fx.append(Effect(kind="refund", payment_id=sh.payment_id, amount=sh.amount, reason=reason))
    if s.host_cover_payment_id and s.host_cover_amount > 0:
        s.refund_requested += s.host_cover_amount
        fx.append(Effect(kind="refund", payment_id=s.host_cover_payment_id, amount=s.host_cover_amount, reason=reason))
        s.host_cover_amount = 0


def end_bad(s: GroupState, phase: Literal["EXPIRED", "CANCELLED"], fx: List[Effect], reason: str) -> None:
    refund_all_paid(s, fx, reason)
    s.phase = phase
    if s.seats_held:
        s.seats_held = False
        fx.append(Effect(kind="releaseSeats"))
    fx.append(Effect(kind="notify", what=phase.lower()))


def try_confirm(s: GroupState, fx: List[Effect]) -> None:
    if s.confirm_emitted or s.phase == "CONFIRMED":
        return
    all_shares = list(s.shares.values())
    paid = sum(sh.amount for sh in all_shares if sh.status == "PAID")
    if all(sh.status == "PAID" for sh in all_shares) and paid == s.total:
        s.phase = "CONFIRMED"
        s.seats_booked = True
        s.seats_held = False
        s.confirm_emitted = True
        fx.append(Effect(kind="confirmBooking"))
        fx.append(Effect(kind="notify", what="confirmed"))


def unpaid_amount_at_cover(s: GroupState) -> int:
    return s.total - sum(sh.amount for sh in s.shares.values() if sh.status == "PAID")


def reduce(prev: GroupState, e: GroupEvent) -> Tuple[GroupState, List[Effect]]:
    """Pure transition function: (state, event) -> (new_state, effects)."""
    s = copy.deepcopy(prev)
    fx: List[Effect] = []

    # Idempotent by event ID
    if e.id in s.processed_events:
        return prev, []
    s.processed_events.append(e.id)

    if e.type == "PAYMENT_CAPTURED":
        # Idempotent by payment ID (same payment under new event id)
        if e.payment_id in s.seen_payments:
            return s, []
        s.seen_payments.append(e.payment_id)
        s.captured_total += (e.amount or 0)

        sh = s.shares.get(e.member_id) if e.member_id else None

        def refund(reason: str):
            s.refund_requested += (e.amount or 0)
            fx.append(Effect(kind="refund", payment_id=e.payment_id, amount=e.amount, reason=reason))

        if is_terminal(s.phase) or s.phase == "HOST_COVER_PENDING":
            refund("late payment")
        elif not sh:
            refund("unknown member")
        elif sh.status != "UNPAID":
            refund("duplicate share payment")
        elif e.amount != sh.amount:
            refund("amount mismatch")
        else:
            sh.status = "PAID"
            sh.payment_id = e.payment_id
            s.phase = "PARTIALLY_PAID"
            try_confirm(s, fx)

    elif e.type == "PAYMENT_FAILED":
        fx.append(Effect(kind="notify", what="payment_failed"))

    elif e.type == "HOLD_EXPIRED":
        if not is_terminal(s.phase) and s.phase != "HOST_COVER_PENDING":
            if s.policy == "host_covers" and any(x.status == "PAID" for x in s.shares.values()):
                s.phase = "HOST_COVER_PENDING"
                due = unpaid_amount_at_cover(s)
                fx.append(Effect(kind="extendHold", seconds=120))
                fx.append(Effect(kind="chargeHost", amount=due))
                s.host_cover_amount = 0
                s.host_cover_due = due
            else:
                end_bad(s, "EXPIRED", fx, "group hold expired")

    elif e.type == "HOST_COVER_CAPTURED":
        if e.payment_id in s.seen_payments:
            return s, []
        s.seen_payments.append(e.payment_id)
        s.captured_total += (e.amount or 0)
        due = s.host_cover_due

        if s.phase != "HOST_COVER_PENDING" or due <= 0 or e.amount != due:
            s.refund_requested += (e.amount or 0)
            fx.append(Effect(kind="refund", payment_id=e.payment_id, amount=e.amount, reason="unexpected host cover"))
        else:
            s.host_cover_amount = (e.amount or 0)
            s.host_cover_payment_id = e.payment_id
            s.phase = "CONFIRMED"
            s.seats_booked = True
            s.seats_held = False
            s.confirm_emitted = True
            fx.append(Effect(kind="confirmBooking"))
            fx.append(Effect(kind="notify", what="confirmed"))

    elif e.type == "HOST_COVER_FAILED":
        if s.phase == "HOST_COVER_PENDING":
            end_bad(s, "EXPIRED", fx, "host cover failed")

    elif e.type == "CANCEL":
        if e.by_member_id == s.host_id and not is_terminal(s.phase):
            end_bad(s, "CANCELLED", fx, "cancelled by host")

    elif e.type == "REFUND_COMPLETED":
        for sh in s.shares.values():
            if sh.payment_id == e.payment_id and sh.status == "REFUND_PENDING":
                sh.status = "REFUNDED"

    return s, fx


def check_invariants(s: GroupState, all_effects: List[Effect]) -> List[str]:
    """Returns a list of violated invariants (empty = healthy)."""
    bad: List[str] = []
    confirms = sum(1 for x in all_effects if x.kind == "confirmBooking")
    paid = sum(sh.amount for sh in s.shares.values() if sh.status == "PAID")

    if confirms > 1:
        bad.append("confirmBooking emitted more than once")
    if s.phase == "CONFIRMED" and paid + s.host_cover_amount != s.total:
        bad.append("confirmed without exact total")
    if s.phase == "CONFIRMED" and confirms != 1:
        bad.append("confirmed without exactly one confirm effect")
    if s.phase != "CONFIRMED" and confirms > 0:
        bad.append("confirm effect emitted but not confirmed")
    if s.refund_requested > s.captured_total:
        bad.append("refunds exceed captured money")

    kept = s.captured_total - s.refund_requested
    if s.phase == "CONFIRMED" and kept != s.total:
        bad.append(f"kept {kept} != total {s.total}")
    if (s.phase == "EXPIRED" or s.phase == "CANCELLED") and kept != 0:
        bad.append("terminal-bad state still holds money")
    if not is_terminal(s.phase) and s.phase != "HOST_COVER_PENDING" and not s.seats_held:
        bad.append("seats released while still active")
    if (s.phase == "EXPIRED" or s.phase == "CANCELLED") and (s.seats_held or s.seats_booked):
        bad.append("bad terminal state keeps seats")
    if s.phase == "CONFIRMED" and not s.seats_booked:
        bad.append("confirmed but seats not booked")
    if any(x.kind == "releaseSeats" for x in all_effects) and s.phase == "CONFIRMED":
        bad.append("seats released and confirmed")

    return bad

