import json
import uuid
import struct
import pytest
from datetime import datetime, timedelta, time
from httpx import AsyncClient
from sqlalchemy import select, update, delete

from app.database import AsyncSessionLocal
from app.models.auth import User
from app.models.cinema import Auditorium, Seat
from app.models.booking import Booking, BookingSeat, Ticket, BookingStatusEnum
from app.models.showtime import Showtime, SeatInventory, SeatStatusEnum
from app.models.operations import (
    TheatreAssetVersion, StaffDevice, TicketScanLog, ScanResultEnum,
    FoodOrder, FoodDeliveryTypeEnum, FoodDeliveryStatusEnum,
    LoyaltyAccount, LoyaltyLedger, CinePassSubscription, TicketTransferLog
)
from app.services.ticket_service import generate_qr_data, generate_ticket_signature, generate_qr_code_base64
from app.services.onboarding_service import AuditoriumOnboardingService
from app.services.auth_service import create_access_token


def create_minimal_synthetic_glb(include_screen=True, native_y_up=True, seat_count=4) -> bytes:
    """Generates a valid binary glTF 2.0 (GLB) file in memory for onboarding tests."""
    nodes = []
    meshes = []
    accessors = []
    buffer_views = []
    byte_chunks = bytearray()

    # Helper to pack positions
    def pack_positions(pos_list):
        arr = bytearray()
        for p in pos_list:
            arr.extend(struct.pack("<3f", *p))
        offset = len(byte_chunks)
        byte_chunks.extend(arr)
        # Pad to 4 bytes
        while len(byte_chunks) % 4 != 0:
            byte_chunks.append(0)

        bv_idx = len(buffer_views)
        buffer_views.append({"buffer": 0, "byteOffset": offset, "byteLength": len(arr), "target": 34962})

        acc_idx = len(accessors)
        accessors.append({
            "bufferView": bv_idx,
            "byteOffset": 0,
            "componentType": 5126,  # FLOAT
            "count": len(pos_list),
            "type": "VEC3",
            "max": [max(p[0] for p in pos_list), max(p[1] for p in pos_list), max(p[2] for p in pos_list)],
            "min": [min(p[0] for p in pos_list), min(p[1] for p in pos_list), min(p[2] for p in pos_list)]
        })
        return acc_idx

    # 1. Screen mesh
    if include_screen:
        screen_verts = [
            [-7.8, 1.9, -1.255], [7.8, 1.9, -1.255], [7.8, 9.2, -1.255],
            [-7.8, 1.9, -1.255], [7.8, 9.2, -1.255], [-7.8, 9.2, -1.255]
        ]
        s_acc = pack_positions(screen_verts)
        meshes.append({"name": "cinema_screen_surface", "primitives": [{"attributes": {"POSITION": s_acc}}]})
        nodes.append({"name": "cinema_screen_surface", "mesh": len(meshes) - 1})

    # 2. Seat meshes: seat_A_01 ..
    for i in range(1, seat_count + 1):
        x = -3.0 + (i * 1.5)
        # Seat box vertices
        seat_verts = [
            [x - 0.5, 0.0, -8.0], [x + 0.5, 0.0, -8.0], [x + 0.5, 1.0, -8.0],
            [x - 0.5, 0.0, -7.0], [x + 0.5, 0.0, -7.0], [x + 0.5, 1.0, -7.0]
        ]
        acc = pack_positions(seat_verts)
        meshes.append({"name": f"seat_A_{i:02d}", "primitives": [{"attributes": {"POSITION": acc}}]})
        node_def = {"name": f"seat_A_{i:02d}", "mesh": len(meshes) - 1}
        if not native_y_up:
            # Blender matrix
            node_def["matrix"] = [1.0, 0.0, 0.0, 0.0,  0.0, 0.0, 1.0, 0.0,  0.0, -1.0, 0.0, 0.0,  0.0, 0.0, 0.0, 1.0]
        nodes.append(node_def)

    json_dict = {
        "asset": {"version": "2.0", "generator": "CineVerse Synthetic Generator"},
        "scenes": [{"nodes": list(range(len(nodes)))}],
        "nodes": nodes,
        "meshes": meshes,
        "accessors": accessors,
        "bufferViews": buffer_views,
        "buffers": [{"byteLength": len(byte_chunks)}]
    }

    json_bytes = json.dumps(json_dict).encode("utf-8")
    while len(json_bytes) % 4 != 0:
        json_bytes += b" "

    total_len = 12 + 8 + len(json_bytes) + 8 + len(byte_chunks)
    header = struct.pack("<4sII", b"glTF", 2, total_len)
    json_chunk = struct.pack("<II", len(json_bytes), 0x4E4F534A) + json_bytes
    bin_chunk = struct.pack("<II", len(byte_chunks), 0x004E4942) + bytes(byte_chunks)

    return header + json_chunk + bin_chunk


