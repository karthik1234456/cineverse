with open("backend/tests/test_phase5_payments.py", "r", encoding="utf-8") as f:
    text = f.read()

target = "    # Generate legitimate signature\n    signature = generate_ticket_signature(booking_code, showtime_id, seats)\n    assert len(signature) == 64"
repl = "    # Generate legitimate signature (Ed25519 base64)\n    signature = generate_ticket_signature(booking_code, showtime_id, seats)\n    assert len(signature) >= 64"

assert target in text
text = text.replace(target, repl, 1)

with open("backend/tests/test_phase5_payments.py", "w", encoding="utf-8") as f:
    f.write(text)
print("test_phase5_payments.py updated")

