import sqlite3
import os
import subprocess
import json
from PIL import Image

FFMPEG = os.path.abspath('frontend/node_modules/ffmpeg-static/ffmpeg.exe')
TRAILERS_DIR = os.path.abspath('frontend/public/trailers')

conn = sqlite3.connect('cineverse.db')
cur = conn.cursor()
cur.execute('''
    SELECT id, title, slug, trailer_url, genres, duration_minutes
    FROM movies
    WHERE trailer_source_type = 'hosted'
    ORDER BY id ASC
''')
movies = cur.fetchall()
conn.close()

print(f"Auditing {len(movies)} hosted movies...")

# Helper to compute dHash
def dhash(image, hash_size=8):
    image = image.convert('L').resize((hash_size + 1, hash_size), Image.Resampling.LANCZOS)
    pixels = list(image.getdata())
    difference = []
    for row in range(hash_size):
        for col in range(hash_size):
            pixel_left = pixels[row * (hash_size + 1) + col]
            pixel_right = pixels[row * (hash_size + 1) + col + 1]
            difference.append(pixel_left > pixel_right)
    decimal_value = 0
    hex_string = []
    for index, value in enumerate(difference):
        if value:
            decimal_value += 2**(index % 8)
        if (index % 8) == 7:
            hex_string.append(hex(decimal_value)[2:].rjust(2, '0'))
            decimal_value = 0
    return ''.join(hex_string)

def hamming_distance(s1, s2):
    return sum(c1 != c2 for c1, c2 in zip(s1, s2))

movie_signatures = {}
os.makedirs('tmp_audit_frames', exist_ok=True)

for idx, (m_id, title, slug, trailer_url, genres, dur_mins) in enumerate(movies):
    fname = os.path.basename(trailer_url)
    fpath = os.path.join(TRAILERS_DIR, fname)
    if not os.path.exists(fpath):
        print(f"[{idx+1}/{len(movies)}] MISSING FILE: {fpath} for {title}")
        continue

    # Extract 5 sample timestamps (e.g. 2, 5, 8, 12, 16 seconds)
    timestamps = [2, 5, 8, 12, 16]
    hashes = []
    for ts in timestamps:
        frame_out = f"tmp_audit_frames/m_{m_id}_ts_{ts}.png"
        cmd = [
            FFMPEG, "-y", "-ss", f"00:00:{ts:02d}", "-i", fpath,
            "-vframes", "1", "-update", "1", frame_out
        ]
        res = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if os.path.exists(frame_out):
            try:
                with Image.open(frame_out) as img:
                    h = dhash(img, hash_size=16)
                    hashes.append(h)
            except Exception as e:
                hashes.append("0" * 64)
        else:
            hashes.append("0" * 64)

    movie_signatures[m_id] = {
        "title": title,
        "file": fname,
        "hashes": hashes
    }
    if (idx + 1) % 10 == 0 or idx == len(movies) - 1:
        print(f"Processed {idx+1}/{len(movies)} titles...")

# Pairwise comparison
duplicates = []
m_ids = list(movie_signatures.keys())
for i in range(len(m_ids)):
    for j in range(i + 1, len(m_ids)):
        id1, id2 = m_ids[i], m_ids[j]
        m1, m2 = movie_signatures[id1], movie_signatures[id2]
        # Compare all hashes
        dists = [hamming_distance(h1, h2) for h1, h2 in zip(m1["hashes"], m2["hashes"])]
        avg_dist = sum(dists) / len(dists)
        if avg_dist < 2.0:  # extremely close / identical
            duplicates.append({
                "m1": m1["title"], "file1": m1["file"],
                "m2": m2["title"], "file2": m2["file"],
                "avg_dist": avg_dist, "dists": dists
            })

print(f"\n--- Audit Result ---")
print(f"Total checked: {len(movie_signatures)}")
print(f"Near-identical pairs (avg distance < 2.0): {len(duplicates)}")
for d in duplicates[:15]:
    print(f"  {d['m1']} ({d['file1']}) vs {d['m2']} ({d['file2']}): dist={d['avg_dist']}")

with open("evidence/hosted_clips_audit.json", "w") as f:
    json.dump({"total": len(movie_signatures), "duplicates": duplicates}, f, indent=2)