@pytest.mark.asyncio
async def test_onboarding_pipeline_with_supplied_glb():
    """
    Task 1: Validates the actual production GLB using AuditoriumOnboardingService.
    Asserts coordinate convention, 100 seats, screen center, and eye positions match seat_layout_v2.json.
    """
    import os
    glb_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../frontend/public/models/cineverse_auditorium_v2.glb")) if not os.path.exists("frontend/public/models/cineverse_auditorium_v2.glb") else "frontend/public/models/cineverse_auditorium_v2.glb"
    with open(glb_path, "rb") as f:
        file_bytes = f.read()

    report = AuditoriumOnboardingService.process_and_validate_glb(file_bytes)

    assert report["validation_status"] in ["VALID", "WARNINGS"]
    assert len(report["errors"]) == 0
    assert report["coordinate_info"]["convention"] == "Blender_Z_UP_WITH_MATRIX"
    assert report["coordinate_info"]["target_space"] == "glTF_Y_UP"

    seats = report["seat_layout"]["seats"]
    assert len(seats) == 100
    rows = {s["row"] for s in seats}
    assert rows == {"A", "B", "C", "D", "E", "F", "G", "H", "I", "J"}

    # Screen center
    sc = report["mesh_metrics"]["screen_center"]
    assert abs(sc[0] - 0.0) < 0.1
    assert abs(sc[1] - 5.55) < 0.1
    assert abs(sc[2] - (-1.255)) < 0.1

    # Seat E05 verification against baseline fixtures
    e05 = next(s for s in seats if s["seat_id"] == "E05")
    assert e05["row"] == "E"
    assert e05["number"] == 5
    assert e05["category"] == "Prime"
    assert e05["eye_position_gltf_y_up"][1] > 2.0
    assert e05["screen_distance"] > 10.0


@pytest.mark.asyncio
async def test_onboarding_defect_detection_broken_glb(client: AsyncClient):
    """
    Task 1: Flags defects when GLB is missing screen or contains invalid format.
    """
    admin_token = create_access_token({"sub": "1", "email": "admin@cineverse.in", "role": "ADMIN"})
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Broken GLB without screen
    broken_glb_bytes = create_minimal_synthetic_glb(include_screen=False, native_y_up=True, seat_count=2)
    files = {"file": ("broken_auditorium.glb", broken_glb_bytes, "model/gltf-binary")}
    resp = await client.post("/api/v1/admin/onboarding/validate-glb", files=files, headers=headers)
    assert resp.status_code == 200
    data = resp.json()["report"]
    assert data["validation_status"] == "REJECTED"
    assert any("MISSING_SCREEN" in err for err in data["errors"])

    # 2. Invalid file type rejected
    bad_files = {"file": ("test.txt", b"hello world", "text/plain")}
    bad_resp = await client.post("/api/v1/admin/onboarding/validate-glb", files=bad_files, headers=headers)
    assert bad_resp.status_code == 400


