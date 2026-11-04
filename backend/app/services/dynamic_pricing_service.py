import logging
from datetime import datetime
from typing import Optional, Dict, Any, List
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, update
from sqlalchemy.orm import selectinload

from app.models.showtime import Showtime, SeatInventory, SeatStatusEnum
from app.models.dynamic_pricing import DynamicPricingRule, PricingRuleStatusEnum, PriceAuditLog
from app.models.auth import User, RoleEnum

logger = logging.getLogger("cineverse.pricing")


def calculate_rule_price(
    base_price: float,
    rule: DynamicPricingRule
) -> float:
    """Computes transparent price under a single rule with strict hard floor/ceiling enforcement.

    INVARIANT: Absolutely zero personal data or user attributes enter this calculation.
    """
    raw_price = (base_price * rule.price_multiplier) + rule.flat_adjustment
    # Strictly clamp to floor and ceiling
    bounded_price = max(rule.floor_price, min(rule.ceiling_price, raw_price))
    return round(bounded_price, 2)


async def evaluate_showtime_pricing(
    db: AsyncSession,
    showtime: Showtime,
    base_price: float,
    category: str
) -> Dict[str, Any]:
    """Evaluates active approved pricing rules for a showtime based purely on context.

    INVARIANT: No user identity or tracking parameters allowed.
    """
    now = datetime.utcnow()
    hours_until_show = (showtime.start_time - now).total_seconds() / 3600.0

    # Calculate current showtime occupancy from inventory
    total_seats = len(showtime.seat_inventory) if showtime.seat_inventory else 100
    booked_or_held = sum(
        1 for s in (showtime.seat_inventory or [])
        if s.status in [SeatStatusEnum.BOOKED, SeatStatusEnum.HELD, SeatStatusEnum.PAYMENT_PENDING]
    )
    occupancy_pct = (booked_or_held / total_seats * 100.0) if total_seats > 0 else 0.0

    # Day type: weekend is Friday evening (>=17:00), Saturday, Sunday
    weekday = showtime.start_time.weekday()  # Monday is 0, Sunday is 6
    is_weekend = (weekday in [5, 6]) or (weekday == 4 and showtime.start_time.hour >= 17)
    day_type_match = "weekend" if is_weekend else "weekday"

    # Fetch active approved rules
    stmt = (
        select(DynamicPricingRule)
        .where(
            DynamicPricingRule.status == PricingRuleStatusEnum.ACTIVE,
            DynamicPricingRule.min_occupancy_pct <= occupancy_pct,
            DynamicPricingRule.max_occupancy_pct >= occupancy_pct
        )
    )
    res = await db.execute(stmt)
    candidate_rules = res.scalars().all()

    applied_rule: Optional[DynamicPricingRule] = None
    final_price = base_price

    for rule in candidate_rules:
        # Check cinema filter
        if rule.cinema_id is not None and rule.cinema_id != showtime.cinema_id:
            continue
        # Check format filter
        if rule.format is not None and rule.format.lower() != (showtime.format or "").lower():
            continue
        # Check day_type filter
        if rule.day_type != "all" and rule.day_type != day_type_match:
            continue
        # Check hours before show
        if rule.hours_before_show_min is not None and hours_until_show < rule.hours_before_show_min:
            continue
        if rule.hours_before_show_max is not None and hours_until_show > rule.hours_before_show_max:
            continue

        # Rule matches
        applied_rule = rule
        final_price = calculate_rule_price(base_price, rule)
        break

    return {
        "base_price": base_price,
        "final_price": final_price,
        "occupancy_pct": round(occupancy_pct, 1),
        "hours_until_show": round(hours_until_show, 1),
        "rule_applied": applied_rule.name if applied_rule else None,
        "rule_id": applied_rule.id if applied_rule else None,
        "floor_enforced": final_price == applied_rule.floor_price if applied_rule else False,
        "ceiling_enforced": final_price == applied_rule.ceiling_price if applied_rule else False
    }


