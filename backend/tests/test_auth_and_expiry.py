import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_auth_registration_and_login_lifecycle(client: AsyncClient):
    email = "new_patron@example.com"
    password = "SecurePassword@123"

    # Register
    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": password,
            "full_name": "Test Patron",
            "phone": "9123456789"
        }
    )
    assert reg_resp.status_code == 200
    token_data = reg_resp.json()
    assert "access_token" in token_data
    assert token_data["role"] == "customer"
    access_token = token_data["access_token"]

    # Verify protected route with bearer token
    me_resp = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"}
    )
    assert me_resp.status_code == 200
    me = me_resp.json()
    assert me["email"] == email
    assert me["full_name"] == "Test Patron"

    # Login
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password}
    )
    assert login_resp.status_code == 200
    assert "access_token" in login_resp.json()


@pytest.mark.asyncio
async def test_otp_send_and_verify(client: AsyncClient):
    phone = "9988776655"
    send_resp = await client.post("/api/v1/auth/otp/send", json={"phone": phone})
    assert send_resp.status_code == 200

    # Verify with valid dev OTP
    verify_resp = await client.post(
        "/api/v1/auth/otp/verify",
        json={"phone": phone, "otp": "123456"}
    )
    assert verify_resp.status_code == 200
    assert "access_token" in verify_resp.json()


@pytest.mark.asyncio
async def test_admin_rbac_protection(client: AsyncClient):
    # Customer user attempts to access admin analytics -> should be 403 Forbidden
    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "customer_regular@example.com",
            "password": "Customer@123",
            "full_name": "Customer User",
            "phone": "9000000001"
        }
    )
    cust_token = reg_resp.json()["access_token"]

    admin_resp = await client.get(
        "/api/v1/admin/analytics",
        headers={"Authorization": f"Bearer {cust_token}"}
    )
    assert admin_resp.status_code == 403

    # Admin user login -> should be 200 OK
    admin_login = await client.post(
        "/api/v1/auth/login",
        json={"email": "admin@cineverse.in", "password": "Admin@123"}
    )
    assert admin_login.status_code == 200
    admin_token = admin_login.json()["access_token"]

    admin_ok = await client.get(
        "/api/v1/admin/analytics",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert admin_ok.status_code == 200
    analytics = admin_ok.json()
    assert "total_revenue" in analytics
    assert "overall_occupancy_percentage" in analytics

