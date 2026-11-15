import sqlite3
import json
from datetime import datetime, timedelta

def setup_db(db_path):
    print(f"\n--- Setting up {db_path} ---")
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    # Look up patron user
    cur.execute("SELECT id FROM users WHERE email = 'patron@example.com' LIMIT 1")
    row = cur.fetchone()
    if not row:
        print(f"Creating patron user in {db_path}...")
        cur.execute("""
            INSERT INTO users (email, hashed_password, full_name, phone, role, is_active)
            VALUES ('patron@example.com', '$2b$12$e0839G1M9Zq8z9.hIsqG0e1gYyL71z.O2K/d.dC0v23K8M9z1H.', 'Patron User', '+91 98765 43210', 'CUSTOMER', 1)
        """)
        user_id = cur.lastrowid
    else:
        user_id = row[0]
    print(f"Patron user_id: {user_id}")

    now = datetime.utcnow()
    future_start = now + timedelta(hours=6)

    # Pick showtime 1 and ensure its start_time is in the future
    cur.execute("SELECT id FROM showtimes LIMIT 1")
    row = cur.fetchone()
    st_id = row[0]

    cur.execute("UPDATE showtimes SET start_time = ?, cancellation_cutoff_minutes = 120 WHERE id = ?",
                (future_start.isoformat(), st_id))
    print(f"Updated showtime {st_id} start_time to {future_start.isoformat()}")

    # Clean existing demo bookings
    cur.execute("DELETE FROM refunds WHERE booking_id IN (88001, 88002, 88003)")
    cur.execute("DELETE FROM tickets WHERE booking_id IN (88001, 88002, 88003)")
    cur.execute("DELETE FROM booking_addons WHERE booking_id IN (88001, 88002, 88003)")
    cur.execute("DELETE FROM booking_seats WHERE booking_id IN (88001, 88002, 88003)")
    cur.execute("DELETE FROM payments WHERE booking_id IN (88001, 88002, 88003)")
    cur.execute("DELETE FROM bookings WHERE id IN (88001, 88002, 88003)")

    # 1. Booking A: Active Confirmed, can_cancel = True
    cur.execute("""
        INSERT INTO bookings (
            id, booking_code, user_id, showtime_id, status,
            total_ticket_amount, convenience_fee, gst_amount, addons_amount, discount_amount, final_total_amount,
            contact_email, contact_phone, created_at, updated_at
        ) VALUES (
            88001, 'CV-88001-ACT', ?, ?, 'CONFIRMED',
            700.0, 60.0, 10.8, 250.0, 0.0, 1020.8,
            'patron@example.com', '+91 98765 43210', ?, ?
        )
    """, (user_id, st_id, now, now))

    cur.execute("""
        INSERT INTO booking_seats (booking_id, showtime_id, seat_id, category, price)
        VALUES (88001, ?, 'D05', 'Prime', 350.0), (88001, ?, 'D06', 'Prime', 350.0)
    """, (st_id, st_id))

    cur.execute("""
        INSERT INTO booking_addons (booking_id, fnb_item_id, name, quantity, unit_price, total_price)
        VALUES (88001, 1, 'Caramel Popcorn (L)', 1, 250.0, 250.0)
    """)

    cur.execute("""
        INSERT INTO tickets (booking_id, ticket_number, qr_data, qr_code_url, hmac_signature, is_used, issued_at)
        VALUES (88001, 'TKT-88001-QR', 'QR_DEMO_88001', '/posters/interstellar.webp', 'sig88001', 0, ?)
    """, (now,))

    cur.execute("""
        INSERT INTO payments (booking_id, razorpay_order_id, razorpay_payment_id, amount, status)
        VALUES (88001, 'order_88001', 'pay_88001', 1020.8, 'SUCCESS')
    """)

    # 2. Booking B: CANCELLED, with complete Refund and 3-step Timeline
    t1 = (now - timedelta(hours=2)).isoformat()
    t2 = (now - timedelta(hours=1, minutes=30)).isoformat()
    t3 = (now - timedelta(minutes=45)).isoformat()

    timeline = [
        {"status": "REQUESTED", "timestamp": t1, "note": "Cancellation requested by customer within policy window."},
        {"status": "PROCESSING", "timestamp": t2, "note": "Gateway dispatch processed: rfnd_speed_99182. Awaiting settlement."},
        {"status": "REFUNDED", "timestamp": t3, "note": "Refund of ₹775.00 credited back to ICICI NetBanking ····4012."}
    ]

    cur.execute("""
        INSERT INTO bookings (
            id, booking_code, user_id, showtime_id, status,
            total_ticket_amount, convenience_fee, gst_amount, addons_amount, discount_amount, final_total_amount,
            contact_email, contact_phone, created_at, updated_at
        ) VALUES (
            88002, 'CV-88002-REF', ?, ?, 'CANCELLED',
            700.0, 60.0, 10.8, 250.0, 0.0, 1020.8,
            'patron@example.com', '+91 98765 43210', ?, ?
        )
    """, (user_id, st_id, now - timedelta(hours=3), now))

    cur.execute("""
        INSERT INTO tickets (booking_id, ticket_number, qr_data, qr_code_url, hmac_signature, is_used, issued_at)
        VALUES (88002, 'TKT-88002-QR', 'QR_DEMO_88002', '/posters/oppenheimer.webp', 'sig88002', 0, ?)
    """, (now - timedelta(hours=3),))

    cur.execute("""
        INSERT INTO payments (booking_id, razorpay_order_id, razorpay_payment_id, amount, status)
        VALUES (88002, 'order_88002', 'pay_88002', 1020.8, 'REFUNDED')
    """)

    cur.execute("""
        INSERT INTO refunds (
            booking_id, payment_id, refund_amount, cancellation_fee,
            amount_paise, cancellation_fee_paise, ticket_amount_paise, addons_amount_paise, convenience_fee_paise, gst_amount_paise,
            gateway_refund_id, reason, status, timeline, is_stuck, error_message, created_at, updated_at
        ) VALUES (
            88002, 1, 775.0, 245.8,
            77500, 24580, 70000, 25000, 6000, 1080,
            'rfnd_speed_99182', 'Customer cancellation within policy window', 'REFUNDED',
            ?, 0, NULL, ?, ?
        )
    """, (json.dumps(timeline), now - timedelta(hours=2), now - timedelta(minutes=45)))

    # 3. Booking C: STUCK / DELAYED REFUND (for Admin monitoring)
    stuck_timeline = [
        {"status": "REQUESTED", "timestamp": (now - timedelta(hours=4)).isoformat(), "note": "Cancellation requested by customer."},
        {"status": "PROCESSING", "timestamp": (now - timedelta(hours=3)).isoformat(), "note": "Gateway dispatch attempt failed."},
        {"status": "FAILED", "timestamp": (now - timedelta(hours=2)).isoformat(), "note": "Gateway timeout: Bank server unreachable (ERR_GATEWAY_TIMEOUT)"}
    ]

    cur.execute("""
        INSERT INTO bookings (
            id, booking_code, user_id, showtime_id, status,
            total_ticket_amount, convenience_fee, gst_amount, addons_amount, discount_amount, final_total_amount,
            contact_email, contact_phone, created_at, updated_at
        ) VALUES (
            88003, 'CV-88003-STK', ?, ?, 'CANCELLED',
            350.0, 30.0, 5.4, 0.0, 0.0, 385.4,
            'patron@example.com', '+91 98765 43210', ?, ?
        )
    """, (user_id, st_id, now - timedelta(hours=5), now))

    cur.execute("""
        INSERT INTO payments (booking_id, razorpay_order_id, razorpay_payment_id, amount, status)
        VALUES (88003, 'order_88003', 'pay_88003', 385.4, 'REFUND_FAILED')
    """)

    cur.execute("""
        INSERT INTO refunds (
            booking_id, payment_id, refund_amount, cancellation_fee,
            amount_paise, cancellation_fee_paise, ticket_amount_paise, addons_amount_paise, convenience_fee_paise, gst_amount_paise,
            gateway_refund_id, reason, status, timeline, is_stuck, error_message, created_at, updated_at
        ) VALUES (
            88003, 1, 262.5, 122.9,
            26250, 12290, 35000, 0, 3000, 540,
            'rfnd_fail_88003', 'Gateway connection error', 'FAILED',
            ?, 1, 'Gateway timeout: Bank server unreachable (ERR_GATEWAY_TIMEOUT)', ?, ?
        )
    """, (json.dumps(stuck_timeline), now - timedelta(hours=4), now - timedelta(hours=2)))

    conn.commit()
    conn.close()
    print(f"Setup complete for {db_path}!")

if __name__ == '__main__':
    for db in ['cineverse.db', 'backend/cineverse.db']:
        setup_db(db)
