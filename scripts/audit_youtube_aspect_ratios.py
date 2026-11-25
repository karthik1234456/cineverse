import sqlite3
import urllib.request
import json
import re

conn = sqlite3.connect('cineverse.db')
cur = conn.cursor()
cur.execute('''
    SELECT id, title, trailer_url, trailer_source_type, is_showcase
    FROM movies
    WHERE trailer_source_type = 'youtube' OR trailer_url LIKE '%youtu%'
    ORDER BY id ASC
''')
rows = cur.fetchall()
conn.close()

print(f"Auditing {len(rows)} YouTube trailer entries in database...")

def get_yt_id(url):
    if not url:
        return None
    m = re.search(r'(?:youtu\.be\/|(?:youtube\.com|youtube-nocookie\.com)\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})', url)
    if m:
        return m.group(1)
    if re.match(r'^[\w-]{11}$', url.strip()):
        return url.strip()
    return None

results = []
portrait_or_shorts = []

for idx, (m_id, title, url, s_type, is_sc) in enumerate(rows):
    yt_id = get_yt_id(url)
    is_short_url = 'shorts' in (url or '').lower()
    oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={yt_id}&format=json"

    width, height = None, None
    error = None
    try:
        req = urllib.request.Request(oembed_url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            width = data.get('width')
            height = data.get('height')
    except Exception as e:
        error = str(e)

    aspect_ratio = (width / height) if (width and height) else None
    is_portrait = aspect_ratio is not None and aspect_ratio < 1.0
    is_non_landscape = aspect_ratio is not None and aspect_ratio < 1.3

    entry = {
        "id": m_id,
        "title": title,
        "youtube_id": yt_id,
        "url": url,
        "width": width,
        "height": height,
        "aspect_ratio": aspect_ratio,
        "is_short_url": is_short_url,
        "is_portrait": is_portrait,
        "error": error
    }
    results.append(entry)

    if is_portrait or is_short_url:
        portrait_or_shorts.append(entry)
        print(f"FAILED ASPECT/SHORTS: [{m_id}] {title} (ID: {yt_id}) - {width}x{height}, short={is_short_url}")
    else:
        print(f"OK: [{m_id}] {title} (ID: {yt_id}) - {width}x{height} (ratio {aspect_ratio})")

print(f"\n--- YouTube Aspect Ratio Audit ---")
print(f"Total checked: {len(results)}")
print(f"Portrait or Shorts found: {len(portrait_or_shorts)}")

with open('evidence/youtube_aspect_ratio_audit.json', 'w') as f:
    json.dump({"total": len(results), "portrait_or_shorts": portrait_or_shorts, "details": results}, f, indent=2)