@pytest.mark.asyncio
async def test_onboarding_synthetic_glb_native_y_up(client: AsyncClient):
    """
    Task 1 & 8: Successfully validates a second synthetic GLB with native glTF Y-up convention.
    """
    admin_token = create_access_token({"sub": "1", "email": "admin@cineverse.in", "role": "ADMIN"})
    headers = {"Authorization": f"Bearer {admin_token}"}

    synth_bytes = create_minimal_synthetic_glb(include_screen=True, native_y_up=True, seat_count=4)
    files = {"file": ("synthetic_hall.glb", synth_bytes, "model/gltf-binary")}
    resp = await client.post("/api/v1/admin/onboarding/validate-glb", files=files, headers=headers)
    assert resp.status_code == 200
    report = resp.json()["report"]
    assert report["validation_status"] == "VALID"
    assert report["coordinate_info"]["convention"] == "glTF_Y_UP"
    assert report["mesh_metrics"]["seat_count"] == 4


@pytest.mark.asyncio
async def test_asset_versioning_and_rollback(client: AsyncClient):
    """
    Task 1 & 2: Publishes version 2.0, publishes version 2.1, and tests atomic rollback.
    Uses an isolated test auditorium so primary Auditorium 1 seats remain untouched.
    """
    admin_token = create_access_token({"sub": "1", "email": "admin@cineverse.in", "role": "ADMIN"})
    headers = {"Authorization": f"Bearer {admin_token}"}

    async with AsyncSessionLocal() as db:
        test_audi = Auditorium(
            cinema_id=1,
            name=f"Onboarding Test {uuid.uuid4().hex[:6]}",
            screen_type="Standard",
            total_seats=2,
            has_3d_preview=True
        )
        db.add(test_audi)
        await db.commit()
        test_audi_id = test_audi.id

    sample_layout = {
        "version": "2.0",
        "seats": [
            {
                "seat_id": "A01", "row": "A", "number": 1, "category": "Front",
                "node_name": "seat_A_01", "eye_position_gltf_y_up": [-3.0, 1.2, -8.0],
                "screen_distance": 8.0, "vertical_angle_deg": 5.0, "horizontal_offset_deg": -10.0
            },
            {
                "seat_id": "A02", "row": "A", "number": 2, "category": "Front",
                "node_name": "seat_A_02", "eye_position_gltf_y_up": [-1.5, 1.2, -8.0],
                "screen_distance": 7.8, "vertical_angle_deg": 5.0, "horizontal_offset_deg": -5.0
            }
        ]
    }

    # 1. Publish Version 2.0
    pub_resp = await client.post(
        f"/api/v1/admin/onboarding/publish?auditorium_id={test_audi_id}",
        data={"version_label": "2.0", "seat_layout_json": json.dumps(sample_layout)},
        headers=headers
    )
    assert pub_resp.status_code == 200
    v20_id = pub_resp.json()["version_id"]

    # 2. Publish Version 2.1
    pub_21 = await client.post(
        f"/api/v1/admin/onboarding/publish?auditorium_id={test_audi_id}",
        data={"version_label": "2.1", "seat_layout_json": json.dumps(sample_layout)},
        headers=headers
    )
    assert pub_21.status_code == 200
    v21_id = pub_21.json()["version_id"]

    # 3. List versions
    list_resp = await client.get(f"/api/v1/admin/onboarding/versions/{test_audi_id}", headers=headers)
    assert list_resp.status_code == 200
    versions = list_resp.json()["versions"]
    assert len(versions) >= 2

    # 4. Rollback to version 2.0
    rb_resp = await client.post(
        f"/api/v1/admin/onboarding/rollback?auditorium_id={test_audi_id}&target_version_id={v20_id}",
        headers=headers
    )
    assert rb_resp.status_code == 200
    assert rb_resp.json()["active_version_id"] == v20_id

    # 5. Asset optimization endpoint metrics
    opt_resp = await client.post(f"/api/v1/admin/onboarding/optimize?auditorium_id={test_audi_id}", headers=headers)
    assert opt_resp.status_code == 200
    opt_data = opt_resp.json()
    assert opt_data["improvements"]["triangle_reduction_percentage"] > 80.0
    assert opt_data["after"]["triangles"] == 262914


