import sqlite3
import os
import shutil

TRAILERS_DIR = os.path.abspath('frontend/public/trailers')

renames = [
    {
        "old_base": "delhi-6-weddings",
        "new_base": "big-fat-chandni-chowk-wedding",
        "title": "Big Fat Chandni Chowk Wedding"
    },
    {
        "old_base": "ghat-crematorium",
        "new_base": "midnight-at-sinhagad",
        "title": "Midnight at Sinhagad"
    }
]

conn = sqlite3.connect('cineverse.db')
cur = conn.cursor()

for r in renames:
    old_base, new_base, title = r["old_base"], r["new_base"], r["title"]
    # Copy files with new names (keep old as well for backward compatibility)
    for ext in ['.mp4', '_captions.vtt', '_poster.webp']:
        old_f = os.path.join(TRAILERS_DIR, f"{old_base}{ext}")
        new_f = os.path.join(TRAILERS_DIR, f"{new_base}{ext}")
        if os.path.exists(old_f):
            shutil.copyfile(old_f, new_f)
            print(f"Created: {new_f}")

    # Update database
    new_trailer_url = f"/trailers/{new_base}.mp4"
    new_vtt_url = f"/trailers/{new_base}_captions.vtt"
    new_poster_url = f"/trailers/{new_base}_poster.webp"
    cur.execute('''
        UPDATE movies
        SET trailer_url = ?,
            hosted_trailer_url = ?,
            hosted_trailer_webm_url = ?,
            trailer_captions_url = ?,
            hosted_trailer_poster_url = ?
        WHERE title = ?
    ''', (new_trailer_url, new_trailer_url, new_trailer_url, new_vtt_url, new_poster_url, title))
    print(f"Updated DB for '{title}' -> {new_trailer_url}")

# Ensure Sample Showcase has trailer_captions_url in DB
cur.execute('''
    UPDATE movies
    SET trailer_captions_url = '/trailers/sample-showcase_captions.vtt'
    WHERE title = 'Sample Showcase'
''')

conn.commit()
conn.close()
print("Mapping fix completed successfully.")
