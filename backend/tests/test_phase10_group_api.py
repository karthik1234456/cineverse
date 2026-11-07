import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy import select, delete

from app.database import AsyncSessionLocal
from app.models.group_booking import GroupBooking, GroupMember
from app.models.auth import User
from app.services.hold_service import reset_hold_tracking


@pytest.fixture(autouse=True)
def reset_holds():
    reset_hold_tracking()
    yield
    reset_hold_tracking()


async def get_auth_token(client: AsyncClient, email: str = "patron@example.com", password: str = "Patron@123") -> str:
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password}
    )
    assert login_resp.status_code == 200, f"Login failed for {email}"
    return login_resp.json()["access_token"]


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
    # Clean old test groups
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

    # Clean old test groups for this user
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
