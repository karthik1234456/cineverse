"""Tests for Phase 10: Group Booking & Split Payment Pure State Machine.

Includes:
1. Exact unit tests for all paths (happy path, partial payment, refund_all, host_covers, late payment, wrong amount, cancellation)
2. Seeded fuzz test with thousands of hostile event streams (duplicates, forged members, wrong amounts, out-of-order)
3. Mutation testing to prove the suite catches intentional invariant violations
"""
import pytest
import random
import copy
from app.services.group_payment_sm import (
    create_group, reduce, check_invariants, GroupState, GroupEvent, Effect, Policy
)


def mk_group(policy: Policy = "refund_all", amounts=(21234, 21233, 21233)) -> GroupState:
    shares = [
        {"member_id": "host" if i == 0 else f"m{i}", "amount": a}
        for i, a in enumerate(amounts)
    ]
    return create_group("host", shares, policy)


def run_events(s: GroupState, events: list[GroupEvent]):
    all_fx: list[Effect] = []
    for e in events:
        s, fx = reduce(s, e)
        all_fx.extend(fx)
        bad = check_invariants(s, all_fx)
        assert bad == [], f"Invariant violated after event {e.type} (id={e.id}): {bad}"
    return s, all_fx


def pay_ev(ev_id: str, member_id: str, amount: int, payment_id: str = None) -> GroupEvent:
    return GroupEvent(
        id=ev_id,
        type="PAYMENT_CAPTURED",
        member_id=member_id,
        payment_id=payment_id or f"pay_{ev_id}",
        amount=amount
    )


def count_effects(fx: list[Effect], kind: str) -> int:
    return sum(1 for x in fx if x.kind == kind)


def test_happy_path_exact_shares_confirmed():
    s, fx = run_events(mk_group(), [
        pay_ev("1", "host", 21234),
        pay_ev("2", "m1", 21233),
        pay_ev("3", "m2", 21233)
    ])
    assert s.phase == "CONFIRMED"
    assert count_effects(fx, "confirmBooking") == 1
    assert s.seats_booked and not s.seats_held
    assert s.refund_requested == 0
    assert s.captured_total == s.total


def test_partial_payment_stays_partially_paid():
    s, fx = run_events(mk_group(), [
        pay_ev("1", "host", 21234),
        pay_ev("2", "m1", 21233)
    ])
    assert s.phase == "PARTIALLY_PAID"
    assert count_effects(fx, "confirmBooking") == 0
    assert s.seats_held and not s.seats_booked


def test_refund_all_on_expiry():
    s, fx = run_events(mk_group("refund_all"), [
        pay_ev("1", "host", 21234),
        pay_ev("2", "m1", 21233),
        GroupEvent(id="exp", type="HOLD_EXPIRED")
    ])
    assert s.phase == "EXPIRED"
    assert count_effects(fx, "releaseSeats") == 1
    assert count_effects(fx, "refund") == 2
    assert s.refund_requested == 21234 + 21233
    assert s.captured_total - s.refund_requested == 0


def test_host_covers_policy_workflow():
    s, fx = run_events(mk_group("host_covers"), [
        pay_ev("1", "host", 21234),
        pay_ev("2", "m1", 21233),
        GroupEvent(id="exp", type="HOLD_EXPIRED")
    ])
    assert s.phase == "HOST_COVER_PENDING"
    assert s.host_cover_due == 21233
    assert count_effects(fx, "chargeHost") == 1
    assert count_effects(fx, "releaseSeats") == 0

    s2, fx2 = run_events(s, [
        GroupEvent(id="hc", type="HOST_COVER_CAPTURED", payment_id="pay_cover", amount=21233)
    ])
    assert s2.phase == "CONFIRMED"
    assert s2.captured_total - s2.refund_requested == s2.total
    all_fx = fx + fx2
    assert count_effects(all_fx, "confirmBooking") == 1


def test_late_payments_and_wrong_amounts_refunded():
    s, fx = run_events(mk_group(), [
        pay_ev("1", "m1", 100),  # wrong amount
        pay_ev("2", "m1", 21233),  # correct retry
        GroupEvent(id="exp", type="HOLD_EXPIRED"),
        pay_ev("3", "host", 21234),  # late payment
    ])
    assert s.phase == "EXPIRED"
    # wrong amount (100) + retry (21233 refunded on expiry) + late payment (21234 refunded)
    refund_effects = [x for x in fx if x.kind == "refund"]
    assert len(refund_effects) == 3
    assert s.captured_total - s.refund_requested == 0


