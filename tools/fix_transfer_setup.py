path = 'backend/tests/test_phase12_operations.py'
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

# Replace the transfer test setup to:
# 1. Use a dedicated synthetic showtime or clean up TicketTransferLog for user 3
# 2. Restore Showtime 1's start_time and end_time
old_setup = '''    # Ensure recipient account exists and clear conflicting seat
    async with AsyncSessionLocal() as db:
        await db.execute(delete(BookingSeat).where(BookingSeat.showtime_id == 1, BookingSeat.seat_id == "E05"))

        recip_res = await db.execute(select(User).where(User.email == "recipient@cineverse.in"))
        recip = recip_res.scalars().first()
        if not recip:
            recip = User(email="recipient@cineverse.in", hashed_password="hashed_pw", role="CUSTOMER")
            db.add(recip)

        st = await db.get(Showtime, 1)
        if st:
            st.start_time = datetime.utcnow() + timedelta(days=2)
            st.end_time = datetime.utcnow() + timedelta(days=2, hours=3)'''

new_setup = '''    # Ensure recipient account exists, clear prior transfer logs for user 3, and use an isolated test showtime
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
            st.end_time = datetime.combine(today_date, time(20, 45))'''

if old_setup in c:
    c = c.replace(old_setup, new_setup)
    # Ensure time is imported
    if "from datetime import datetime, timedelta, time" not in c:
        c = c.replace("from datetime import datetime, timedelta", "from datetime import datetime, timedelta, time")
    with open(path, 'w', encoding='utf-8') as f:
        f.write(c)
    print("Updated test_phase12_operations.py setup to isolate transfer logs and restore Showtime 1")
else:
    print("old_setup not found")

