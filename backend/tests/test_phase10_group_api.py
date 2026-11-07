import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy import select, delete

from app.database import AsyncSessionLocal
from app.models.group_booking import GroupBooking, GroupMember
from app.models.auth import User
from app.models.showtime import SeatInventory, SeatStatusEnum
from app.services.hold_service import reset_hold_tracking
from sqlalchemy import update


@pytest.fixture(autouse=True)
async def reset_holds():
    reset_hold_tracking()
    async with AsyncSessionLocal() as db:
        await db.execute(
            update(SeatInventory)
            .where(SeatInventory.showtime_id == 1)
            .values(
                status=SeatStatusEnum.AVAILABLE,
                hold_id=None,
                hold_expires_at=None,
                held_by_user_id=None,
                booking_id=None
            )
        )
        await db.commit()
    yield
    reset_hold_tracking()
    async with AsyncSessionLocal() as db:
        await db.execute(
            update(SeatInventory)
            .where(SeatInventory.showtime_id == 1)
            .values(
                status=SeatStatusEnum.AVAILABLE,
                hold_id=None,
                hold_expires_at=None,
                held_by_user_id=None,
                booking_id=None
            )
        )
        await db.commit()


async def get_or_create_user(email: str, name: str, password: str = "TestPass@123") -> str:
    from app.services.auth_service import hash_password, create_access_token
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(User).where(User.email == email))
        u = res.scalars().first()
        if not u:
            u = User(email=email, full_name=name, hashed_password=hash_password(password))
            db.add(u)
            await db.commit()
            await db.refresh(u)
        return create_access_token({"sub": str(u.id)})


@pytest.mark.asyncio
async def test_create_and_join_group(client: AsyncClient):
    async with AsyncSessionLocal() as db:
        await db.execute(delete(GroupMember))
        await db.execute(delete(GroupBooking))
        await db.commit()

    token_host = await get_or_create_user("host_grp@example.com", "Host Grp")
    token_m1 = await get_or_create_user("member1_grp@example.com", "Member One")

    # 1. Host creates group
    res = await client.post(
        "/api/v1/groups",
        json={"showtime_id": 1, "timeout_policy": "AUTO_REFUND", "max_members": 4},
        headers={"Authorization": f"Bearer {token_host}"}
    )
    assert res.status_code == 201
    data = res.json()
    assert data["group_code"].startswith("GRP-")
    assert len(data["members"]) == 1
    assert data["members"][0]["role"] == "HOST"
    invite_token = data["invite_token"]
    group_code = data["group_code"]
    group_id = data["id"]

    # 2. Member joins with invite token
    res_join = await client.post(
        "/api/v1/groups/join",
        json={"invite_token": invite_token},
        headers={"Authorization": f"Bearer {token_m1}"}
    )
    assert res_join.status_code == 200
    join_data = res_join.json()
    assert len(join_data["members"]) == 2

    # 3. Propose seats
    res_prop = await client.post(
        f"/api/v1/groups/{group_id}/propose-seats",
        json={"seat_ids": ["A01", "A02"]},
        headers={"Authorization": f"Bearer {token_m1}"}
    )
    assert res_prop.status_code == 200
    assert res_prop.json()["proposed_seats"] == ["A01", "A02"]

    # 4. Fetch group details
    res_get = await client.get(
        f"/api/v1/groups/{group_code}",
        headers={"Authorization": f"Bearer {token_m1}"}
    )
    assert res_get.status_code == 200
    assert res_get.json()["group_code"] == group_code


@pytest.mark.asyncio
async def test_anti_hoarding_limit(client: AsyncClient):
    token_host = await get_or_create_user("hoarder@example.com", "Hoarder User")

    async with AsyncSessionLocal() as db:
        res = await db.execute(select(User).where(User.email == "hoarder@example.com"))
        u = res.scalars().first()
        if u:
            await db.execute(delete(GroupBooking).where(GroupBooking.host_user_id == u.id))
            await db.commit()

    headers = {"Authorization": f"Bearer {token_host}"}

    # Group 1 -> OK
    r1 = await client.post("/api/v1/groups", json={"showtime_id": 1, "timeout_policy": "AUTO_REFUND"}, headers=headers)
    assert r1.status_code == 201

    # Group 2 -> OK
    r2 = await client.post("/api/v1/groups", json={"showtime_id": 1, "timeout_policy": "AUTO_REFUND"}, headers=headers)
    assert r2.status_code == 201

    # Group 3 -> 429 Too Many Requests
    r3 = await client.post("/api/v1/groups", json={"showtime_id": 1, "timeout_policy": "AUTO_REFUND"}, headers=headers)
    assert r3.status_code == 429
    assert "limit of active group bookings" in r3.json()["detail"]


