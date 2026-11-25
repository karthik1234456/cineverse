import sqlite3
import random
import json

conn = sqlite3.connect('cineverse.db')
cur = conn.cursor()

# Get active movies with their showtimes
cur.execute('''
    SELECT DISTINCT m.id, m.title, m.slug, m.trailer_source_type, m.trailer_url, m.youtube_trailer_id, s.id as showtime_id, s.cinema_id, s.auditorium_id
    FROM movies m
    JOIN showtimes s ON s.movie_id = m.id
    ORDER BY m.id ASC
''')
all_rows = cur.fetchall()
conn.close()

# Deduplicate by movie id
movies_by_id = {}
for r in all_rows:
    m_id = r[0]
    if m_id not in movies_by_id:
        movies_by_id[m_id] = {
            "id": r[0], "title": r[1], "slug": r[2], "source_type": r[3],
            "trailer_url": r[4], "youtube_id": r[5], "showtime_id": r[6],
            "cinema_id": r[7], "auditorium_id": r[8]
        }

hosted = [m for m in movies_by_id.values() if m["source_type"] == "hosted"]
youtube = [m for m in movies_by_id.values() if m["source_type"] == "youtube" and m["youtube_id"]]
none_type = [m for m in movies_by_id.values() if m["source_type"] == "none" or (not m["youtube_id"] and m["source_type"] != "hosted")]

# Seeded random selection
rng = random.Random(42)
sampled_hosted = rng.sample(hosted, 6)
sampled_yt = rng.sample(youtube, 6)
sampled_none = rng.sample(none_type, 3)

sample_15 = sampled_hosted + sampled_yt + sampled_none

print(f"Sampled 15 titles (Seed 42):")
for idx, m in enumerate(sample_15):
    print(f"[{idx+1:02d}] {m['source_type'].upper():<7} | Movie ID {m['id']:<3} | Showtime {m['showtime_id']:<5} | Cinema {m['cinema_id']} Aud {m['auditorium_id']} | {m['title']}")

with open('evidence/seeded_15_sample.json', 'w') as f:
    json.dump(sample_15, f, indent=2)
