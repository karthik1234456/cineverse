import sqlite3

conn = sqlite3.connect('cineverse.db')
c = conn.cursor()
c.execute("UPDATE movies SET trailer_reason = 'Hosted video texture: /trailers/showcase.mp4 (16:9 local video)' WHERE is_showcase = 1 AND trailer_reason IS NULL")
conn.commit()
print(f"Updated {c.rowcount} showcase movies with hosted video reason.")

# Also check for any movies with trailer_reason still None
c.execute("SELECT id, title, is_showcase, is_tmdb, youtube_trailer_id FROM movies WHERE trailer_reason IS NULL")
remaining = c.fetchall()
print(f"Remaining movies without trailer_reason: {len(remaining)}")
for r in remaining:
    print(r)