async def apply_pricing_rules_to_showtime(
    db: AsyncSession,
    showtime_id: int,
    admin_user: User
) -> Dict[str, Any]:
    """Updates prices for AVAILABLE (unheld, unbooked) seats only.

    INVARIANT: Never modifies seats already held or booked.
    """
    stmt = (
        select(Showtime)
        .where(Showtime.id == showtime_id)
        .options(
            selectinload(Showtime.seat_inventory),
            selectinload(Showtime.price_rules)
        )
    )
    res = await db.execute(stmt)
    showtime = res.scalars().first()
    if not showtime:
        raise HTTPException(status_code=404, detail="Showtime not found")

    base_prices = {pr.category.lower(): pr.base_price for pr in showtime.price_rules}
    updated_count = 0

    for inv in showtime.seat_inventory:
        # INVARIANT: Only update AVAILABLE seats
        if inv.status != SeatStatusEnum.AVAILABLE:
            continue

        base_p = base_prices.get(inv.category.lower(), inv.price)
        pricing_eval = await evaluate_showtime_pricing(db, showtime, base_p, inv.category)
        if inv.price != pricing_eval["final_price"]:
            inv.price = pricing_eval["final_price"]
            updated_count += 1

    # Record audit log
    audit = PriceAuditLog(
        rule_id=None,
        action="PRICING_APPLIED",
        admin_id=admin_user.id,
        details={
            "showtime_id": showtime_id,
            "updated_seats_count": updated_count
        }
    )
    db.add(audit)
    await db.commit()

    return {
        "showtime_id": showtime_id,
        "updated_seats_count": updated_count,
        "message": f"Updated pricing on {updated_count} available seats."
    }


async def simulate_pricing_rule(
    db: AsyncSession,
    rule_spec: Dict[str, Any],
    sample_showtime_ids: Optional[List[int]] = None
) -> Dict[str, Any]:
    """Simulates a proposed rule without persisting, verifying floor and ceiling constraints."""
    floor = float(rule_spec.get("floor_price", 150.0))
    ceiling = float(rule_spec.get("ceiling_price", 600.0))
    multiplier = float(rule_spec.get("price_multiplier", 1.0))
    flat_adj = float(rule_spec.get("flat_adjustment", 0.0))

    if floor >= ceiling:
        raise HTTPException(status_code=400, detail="floor_price must be strictly less than ceiling_price")

    dummy_rule = DynamicPricingRule(
        name=rule_spec.get("name", "Simulation"),
        floor_price=floor,
        ceiling_price=ceiling,
        price_multiplier=multiplier,
        flat_adjustment=flat_adj,
        min_occupancy_pct=float(rule_spec.get("min_occupancy_pct", 0.0)),
        max_occupancy_pct=float(rule_spec.get("max_occupancy_pct", 100.0)),
        day_type=rule_spec.get("day_type", "all"),
        format=rule_spec.get("format")
    )

    # Test sample base prices
    test_prices = [150.0, 250.0, 350.0, 500.0]
    simulation_results = []

    for bp in test_prices:
        sim_price = calculate_rule_price(bp, dummy_rule)
        simulation_results.append({
            "base_price": bp,
            "simulated_price": sim_price,
            "delta": round(sim_price - bp, 2),
            "pct_change": round(((sim_price - bp) / bp) * 100.0, 1),
            "hit_floor": sim_price == floor,
            "hit_ceiling": sim_price == ceiling
        })

    return {
        "rule_preview": {
            "name": dummy_rule.name,
            "floor_price": floor,
            "ceiling_price": ceiling,
            "price_multiplier": multiplier,
            "flat_adjustment": flat_adj
        },
        "price_simulation": simulation_results,
        "floor_enforced": any(r["hit_floor"] for r in simulation_results),
        "ceiling_enforced": any(r["hit_ceiling"] for r in simulation_results)
    }

