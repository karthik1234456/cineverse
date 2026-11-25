import sys
import os
import json
import subprocess
sys.path.insert(0, os.path.abspath('backend'))

from app.services.catalog.tmdb import _execute_tmdb_curl

def check_oembed(key):
    try:
        url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={key}&format=json"
        cmd = ["curl.exe", "-4", "-s", "--max-time", "2.0", url]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=2.5)
        txt = res.stdout.strip()
        if txt.startswith("{"):
            d = json.loads(txt)
            return True, d.get("width"), d.get("height"), d.get("title")
        return False, 0, 0, txt[:50]
    except Exception as e:
        return False, 0, 0, str(e)

def main():
    videos = _execute_tmdb_curl('/movie/1263337/videos', timeout=5.0)
    if not videos or 'results' not in videos:
        print("Failed to get videos")
        return

    results = videos['results']
    print(f"Total videos: {len(results)}", flush=True)

    # Priority sort: Official Trailer -> Trailer -> Official Teaser -> Teaser -> Official Featurette -> Featurette -> Clip
    def priority(v):
        t = v.get('type')
        off = v.get('official', False)
        if t == 'Trailer' and off: return 0
        if t == 'Trailer': return 1
        if t == 'Teaser' and off: return 2
        if t == 'Teaser': return 3
        if t == 'Featurette' and off: return 4
        if t == 'Featurette': return 5
        if t == 'Clip' and off: return 6
        if t == 'Clip': return 7
        return 99

    sorted_vids = sorted([v for v in results if priority(v) < 99], key=priority)
    print(f"Sorted candidates: {len(sorted_vids)}", flush=True)

    for v in sorted_vids[:10]:
        key = v.get('key')
        name = v.get('name')
        v_type = v.get('type')
        off = v.get('official')
        emb, w, h, info = check_oembed(key)
        print(f"[{'YES' if emb else 'NO'}] key={key} type={v_type} off={off} size={w}x{h} name='{name}' info='{info}'", flush=True)

if __name__ == '__main__':
    main()