@pytest.mark.asyncio
async def test_group_confirm_hold_and_extend(client: AsyncClient):
    async with AsyncSessionLocal() as db:
        await db.execute(delete(GroupMember))
        await db.execute(delete(GroupBooking))
        await db.commit()

    token_host = await get_or_create_user("host_extend@example.com", "Host Extend")
    token_m1 = await get_or_create_user("member_extend@example.com", "Member Extend")

    res = await client.post(
        "/api/v1/groups",
        json={"showtime_id": 1, "timeout_policy": "AUTO_REFUND"},
        headers={"Authorization": f"Bearer {token_host}"}
    )
    assert res.status_code == 201
    g_data = res.json()
    group_id = g_data["id"]
    invite_token = g_data["invite_token"]
    host_m_id = g_data["members"][0]["id"]

    # Member joins
    res_j = await client.post(
        "/api/v1/groups/join",
        json={"invite_token": invite_token},
        headers={"Authorization": f"Bearer {token_m1}"}
    )
    mbr_m_id = res_j.json()["members"][1]["id"]

    # Host confirms selection and locks hold
    res_conf = await client.post(
        f"/api/v1/groups/{group_id}/confirm",
        json={
            "seat_allocations": {
                str(host_m_id): ["A01"],
                str(mbr_m_id): ["A02"]
            }
        },
        headers={"Authorization": f"Bearer {token_host}"}
    )
    assert res_conf.status_code == 200
    held_data = res_conf.json()
    assert held_data["status"] == "HELD"
    assert held_data["hold_id"] is not None
    assert held_data["total_amount_paise"] > 0
    # Equal split
    assert held_data["members"][0]["share_amount_paise"] > 0
    assert held_data["members"][1]["share_amount_paise"] > 0
    assert held_data["members"][0]["share_amount_paise"] + held_data["members"][1]["share_amount_paise"] == held_data["total_amount_paise"]

    # Host extends hold (extension 1) -> OK
    res_ext1 = await client.post(
        f"/api/v1/groups/{group_id}/extend",
        headers={"Authorization": f"Bearer {token_host}"}
    )
    assert res_ext1.status_code == 200
    assert res_ext1.json()["hold_extended_count"] == 1

    # Host attempts second extension -> 400 Bad Request
    res_ext2 = await client.post(
        f"/api/v1/groups/{group_id}/extend",
        headers={"Authorization": f"Bearer {token_host}"}
    )
    assert res_ext2.status_code == 400
    assert "only be extended once" in res_ext2.json()["detail"]


@pytest.mark.asyncio
async def test_group_payment_flow_and_tickets(client: AsyncClient):
    async with AsyncSessionLocal() as db:
        await db.execute(delete(GroupMember))
        await db.execute(delete(GroupBooking))
        await db.commit()

    token_host = await get_or_create_user("host_pay@example.com", "Host Pay")
    token_m1 = await get_or_create_user("member_pay@example.com", "Member Pay")

    res = await client.post(
        "/api/v1/groups",
        json={"showtime_id": 1, "timeout_policy": "AUTO_REFUND"},
        headers={"Authorization": f"Bearer {token_host}"}
    )
    g_data = res.json()
    group_id = g_data["id"]
    invite_token = g_data["invite_token"]
    host_m_id = g_data["members"][0]["id"]

    res_j = await client.post(
        "/api/v1/groups/join",
        json={"invite_token": invite_token},
        headers={"Authorization": f"Bearer {token_m1}"}
    )
    mbr_m_id = res_j.json()["members"][1]["id"]

    # Host locks seats
    res_conf = await client.post(
        f"/api/v1/groups/{group_id}/confirm",
        json={
            "seat_allocations": {
                str(host_m_id): ["A03"],
                str(mbr_m_id): ["A04"]
            }
        },
        headers={"Authorization": f"Bearer {token_host}"}
    )
    assert res_conf.status_code == 200
    c_data = res_conf.json()
    host_share = c_data["members"][0]["share_amount_paise"]
    mbr_share = c_data["members"][1]["share_amount_paise"]

    # 1. Host creates order and pays
    order_res = await client.post(f"/api/v1/groups/{group_id}/order", headers={"Authorization": f"Bearer {token_host}"})
    assert order_res.status_code == 200

    pay1 = await client.post(
        f"/api/v1/groups/{group_id}/pay-share",
        json={"payment_id": "pay_host_123", "amount_paise": host_share},
        headers={"Authorization": f"Bearer {token_host}"}
    )
    assert pay1.status_code == 200
    assert pay1.json()["status"] == "PARTIALLY_PAID"

    # 2. Member pays share -> all paid -> CONFIRMED
    pay2 = await client.post(
        f"/api/v1/groups/{group_id}/pay-share",
        json={"payment_id": "pay_mbr_456", "amount_paise": mbr_share},
        headers={"Authorization": f"Bearer {token_m1}"}
    )
    assert pay2.status_code == 200
    confirmed_data = pay2.json()
    assert confirmed_data["status"] == "CONFIRMED"

    # 3. Retrieve tickets for member
    tkt_res = await client.get(
        f"/api/v1/groups/{group_id}/tickets",
        headers={"Authorization": f"Bearer {token_m1}"}
    )
    assert tkt_res.status_code == 200
    tickets = tkt_res.json()
    assert len(tickets) >= 1
    m_ticket = tickets[0]
    assert m_ticket["seats"] == ["A04"]
    assert m_ticket["ticket_number"].startswith("TKT-GRP-")
    assert "sig" in m_ticket["qr_data"]
    assert m_ticket["is_paid"] is True


