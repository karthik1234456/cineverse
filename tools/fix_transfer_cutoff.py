with open("backend/tests/test_phase12_operations.py", "r", encoding="utf-8") as f:
    text = f.read()

target = """        # Restore Showtime 1 to TODAY so browse / movie tests never find empty showtimes
        st = await db.get(Showtime, 1)
        if st:
            today_date = datetime.utcnow().date()
            st.start_time = datetime.combine(today_date, time(18, 0))
            st.end_time = datetime.combine(today_date, time(20, 45))"""

repl = """        # Use a future showtime (e.g. tomorrow or +5 hours) to satisfy the 2-hour transfer cutoff
        st = await db.get(Showtime, 1)
        if st:
            st.start_time = datetime.utcnow() + timedelta(hours=4)
            st.end_time = datetime.utcnow() + timedelta(hours=6, minutes=45)"""

assert target in text, "Target not found in test_phase12_operations.py"
text = text.replace(target, repl, 1)

with open("backend/tests/test_phase12_operations.py", "w", encoding="utf-8") as f:
    f.write(text)
print("Updated test_phase12_operations.py successfully")

