import pytest
from datetime import datetime, timedelta
from app.models.showtime import Showtime, SeatInventory, SeatStatusEnum
from app.models.waitlist import WaitlistEntry, WaitlistStatusEnum
from app.models.dynamic_pricing import DynamicPricingRule, PricingRuleStatusEnum
from app.services.insights_service import (
    get_occupancy_forecast,
    get_demand_alerts,
    get_revenue_impact_preview
)


@pytest.mark.asyncio
async def test_occupancy_forecast_explainable_model(db_session):
    st = await db_session.get(Showtime, 1)
    st.start_time = datetime.utcnow() + timedelta(days=2)
    await db_session.commit()

    forecast = await get_occupancy_forecast(db_session, showtime_id=1)
    assert forecast["showtime_id"] == 1
    fc = forecast["forecast"]
    assert "predicted_occupancy_pct" in fc
    assert "confidence_interval_95" in fc
    ci = fc["confidence_interval_95"]
    assert ci["min_pct"] <= fc["predicted_occupancy_pct"] <= ci["max_pct"]
    assert len(fc["explanation"]) > 20
    assert "baseline" in fc["explanation"]


@pytest.mark.asyncio
async def test_demand_alerts_detection(db_session):
    st = await db_session.get(Showtime, 1)
    st.start_time = datetime.utcnow() + timedelta(hours=12)

    # Add 5 active waitlist entries to trigger CRITICAL alert
    for i in range(5):
        wl = WaitlistEntry(
            user_id=10 + i,
            showtime_id=1,
            desired_seats_count=2,
            status=WaitlistStatusEnum.ACTIVE,
            created_at=datetime.utcnow()
        )
        db_session.add(wl)
    await db_session.commit()

    alerts_res = await get_demand_alerts(db_session)
    assert alerts_res["alerts_count"] >= 1
    st1_alert = next((a for a in alerts_res["alerts"] if a["showtime_id"] == 1), None)
    assert st1_alert is not None
    assert st1_alert["severity"] == "CRITICAL"
    assert any("waitlist" in r for r in st1_alert["reasons"])


@pytest.mark.asyncio
async def test_revenue_impact_preview(db_session):
    st = await db_session.get(Showtime, 1)
    st.start_time = datetime.utcnow() + timedelta(days=3)

    # Create a pricing rule
    rule = DynamicPricingRule(
        name="10 Percent Surge",
        floor_price=100.0,
        ceiling_price=600.0,
        price_multiplier=1.10,
        flat_adjustment=0.0,
        status=PricingRuleStatusEnum.ACTIVE
    )
    db_session.add(rule)
    await db_session.commit()
    await db_session.refresh(rule)

    preview = await get_revenue_impact_preview(db_session, rule.id)
    assert preview["rule_id"] == rule.id
    assert preview["affected_upcoming_showtimes"] >= 1
    assert preview["projected_revenue_delta"] > 0.0
    assert preview["projected_revenue_pct_change"] > 0.0

