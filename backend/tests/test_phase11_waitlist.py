import pytest
from datetime import datetime, timedelta
from app.models.auth import User, RoleEnum
from app.models.showtime import Showtime, SeatInventory, SeatStatusEnum
from app.models.waitlist import WaitlistEntry, WaitlistStatusEnum
from app.services.waitlist_service import (
    join_waitlist,
    get_user_waitlist_status,
    cancel_waitlist,
    process_waitlist_on_release,
    expire_overdue_claims,
    MAX_ACTIVE_WAITLIST_PER_USER
)
from app.services.auth_service import create_access_token


@pytest.mark.asyncio
async def test_waitlist_fifo_ordering_and_fair_release(db_session):
    # Setup showtime
    st = await db_session.get(Showtime, 1)
    st.start_time = datetime.utcnow() + timedelta(days=2)
    await db_session.commit()

    # User 1 and User 2 join waitlist in order
    entry1 = await join_waitlist(db_session, user_id=1, showtime_id=1, desired_seats_count=2)
    entry2 = await join_waitlist(db_session, user_id=2, showtime_id=1, desired_seats_count=2)

    assert entry1["queue_position"] == 1
    assert entry2["queue_position"] == 2

    # Status check
    status1 = await get_user_waitlist_status(db_session, user_id=1, showtime_id=1)
    assert status1["status"] == "ACTIVE"
    assert status1["queue_position"] == 1

    # Release 2 seats: FIFO should notify user 1, not user 2
    notified = await process_waitlist_on_release(db_session, showtime_id=1, freed_seat_count=2)
    assert notified == [1]

    # Verify user 1 is NOTIFIED with 10-minute claim window
    status1_after = await get_user_waitlist_status(db_session, user_id=1, showtime_id=1)
    assert status1_after["status"] == "NOTIFIED"
    assert status1_after["claim_window_expires_at"] is not None

    # User 2 is still ACTIVE at position 1 of remaining active queue
    status2_after = await get_user_waitlist_status(db_session, user_id=2, showtime_id=1)
    assert status2_after["status"] == "ACTIVE"
    assert status2_after["queue_position"] == 1


@pytest.mark.asyncio
async def test_waitlist_rate_limiting_abuse_prevention(db_session):
    # Ensure user cannot exceed MAX_ACTIVE_WAITLIST_PER_USER
    st = await db_session.get(Showtime, 1)
    st.start_time = datetime.utcnow() + timedelta(days=2)
    await db_session.commit()

    # Create dummy showtimes or entries
    for i in range(MAX_ACTIVE_WAITLIST_PER_USER):
        entry = WaitlistEntry(
            user_id=1,
            showtime_id=100 + i,
            desired_seats_count=2,
            status=WaitlistStatusEnum.ACTIVE,
            created_at=datetime.utcnow()
        )
        db_session.add(entry)
    await db_session.commit()

    # 4th attempt should be rejected with 429
    with pytest.raises(Exception) as exc_info:
        await join_waitlist(db_session, user_id=1, showtime_id=1, desired_seats_count=2)
    assert "Rate limit exceeded" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_waitlist_overdue_claim_expiry(db_session):
    st = await db_session.get(Showtime, 1)
    st.start_time = datetime.utcnow() + timedelta(days=2)
    await db_session.commit()

    # Create an entry already notified 15 minutes ago (expired claim window)
    expired_entry = WaitlistEntry(
        user_id=3,
        showtime_id=1,
        desired_seats_count=2,
        status=WaitlistStatusEnum.NOTIFIED,
        created_at=datetime.utcnow() - timedelta(minutes=30),
        notified_at=datetime.utcnow() - timedelta(minutes=15),
        claim_window_expires_at=datetime.utcnow() - timedelta(minutes=5)
    )
    db_session.add(expired_entry)
    await db_session.commit()

    expired_count = await expire_overdue_claims(db_session, showtime_id=1)
    assert expired_count == 1

    await db_session.refresh(expired_entry)
    assert expired_entry.status == WaitlistStatusEnum.EXPIRED


@pytest.mark.asyncio
async def test_waitlist_cancel_opt_out(db_session):
    st = await db_session.get(Showtime, 1)
    st.start_time = datetime.utcnow() + timedelta(days=2)
    await db_session.commit()

    await join_waitlist(db_session, user_id=1, showtime_id=1, desired_seats_count=2)
    res = await cancel_waitlist(db_session, user_id=1, showtime_id=1)
    assert "cancelled successfully" in res["message"]

    status = await get_user_waitlist_status(db_session, user_id=1, showtime_id=1)
    assert status is None

