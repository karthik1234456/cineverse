with open("backend/tests/test_phase12_operations.py", "r", encoding="utf-8") as f:
    text = f.read()

new_tests = '''

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
'''

text += new_tests
with open("backend/tests/test_phase12_operations.py", "w", encoding="utf-8") as f:
    f.write(text)
print("test_phase12_operations.py updated")

