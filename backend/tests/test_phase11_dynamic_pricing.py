import pytest
import inspect
from datetime import datetime, timedelta
from sqlalchemy import select
from app.models.auth import User, RoleEnum
from app.models.showtime import Showtime, SeatInventory, SeatStatusEnum
from app.models.dynamic_pricing import DynamicPricingRule, PricingRuleStatusEnum, PriceAuditLog
from app.services.dynamic_pricing_service import (
    calculate_rule_price,
    evaluate_showtime_pricing,
    apply_pricing_rules_to_showtime,
    simulate_pricing_rule
)


def test_zero_per_user_attribute_invariant():
    """Security Invariant: No user identifier, demographic, or tracking attribute

    may enter the pricing calculation.
    """
    sig = inspect.signature(calculate_rule_price)
    params = list(sig.parameters.keys())
    assert params == ["base_price", "rule"], f"Unexpected parameters in calculate_rule_price: {params}"

    sig_eval = inspect.signature(evaluate_showtime_pricing)
    params_eval = list(sig_eval.parameters.keys())
    assert "user" not in params_eval
    assert "user_id" not in params_eval
    assert "demographics" not in params_eval
    assert "device" not in params_eval
    assert params_eval == ["db", "showtime", "base_price", "category"]


def test_strict_floor_and_ceiling_bounds():
    """Rules cannot exceed floor or ceiling under extreme multipliers."""
    rule = DynamicPricingRule(
        name="Surge Test",
        floor_price=120.0,
        ceiling_price=450.0,
        price_multiplier=10.0,  # 10x surge
        flat_adjustment=500.0
    )
    # 200 * 10 + 500 = 2500 -> must clamp to ceiling (450.0)
    clamped_high = calculate_rule_price(200.0, rule)
    assert clamped_high == 450.0

    discount_rule = DynamicPricingRule(
        name="Dip Test",
        floor_price=120.0,
        ceiling_price=450.0,
        price_multiplier=0.1,  # 90% discount
        flat_adjustment=-100.0
    )
    # 150 * 0.1 - 100 = -85 -> must clamp to floor (120.0)
    clamped_low = calculate_rule_price(150.0, discount_rule)
    assert clamped_low == 120.0


@pytest.mark.asyncio
async def test_dynamic_pricing_lifecycle_and_audit(db_session):
    admin = await db_session.get(User, 1)

    # 1. Create rule in DRAFT
    rule = DynamicPricingRule(
        name="Peak Occupancy Surge",
        format="IMAX 3D",
        min_occupancy_pct=50.0,
        max_occupancy_pct=100.0,
        price_multiplier=1.20,
        flat_adjustment=0.0,
        floor_price=150.0,
        ceiling_price=550.0,
        status=PricingRuleStatusEnum.DRAFT,
        created_by_admin_id=admin.id
    )
    db_session.add(rule)
    await db_session.commit()
    await db_session.refresh(rule)

    assert rule.status == PricingRuleStatusEnum.DRAFT
    assert rule.approved_at is None

    # 2. Approve rule
    rule.status = PricingRuleStatusEnum.ACTIVE
    rule.approved_by_admin_id = admin.id
    rule.approved_at = datetime.utcnow()
    audit = PriceAuditLog(
        rule_id=rule.id,
        action="RULE_APPROVED",
        admin_id=admin.id,
        details={"name": rule.name}
    )
    db_session.add(audit)
    await db_session.commit()

    assert rule.status == PricingRuleStatusEnum.ACTIVE
    assert rule.approved_by_admin_id == admin.id


@pytest.mark.asyncio
async def test_pricing_never_modifies_held_or_booked_seats(db_session):
    admin = await db_session.get(User, 1)
    st = await db_session.get(Showtime, 1)
    st.start_time = datetime.utcnow() + timedelta(days=1)

    # Activate a surge rule
    rule = DynamicPricingRule(
        name="Active Surge",
        min_occupancy_pct=0.0,
        max_occupancy_pct=100.0,
        price_multiplier=1.5,
        floor_price=100.0,
        ceiling_price=800.0,
        status=PricingRuleStatusEnum.ACTIVE,
        approved_by_admin_id=admin.id
    )
    db_session.add(rule)

    # Set seat A01 to BOOKED with price 250.0, and A02 to HELD with price 250.0
    seats_res = await db_session.execute(
        select(SeatInventory).where(SeatInventory.showtime_id == 1, SeatInventory.seat_id.in_(["A01", "A02", "A03"]))
    )
    seats = {s.seat_id: s for s in seats_res.scalars().all()}

    seats["A01"].status = SeatStatusEnum.BOOKED
    seats["A01"].price = 250.0

    seats["A02"].status = SeatStatusEnum.HELD
    seats["A02"].price = 250.0

    seats["A03"].status = SeatStatusEnum.AVAILABLE
    seats["A03"].price = 250.0

    await db_session.commit()

    # Apply pricing rules
    res = await apply_pricing_rules_to_showtime(db_session, showtime_id=1, admin_user=admin)

    await db_session.refresh(seats["A01"])
    await db_session.refresh(seats["A02"])
    await db_session.refresh(seats["A03"])

    # INVARIANT: Booked and held seat prices must remain strictly 250.0!
    assert seats["A01"].price == 250.0
    assert seats["A02"].price == 250.0

    # Available seat A03 gets dynamically adjusted from base_price (280.0 * 1.5 = 420.0)
    assert seats["A03"].price == 420.0


@pytest.mark.asyncio
async def test_simulation_preview(db_session):
    spec = {
        "name": "Simulation Test",
        "floor_price": 100.0,
        "ceiling_price": 400.0,
        "price_multiplier": 1.25,
        "flat_adjustment": 10.0,
        "min_occupancy_pct": 0.0,
        "max_occupancy_pct": 100.0
    }
    result = await simulate_pricing_rule(db_session, spec)
    assert result["floor_enforced"] is False
    assert result["rule_preview"]["price_multiplier"] == 1.25
    assert len(result["price_simulation"]) > 0
    # 250 * 1.25 + 10 = 322.5
    match_250 = next(r for r in result["price_simulation"] if r["base_price"] == 250.0)
    assert match_250["simulated_price"] == 322.5