@pytest.mark.asyncio
async def test_group_timeout_auto_refund(client: AsyncClient):
    async with AsyncSessionLocal() as db:
        await db.execute(delete(GroupMember))
        await db.execute(delete(GroupBooking))
        await db.commit()

    token_host = await get_or_create_user("host_timeout_ref@example.com", "Host Timeout Ref")
    token_m1 = await get_or_create_user("mbr_timeout_ref@example.com", "Mbr Timeout Ref")

    res = await client.post(
        "/api/v1/groups",
        json={"showtime_id": 1, "timeout_policy": "AUTO_REFUND"},
        headers={"Authorization": f"Bearer {token_host}"}
    )
    g_data = res.json()
    group_id = g_data["id"]
    invite_token = g_data["invite_token"]
    host_m_id = g_data["members"][0]["id"]

    res_j = await client.post(
        "/api/v1/groups/join",
        json={"invite_token": invite_token},
        headers={"Authorization": f"Bearer {token_m1}"}
    )
    mbr_m_id = res_j.json()["members"][1]["id"]

    # Host locks seats
    res_conf = await client.post(
        f"/api/v1/groups/{group_id}/confirm",
        json={
            "seat_allocations": {
                str(host_m_id): ["A05"],
                str(mbr_m_id): ["A06"]
            }
        },
        headers={"Authorization": f"Bearer {token_host}"}
    )
    c_data = res_conf.json()
    host_share = c_data["members"][0]["share_amount_paise"]

    # Host pays share
    await client.post(
        f"/api/v1/groups/{group_id}/pay-share",
        json={"payment_id": "pay_host_ref", "amount_paise": host_share},
        headers={"Authorization": f"Bearer {token_host}"}
    )

    # Trigger timeout
    to_res = await client.post(f"/api/v1/groups/{group_id}/timeout?force=true")
    assert to_res.status_code == 200
    to_data = to_res.json()
    assert to_data["status"] == "EXPIRED"
    # Host who paid should be REFUNDED
    assert to_data["members"][0]["payment_status"] == "REFUNDED"


@pytest.mark.asyncio
async def test_group_timeout_host_covers(client: AsyncClient):
    token_host = await get_or_create_user("host_timeout_cov@example.com", "Host Timeout Cov")
    token_m1 = await get_or_create_user("mbr_timeout_cov@example.com", "Mbr Timeout Cov")

    res = await client.post(
        "/api/v1/groups",
        json={"showtime_id": 1, "timeout_policy": "HOST_COVERS"},
        headers={"Authorization": f"Bearer {token_host}"}
    )
    g_data = res.json()
    group_id = g_data["id"]
    invite_token = g_data["invite_token"]
    host_m_id = g_data["members"][0]["id"]

    res_j = await client.post(
        "/api/v1/groups/join",
        json={"invite_token": invite_token},
        headers={"Authorization": f"Bearer {token_m1}"}
    )
    mbr_m_id = res_j.json()["members"][1]["id"]

    # Host locks seats
    res_conf = await client.post(
        f"/api/v1/groups/{group_id}/confirm",
        json={
            "seat_allocations": {
                str(host_m_id): ["A07"],
                str(mbr_m_id): ["A08"]
            }
        },
        headers={"Authorization": f"Bearer {token_host}"}
    )
    c_data = res_conf.json()
    mbr_share = c_data["members"][1]["share_amount_paise"]

    # Member pays share, host has not paid yet
    await client.post(
        f"/api/v1/groups/{group_id}/pay-share",
        json={"payment_id": "pay_mbr_cov", "amount_paise": mbr_share},
        headers={"Authorization": f"Bearer {token_m1}"}
    )

    # Timeout triggers host cover remainder
    to_res = await client.post(f"/api/v1/groups/{group_id}/timeout?force=true")
    assert to_res.status_code == 200
    to_data = to_res.json()
    # Since host remainder is covered, booking transitions to CONFIRMED
    assert to_data["status"] == "CONFIRMED"
