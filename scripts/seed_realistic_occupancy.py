import os
import sys
import sqlite3
import random
from datetime import datetime, timedelta

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(ROOT_DIR, "backend"))

from app.services.occupancy_seeder import generate_natural_occupancy

DB_PATH = os.path.join(ROOT_DIR, "cineverse.db")
print(f"Connecting to {DB_PATH} for realistic occupancy seeding (§ Part C)...")

con = sqlite3.connect(DB_PATH)
cur = con.cursor()

# Get all showtimes
showtimes = cur.execute("SELECT id, start_time FROM showtimes").fetchall()
print(f"Total showtimes to seed: {len(showtimes)}")

# Pre-determine nearly full and sold out showtimes
random.seed(42) # Reproducible baseline
nearly_full_ids = set(random.sample([s[0] for s in showtimes], int(len(showtimes) * 0.03)))
sold_out_ids = set(random.sample([s[0] for s in showtimes if s[0] not in nearly_full_ids], int(len(showtimes) * 0.01)))

# Ensure Grand Balcony (3449) has 30% realistic evening booked occupancy
explicit_targets = {
    3449: 0.30, # Grand Balcony Hall (Dolby Cinema, 216 seats) -> ~65 booked
    1: 0.25,    # Compact Hall (100 seats) -> 25 booked
    56: 0.32,   # Standard Stadium (234 seats) -> ~75 booked
    21: 0.28,   # Motion-seat Arena (280 seats) -> ~78 booked
}

updates = []
cur_held_time = (datetime.now() + timedelta(minutes=10)).isoformat()

total_booked_all = 0
total_held_all = 0
total_seats_all = 0

batch_size = 500

for idx, (st_id, start_time_str) in enumerate(showtimes):
    try:
        st_time = datetime.fromisoformat(start_time_str)
    except Exception:
        st_time = datetime.now()

    # Get seats for this showtime
    inv_rows = cur.execute("SELECT id, seat_id FROM seat_inventory WHERE showtime_id = ?", (st_id,)).fetchall()
    if not inv_rows:
        continue

    seats_list = [{"inv_id": r[0], "seat_id": r[1]} for r in inv_rows]
    total_seats_all += len(seats_list)

    target_pct = explicit_targets.get(st_id)
    special_mode = None
    if target_pct is None:
        if st_id in sold_out_ids:
            special_mode = "sold_out"
        elif st_id in nearly_full_ids:
            special_mode = "nearly_full"

    booked_ids, held_ids = generate_natural_occupancy(
        seats=seats_list,
        start_time=st_time,
        target_pct=target_pct,
        special_mode=special_mode
    )

    booked_set = set(booked_ids)
    held_set = set(held_ids)

    for item in seats_list:
        s_id = item["seat_id"]
        inv_id = item["inv_id"]
        if s_id in booked_set:
            updates.append(('BOOKED', None, inv_id))
            total_booked_all += 1
        elif s_id in held_set:
            updates.append(('HELD', cur_held_time, inv_id))
            total_held_all += 1
        else:
            updates.append(('AVAILABLE', None, inv_id))

    if len(updates) >= 50000:
        cur.executemany("UPDATE seat_inventory SET status = ?, hold_expires_at = ? WHERE id = ?", updates)
        con.commit()
        updates = []
        print(f"  Processed {idx + 1}/{len(showtimes)} showtimes...")

if updates:
    cur.executemany("UPDATE seat_inventory SET status = ?, hold_expires_at = ? WHERE id = ?", updates)
    con.commit()

# Report specific verification showtimes
print("\n=== Verification Showtimes Summary ===")
for st_id in [3449, 1, 56, 21]:
    counts = cur.execute("""
        SELECT status, count(*) FROM seat_inventory
        WHERE showtime_id = ?
        GROUP BY status
    """, (st_id,)).fetchall()
    c_map = dict(counts)
    tot = sum(c_map.values())
    bk = c_map.get('BOOKED', 0)
    hd = c_map.get('HELD', 0)
    av = c_map.get('AVAILABLE', 0)
    pct = (bk / tot * 100) if tot > 0 else 0
    print(f"Showtime {st_id}: Total={tot}, Available={av}, Booked={bk} ({pct:.1f}%), Held={hd}")

con.close()
print(f"\nRealistic occupancy seeding COMPLETE!")
print(f"Overall stats: {total_seats_all} seats across {len(showtimes)} showtimes. Booked: {total_booked_all} ({total_booked_all/total_seats_all*100:.1f}%), Held: {total_held_all}")