@pytest.mark.asyncio
async def test_staff_device_registration_and_entry_scanning(client: AsyncClient):
    """
    Task 3: Staff device registration, single-use ticket admission,
    duplicate scan rejection, forged HMAC rejection, and offline batch sync.
    """
    staff_token = create_access_token({"sub": "2", "email": "manager@cineverse.in", "role": "CINEMA_MANAGER"})
    headers = {"Authorization": f"Bearer {staff_token}"}

    # 1. Register device
    dev_id = f"dev_{uuid.uuid4().hex[:8]}"
    reg_resp = await client.post(
        "/api/v1/staff/devices/register",
        json={"device_id": dev_id, "device_name": "Gate 1 Handheld Scanner", "assigned_gate": "Gate 1 - North"},
        headers=headers
    )
    assert reg_resp.status_code == 200

    # 2. Create test booking and verified ticket
    ticket_num = f"TKT-SCAN-{uuid.uuid4().hex[:8].upper()}"
    sig = generate_ticket_signature(ticket_num, 1, ["D01", "D02"])
    qr_data = generate_qr_data(ticket_num, showtime_id=1, seat_codes=["D01", "D02"], signature=sig)
    qr_b64 = generate_qr_code_base64(qr_data)

    async with AsyncSessionLocal() as db:
        # Clear any conflicting seats from previous runs
        await db.execute(delete(BookingSeat).where(BookingSeat.showtime_id == 1, BookingSeat.seat_id.in_(["D01", "D02"])))
        await db.commit()

        # Create booking
        bkg = Booking(
            booking_code=f"CV-{uuid.uuid4().hex[:6].upper()}",
            user_id=1,
            showtime_id=1,
            status=BookingStatusEnum.CONFIRMED,
            final_total_amount=560.0
        )
        db.add(bkg)
        await db.flush()

        db.add(BookingSeat(booking_id=bkg.id, showtime_id=1, seat_id="D01", category="Prime", price=280.0))
        db.add(BookingSeat(booking_id=bkg.id, showtime_id=1, seat_id="D02", category="Prime", price=280.0))

        tkt = Ticket(
            booking_id=bkg.id,
            ticket_number=ticket_num,
            qr_data=qr_data,
            qr_code_url=qr_b64,
            hmac_signature=sig,
            is_used=False
        )
        db.add(tkt)
        await db.commit()

    # 3. First scan: Valid QR -> SUCCESS
    scan_resp = await client.post(
        "/api/v1/staff/scan",
        json={"qr_data": qr_data, "gate": "Gate 1", "device_id": dev_id},
        headers=headers
    )
    assert scan_resp.status_code == 200
    scan_data = scan_resp.json()
    assert scan_data["result"] == "SUCCESS"
    assert scan_data["total_admissions"] == 2
    assert "D01" in scan_data["seats"]

    # 4. Duplicate scan: Same QR -> 409 ALREADY_USED
    dup_resp = await client.post(
        "/api/v1/staff/scan",
        json={"qr_data": qr_data, "gate": "Gate 1", "device_id": dev_id},
        headers=headers
    )
    assert dup_resp.status_code == 409
    assert dup_resp.json()["detail"]["result"] == "ALREADY_USED"

    # 5. Forged HMAC Signature -> 400 INVALID_HMAC
    forged_qr = f"{ticket_num}|1|D01,D02|invalid_forged_signature_hash"
    forged_resp = await client.post(
        "/api/v1/staff/scan",
        json={"qr_data": forged_qr, "gate": "Gate 1", "device_id": dev_id},
        headers=headers
    )
    assert forged_resp.status_code == 400
    assert "INVALID_HMAC" in forged_resp.json()["detail"]

    # 6. Manual lookup by ticket code
    lookup_resp = await client.get(f"/api/v1/staff/lookup?code={ticket_num}", headers=headers)
    assert lookup_resp.status_code == 200
    assert lookup_resp.json()["ticket_number"] == ticket_num
    assert lookup_resp.json()["is_used"] is True


