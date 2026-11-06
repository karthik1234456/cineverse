import time
import sqlite3
import statistics

import os
db_path = 'cineverse.db' if os.path.exists('cineverse.db') else 'backend/cineverse.db'
con = sqlite3.connect(db_path)

def benchmark(query, params, name, iterations=100):
    latencies = []
    for _ in range(iterations):
        t0 = time.perf_counter()
        cur = con.execute(query, params)
        rows = cur.fetchall()
        t1 = time.perf_counter()
        latencies.append((t1 - t0) * 1000) # ms

    latencies.sort()
    p50 = latencies[int(iterations * 0.50)]
    p95 = latencies[int(iterations * 0.95)]
    p99 = latencies[int(iterations * 0.99)]
    print(f"[{name}] (rows={len(rows)}): p50={p50:.2f}ms, p95={p95:.2f}ms, p99={p99:.2f}ms")
    return p95

print("--- CineVerse Query Performance Benchmark ---")

# 1. Fetch cinemas for city 'bengaluru' (city_id = 1)
p95_1 = benchmark(
    "SELECT * FROM cinemas WHERE city_id = 1",
    (), "1. Cinemas by City (Bengaluru)"
)

# 2. Fetch showtimes for cinema 1 for today
p95_2 = benchmark(
    "SELECT * FROM showtimes WHERE cinema_id = 1 AND start_time >= datetime('now') LIMIT 50",
    (), "2. Showtimes by Cinema"
)

# 3. Fetch showtimes for movie 1 in city 1
p95_3 = benchmark(
    """
    SELECT s.* FROM showtimes s
    JOIN cinemas c ON s.cinema_id = c.id
    WHERE c.city_id = 1 AND s.movie_id = 1
    LIMIT 50
    """,
    (), "3. Movie Showtimes in City"
)

# 4. Fetch all seats and status for a showtime
p95_4 = benchmark(
    "SELECT * FROM seat_inventory WHERE showtime_id = 1",
    (), "4. Seat Inventory for Showtime"
)

# 5. Fetch available seats count grouped by category for a showtime
p95_5 = benchmark(
    """
    SELECT category, status, count(*)
    FROM seat_inventory
    WHERE showtime_id = 1
    GROUP BY category, status
    """,
    (), "5. Seat Availability Aggregation"
)

con.close()

assert all(p < 300.0 for p in [p95_1, p95_2, p95_3, p95_4, p95_5]), "All p95 latencies must be under 300ms!"
print("\nALL QUERIES PASSED: p95 latency is significantly under 300ms!")

