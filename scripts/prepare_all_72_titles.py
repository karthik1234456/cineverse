import sqlite3
import json
import os

conn = sqlite3.connect('cineverse.db')
cur = conn.cursor()

# Get all 87 movies with showtimes
query = """
SELECT DISTINCT m.id, m.title, m.slug, m.trailer_source_type, m.trailer_embeddable, m.youtube_trailer_id, m.trailer_url,
       s.id as showtime_id, s.cinema_id, s.auditorium_id
FROM movies m
JOIN showtimes s ON m.id = s.movie_id
GROUP BY m.id
ORDER BY m.id ASC
"""

cur.execute(query)
rows = cur.fetchall()
conn.close()

# Load the 15 titles measured in the initial run
with open('evidence/seeded_15_sample.json', 'r', encoding='utf-8') as f:
    seeded_15 = json.load(f)
seeded_ids = {item['id'] for item in seeded_15}

# Wildwood (ID 54) and Kochi (ID 41) will be re-measured with the new 3-frame threshold!
re_measure_ids = {54, 41}
# Remaining titles that were not in seeded_15
remaining_movies = []
for r in rows:
    mid, title, slug, stype, embeddable, ytid, vurl, st_id, cid, aid = r
    # Normalize source type: if youtube and embeddable == 0 or empty id, stype is 'none'
    if stype == 'youtube' and (embeddable == 0 or not ytid):
        effective_stype = 'none'
    else:
        effective_stype = stype

    item = {
        'id': mid,
        'title': title,
        'slug': slug,
        'source_type': effective_stype,
        'youtube_trailer_id': ytid,
        'trailer_url': vurl,
        'showtime_id': st_id,
        'cinema_id': cid,
        'auditorium_id': aid,
        'url': f"http://localhost:3002/cinemas/{cid}/auditorium/{aid}?showtime={st_id}&mode=3d&debug=1"
    }

    if mid not in seeded_ids or mid in re_measure_ids:
        remaining_movies.append(item)

print(f"Total active titles in catalogue: {len(rows)}")
print(f"Initial seeded sample: {len(seeded_ids)}")
print(f"Titles to measure (remaining + re-measures): {len(remaining_movies)}")

hosted_movies = [m for m in remaining_movies if m['source_type'] == 'hosted']
youtube_movies = [m for m in remaining_movies if m['source_type'] == 'youtube']
fallback_movies = [m for m in remaining_movies if m['source_type'] == 'none']

print(f"  Hosted: {len(hosted_movies)}")
print(f"  YouTube: {len(youtube_movies)}")
print(f"  Fallback (No Trailer): {len(fallback_movies)}")

# Split into 3 batches
# Batch 1: Hosted part 1 (23 titles)
# Batch 2: Hosted part 2 (23 titles)
# Batch 3: YouTube + Fallbacks (24 + 4 = 28 titles)
b1 = hosted_movies[:23]
b2 = hosted_movies[23:]
b3 = youtube_movies + fallback_movies

with open('evidence/batch_hosted_1.json', 'w', encoding='utf-8') as f:
    json.dump(b1, f, indent=2)

with open('evidence/batch_hosted_2.json', 'w', encoding='utf-8') as f:
    json.dump(b2, f, indent=2)

with open('evidence/batch_youtube_and_fallback.json', 'w', encoding='utf-8') as f:
    json.dump(b3, f, indent=2)

print("Saved batch_hosted_1.json, batch_hosted_2.json, batch_youtube_and_fallback.json")