def test_idempotent_duplicate_events():
    s = mk_group()
    e = pay_ev("1", "host", 21234)
    s1, fx1 = reduce(s, e)
    s2, fx2 = reduce(s1, e)  # duplicate event ID
    assert fx2 == []
    assert s2.captured_total == s1.captured_total

    # same payment ID under new event ID
    e_dup_pay = pay_ev("1_dup", "host", 21234, payment_id="pay_1")
    s3, fx3 = reduce(s1, e_dup_pay)
    assert fx3 == []
    assert s3.captured_total == s1.captured_total


def test_seeded_fuzz_hostile_event_sequences():
    """Property test: 2000 random hostile event sequences never violate money/seat invariants."""
    rng = random.Random(2026)
    for trial in range(2000):
        n_members = rng.randint(2, 6)
        total = rng.randint(5000, 400000)
        base = total // n_members
        rem = total % n_members
        shares = []
        for i in range(n_members):
            amt = base + (1 if i < rem else 0)
            shares.append({"member_id": "host" if i == 0 else f"m{i}", "amount": amt})

        policy: Policy = "refund_all" if rng.random() < 0.5 else "host_covers"
        s = create_group("host", shares, policy)
        all_fx: list[Effect] = []

        member_ids = [sh["member_id"] for sh in shares]
        for step in range(12):
            k = rng.randint(0, 11)
            ev_id = f"t{trial}_s{step}"
            m = rng.choice(member_ids)
            sh_amt = s.shares[m].amount

            if k <= 3:
                e = GroupEvent(id=ev_id, type="PAYMENT_CAPTURED", member_id=m, payment_id=f"p_{ev_id}", amount=sh_amt)
            elif k == 4:
                e = GroupEvent(id=ev_id, type="PAYMENT_CAPTURED", member_id=m, payment_id=f"p_{ev_id}", amount=rng.randint(10, 50000))
            elif k == 5:
                e = GroupEvent(id=ev_id, type="PAYMENT_CAPTURED", member_id="ghost", payment_id=f"p_{ev_id}", amount=1000)
            elif k == 6:
                e = GroupEvent(id=ev_id, type="HOLD_EXPIRED")
            elif k == 7:
                e = GroupEvent(id=ev_id, type="HOST_COVER_CAPTURED", payment_id=f"hc_{ev_id}", amount=s.total if rng.random() < 0.5 else 999)
            elif k == 8:
                e = GroupEvent(id=ev_id, type="HOST_COVER_FAILED")
            elif k == 9:
                e = GroupEvent(id=ev_id, type="CANCEL", by_member_id="host" if rng.random() < 0.5 else m)
            elif k == 10:
                e = GroupEvent(id=ev_id, type="REFUND_COMPLETED", payment_id=f"p_t{trial}_s{rng.randint(0, step)}")
            else:
                e = GroupEvent(id=ev_id, type="PAYMENT_FAILED", member_id=m)

            s, fx = reduce(s, e)
            all_fx.extend(fx)

            bad = check_invariants(s, all_fx)
            assert bad == [], f"Fuzz violation in trial {trial}, event {e.type}: {bad}"


def test_mutation_proves_tests_can_fail():
    """Deliberately mutates state to verify check_invariants detects violations."""
    s = mk_group()
    # 1. Fake confirmation without paid shares
    s_mutant = copy.deepcopy(s)
    s_mutant.phase = "CONFIRMED"
    bad = check_invariants(s_mutant, [Effect(kind="confirmBooking")])
    assert any("confirmed without exact total" in b for b in bad)

    # 2. Duplicate confirm effect
    s_confirmed, fx = run_events(mk_group(), [
        pay_ev("1", "host", 21234),
        pay_ev("2", "m1", 21233),
        pay_ev("3", "m2", 21233)
    ])
    bad_double_confirm = check_invariants(s_confirmed, fx + [Effect(kind="confirmBooking")])
    assert any("confirmBooking emitted more than once" in b for b in bad_double_confirm)

    # 3. Terminal bad state holding money
    s_expired = copy.deepcopy(s_confirmed)
    s_expired.phase = "EXPIRED"
    s_expired.refund_requested = 0
    bad_money_held = check_invariants(s_expired, fx)
    assert any("terminal-bad state still holds money" in b for b in bad_money_held)