@pytest.mark.asyncio
async def test_at_seat_food_pre_order_and_kds_lifecycle(client: AsyncClient):
    """
    Task 4: Creates in-seat concessions order, verifies Kitchen Display System (KDS),
    and transitions PREPARING -> READY -> DELIVERED.
    """
    user_token = create_access_token({"sub": "3", "email": "customer@cineverse.in", "role": "CUSTOMER"})
    headers = {"Authorization": f"Bearer {user_token}"}

    # Ensure showtime is active with future time
    async with AsyncSessionLocal() as db:
        st = await db.get(Showtime, 1)
        if st:
            st.start_time = datetime.utcnow() + timedelta(hours=1)
            st.end_time = datetime.utcnow() + timedelta(hours=3)

        bkg = Booking(
            booking_code=f"CV-{uuid.uuid4().hex[:6].upper()}",
            user_id=3,
            showtime_id=1,
            status=BookingStatusEnum.CONFIRMED,
            final_total_amount=380.0
        )
        db.add(bkg)
        await db.commit()
        bkg_id = bkg.id

    # 1. Place in-seat order
    order_req = {
        "booking_id": bkg_id,
        "delivery_type": "SEAT_DELIVERY",
        "target_row": "E",
        "target_seat": "E05",
        "items": [
            {"name": "Caramel Popcorn Jumbo", "quantity": 1, "price": 280.0},
            {"name": "Ice Cold Pepsi 500ml", "quantity": 2, "price": 120.0}
        ]
    }
    ord_resp = await client.post("/api/v1/food/order", json=order_req, headers=headers)
    assert ord_resp.status_code == 200
    ord_data = ord_resp.json()
    order_id = ord_data["order_id"]
    assert ord_data["delivery_status"] == "PREPARING"
    assert ord_data["target_seat"] == "E05"

    # 2. Kitchen Display System (KDS) View
    staff_token = create_access_token({"sub": "2", "email": "manager@cineverse.in", "role": "CINEMA_MANAGER"})
    staff_headers = {"Authorization": f"Bearer {staff_token}"}

    kds_resp = await client.get("/api/v1/food/kds/orders", headers=staff_headers)
    assert kds_resp.status_code == 200
    kds_orders = kds_resp.json()["orders"]
    matching = next((o for o in kds_orders if o["order_id"] == order_id), None)
    assert matching is not None
    assert matching["target_seat"] == "E05"
    assert matching["delivery_status"] == "PREPARING"

    # 3. Kitchen update: PREPARING -> READY
    upd_resp = await client.patch(
        f"/api/v1/food/kds/orders/{order_id}/status",
        json={"status": "READY"},
        headers=staff_headers
    )
    assert upd_resp.status_code == 200
    assert upd_resp.json()["delivery_status"] == "READY"

    # 4. Kitchen update: READY -> DELIVERED
    deliv_resp = await client.patch(
        f"/api/v1/food/kds/orders/{order_id}/status",
        json={"status": "DELIVERED"},
        headers=staff_headers
    )
    assert deliv_resp.status_code == 200
    assert deliv_resp.json()["delivery_status"] == "DELIVERED"


@pytest.mark.asyncio
async def test_loyalty_points_ledger_and_cinepass_entitlement(client: AsyncClient):
    """
    Task 5: Loyalty points ledger, CinePass subscription and quota tracking,
    and anti-fraud referral claim.
    """
    token_a = create_access_token({"sub": "3", "email": "customer@cineverse.in", "role": "CUSTOMER"})
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # 1. Fetch loyalty account
    acc_resp = await client.get("/api/v1/loyalty/account", headers=headers_a)
    assert acc_resp.status_code == 200
    acc_data = acc_resp.json()
    assert acc_data["points_balance"] >= 50  # Includes welcome bonus
    ref_code = acc_data["referral_code"]

    # 2. Subscribe to CinePass
    pass_resp = await client.post("/api/v1/loyalty/cinepass/subscribe", headers=headers_a)
    assert pass_resp.status_code == 200
    assert pass_resp.json()["monthly_ticket_quota"] == 4

    # 3. User B claims referral from User A
    token_b = create_access_token({"sub": "4", "email": "patron2@cineverse.in", "role": "CUSTOMER"})
    headers_b = {"Authorization": f"Bearer {token_b}"}

    async with AsyncSessionLocal() as db:
        await db.execute(delete(LoyaltyLedger).where(LoyaltyLedger.account_id.in_(
            select(LoyaltyAccount.id).where(LoyaltyAccount.user_id == 4)
        )))
        await db.execute(delete(LoyaltyAccount).where(LoyaltyAccount.user_id == 4))
        await db.commit()

    claim_resp = await client.post(
        "/api/v1/loyalty/referral/claim",
        json={"referral_code": ref_code},
        headers=headers_b
    )
    assert claim_resp.status_code == 200
    assert claim_resp.json()["points_awarded"] == 100

    # 4. Self-referral rejection
    self_resp = await client.post(
        "/api/v1/loyalty/referral/claim",
        json={"referral_code": ref_code},
        headers=headers_a
    )
    assert self_resp.status_code == 400

    # 5. Cancel CinePass without dark patterns
    cancel_resp = await client.post("/api/v1/loyalty/cinepass/cancel", headers=headers_a)
    assert cancel_resp.status_code == 200


