path = 'backend/tests/test_phase5_payments.py'
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

new_wh_test = '''
@pytest.mark.asyncio
async def test_webhook_forged_signature_rejected(client: AsyncClient):
    """FIX-01: Webhook with forged signature header is rejected with 400."""
    payload = {"event_id": f"evt_forged_{uuid.uuid4().hex[:8]}", "event": "payment.captured"}
    import json
    body_bytes = json.dumps(payload).encode("utf-8")
    resp = await client.post(
        "/api/v1/payments/webhook",
        content=body_bytes,
        headers={"X-Razorpay-Signature": "invalid_forged_sig_deadbeef", "Content-Type": "application/json"}
    )
    assert resp.status_code == 400
    assert "Invalid webhook signature" in resp.text
'''

with open(path, 'a', encoding='utf-8') as f:
    f.write("\n\n" + new_wh_test.strip() + "\n")

print("Added test_webhook_forged_signature_rejected")

