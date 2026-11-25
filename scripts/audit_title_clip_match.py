import sqlite3
import os
import re

TRAILERS_DIR = os.path.abspath('frontend/public/trailers')

conn = sqlite3.connect('cineverse.db')
cur = conn.cursor()
cur.execute('''
    SELECT id, title, slug, trailer_url, hosted_trailer_url
    FROM movies
    WHERE trailer_source_type = 'hosted' OR is_showcase = 1
    ORDER BY id ASC
''')
rows = cur.fetchall()
conn.close()

print(f"Auditing title & clip match for {len(rows)} hosted titles...")

matched = []
mismatched = []

for m_id, title, slug, t_url, ht_url in rows:
    url = t_url or ht_url or ''
    fname = os.path.basename(url)
    base_name = os.path.splitext(fname)[0]
    fpath = os.path.join(TRAILERS_DIR, fname)
    vtt_path = os.path.join(TRAILERS_DIR, f"{base_name}_captions.vtt")

    # Read VTT if exists
    vtt_text = ""
    if os.path.exists(vtt_path):
        with open(vtt_path, 'r', encoding='utf-8', errors='ignore') as f:
            vtt_text = f.read()

    # Normalize title for matching
    # e.g., "Astra: Chronicles of the Celestial Throne" -> check if title or core words appear in vtt
    title_clean = re.sub(r'[:\-\']', '', title).lower()
    vtt_clean = re.sub(r'[:\-\']', '', vtt_text).lower()

    # Core title is the part before the colon or main phrase
    core_title = title.split(':')[0].strip().lower()

    has_match = (title.lower() in vtt_text.lower()) or (core_title in vtt_clean)
    
    info = {
        "id": m_id,
        "title": title,
        "clip_file": fname,
        "vtt_file": os.path.basename(vtt_path) if os.path.exists(vtt_path) else None,
        "has_vtt": os.path.exists(vtt_path),
        "vtt_snippet": vtt_text.split('\n')[3] if (os.path.exists(vtt_path) and len(vtt_text.split('\n')) > 3) else None,
        "has_match": has_match
    }

    if has_match:
        matched.append(info)
    else:
        mismatched.append(info)

print(f"Matched: {len(matched)}")
print(f"Mismatched / Missing: {len(mismatched)}")
for m in mismatched:
    print(f"  FAIL: [{m['id']}] '{m['title']}' -> Clip: {m['clip_file']} | VTT: {m['vtt_file']} | Snippet: {m['vtt_snippet']}")