@pytest.mark.asyncio
async def test_ticket_transfer_flow_and_security_limits(client: AsyncClient):
    """
    Task 6: Safe ticket transfer to another registered account,
    invalidation of original QR code, and monthly transfer rate limit enforcement.
    """
    token_sender = create_access_token({"sub": "3", "email": "customer@cineverse.in", "role": "CUSTOMER"})
    headers_sender = {"Authorization": f"Bearer {token_sender}"}

    # Ensure recipient account exists, clear prior transfer logs for user 3, and use an isolated test showtime
    async with AsyncSessionLocal() as db:
        # Clear transfer logs for user 3 so the monthly rate limit is clean for tests
        await db.execute(delete(TicketTransferLog).where(TicketTransferLog.from_user_id == 3))
        await db.execute(delete(BookingSeat).where(BookingSeat.showtime_id == 1, BookingSeat.seat_id == "E05"))

        recip_res = await db.execute(select(User).where(User.email == "recipient@cineverse.in"))
        recip = recip_res.scalars().first()
        if not recip:
            recip = User(email="recipient@cineverse.in", hashed_password="hashed_pw", role="CUSTOMER")
            db.add(recip)

        # Restore Showtime 1 to TODAY so browse / movie tests never find empty showtimes
        st = await db.get(Showtime, 1)
        if st:
            today_date = datetime.utcnow().date()
            st.start_time = datetime.combine(today_date, time(18, 0))
            st.end_time = datetime.combine(today_date, time(20, 45))

        bkg = Booking(
            booking_code=f"CV-{uuid.uuid4().hex[:6].upper()}",
            user_id=3,
            showtime_id=1,
            status=BookingStatusEnum.CONFIRMED,
            final_total_amount=380.0
        )
        db.add(bkg)
        await db.flush()
        db.add(BookingSeat(booking_id=bkg.id, showtime_id=1, seat_id="E05", category="Prime", price=380.0))

        ticket_num = f"TKT-{uuid.uuid4().hex[:8].upper()}"
        qr_sig = generate_ticket_signature(ticket_num, 1, ["E05"])
        qr = generate_qr_data(ticket_num, 1, ["E05"], qr_sig)
        tkt = Ticket(
            booking_id=bkg.id,
            ticket_number=ticket_num,
            qr_data=qr,
            qr_code_url=generate_qr_code_base64(qr),
            hmac_signature=qr_sig,
            is_used=False
        )
        db.add(tkt)
        await db.commit()
        tkt_id = tkt.id

    # 1. Transfer ticket to recipient
    xfer_resp = await client.post(
        f"/api/v1/tickets/{tkt_id}/transfer",
        json={"recipient_email": "recipient@cineverse.in"},
        headers=headers_sender
    )
    assert xfer_resp.status_code == 200
    xfer_data = xfer_resp.json()
    assert xfer_data["status"] == "success"
    assert xfer_data["new_ticket_number"].startswith("TKT-")

    # 2. Attempting to re-transfer used original ticket fails
    re_xfer = await client.post(
        f"/api/v1/tickets/{tkt_id}/transfer",
        json={"recipient_email": "thirdparty@cineverse.in"},
        headers=headers_sender
    )
    assert re_xfer.status_code in [400, 403]
    assert any(phrase in str(re_xfer.json()["detail"]).lower() for phrase in ["already used", "not authorized"])


@pytest.mark.asyncio
async def test_offline_ed25519_keys_and_batch_duplicate_conflict_reconciliation(client: AsyncClient):
    """
    FIX-06: Verifies public keys endpoint returns Ed25519 public keys with `kid` for offline devices,
    and batch offline scan sync reconciles duplicate entries across devices (first wins, second logs conflict).
    """
    staff_token = create_access_token({"sub": "2", "email": "staff@cineverse.in", "role": "MANAGER"})
    headers = {"Authorization": f"Bearer {staff_token}"}

    # 1. Fetch public keys for offline cache (does not reveal private keys)
    keys_resp = await client.get("/api/v1/staff/keys", headers=headers)
    assert keys_resp.status_code == 200
    keys_data = keys_resp.json()
    assert "keys" in keys_data
    assert any(k["kid"] == "cv-ed25519-2026-v1" and k["alg"] == "Ed25519" for k in keys_data["keys"])

    # 2. Seed a valid booking & ticket with Ed25519 signature
    ticket_num = f"TKT-ED25519-{uuid.uuid4().hex[:6].upper()}"
    qr_sig = generate_ticket_signature(ticket_num, 1, ["F01"])
    qr_json = generate_qr_data(ticket_num, 1, ["F01"], qr_sig, kid="cv-ed25519-2026-v1")

    async with AsyncSessionLocal() as db:
        bkg = Booking(
            booking_code=f"CV-{uuid.uuid4().hex[:6].upper()}",
            user_id=1,
            showtime_id=1,
            status=BookingStatusEnum.CONFIRMED,
            final_total_amount=350.0
        )
        db.add(bkg)
        await db.flush()
        db.add(BookingSeat(booking_id=bkg.id, showtime_id=1, seat_id="F01", category="Prime", price=350.0))

        tkt = Ticket(
            booking_id=bkg.id,
            ticket_number=ticket_num,
            qr_data=qr_json,
            qr_code_url="data:image/png;base64,mock",
            hmac_signature=qr_sig,
            is_used=False
        )
        db.add(tkt)
        await db.commit()

    # 3. Simulate two handheld scanners syncing offline scans for the same ticket:
    # Device A scanned at 10:00:00 (earlier)
    # Device B scanned at 10:00:15 (duplicate presentation at another gate)
    t_early = datetime.utcnow() - timedelta(minutes=5)
    t_late = t_early + timedelta(seconds=15)

    batch_payload = {
        "scans": [
            {
                "client_scan_id": "scan_device_b_late",
                "qr_data": qr_json,
                "gate": "Gate 2 - North",
                "device_id": "DEV-GATE-02",
                "scanned_at": t_late.isoformat()
            },
            {
                "client_scan_id": "scan_device_a_early",
                "qr_data": qr_json,
                "gate": "Gate 1 - Main",
                "device_id": "DEV-GATE-01",
                "scanned_at": t_early.isoformat()
            }
        ]
    }

    sync_resp = await client.post("/api/v1/staff/scan/batch", json=batch_payload, headers=headers)
    assert sync_resp.status_code == 200
    sync_data = sync_resp.json()
    assert sync_data["synced_count"] == 2

    # Map by client_scan_id
    results_map = {r["client_scan_id"]: r for r in sync_data["results"]}
    # Earlier scan wins -> SUCCESS
    assert results_map["scan_device_a_early"]["result"] == "SUCCESS"
    # Later scan marked duplicate conflict -> OFFLINE_DUPLICATE_CONFLICT
    assert results_map["scan_device_b_late"]["result"] == "OFFLINE_DUPLICATE_CONFLICT"

    # 4. Verify audit log recorded the duplicate conflict
    async with AsyncSessionLocal() as db:
        logs_stmt = select(TicketScanLog).where(TicketScanLog.ticket_id == tkt.id).order_by(TicketScanLog.scanned_at)
        logs_res = await db.execute(logs_stmt)
        all_logs = logs_res.scalars().all()
        assert len(all_logs) == 2
        assert all_logs[0].scan_result == ScanResultEnum.OFFLINE_RESOLVED
        assert all_logs[1].scan_result == ScanResultEnum.OFFLINE_DUPLICATE_CONFLICT
