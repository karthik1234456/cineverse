import sys
import os
sys.path.insert(0, os.path.abspath('backend'))

from app.services.catalog.tmdb import _execute_tmdb_curl, check_youtube_video_details

tmdb_ids = [
    (53, 'Ghost Soldier', 1562642),
    (56, 'Street Fighter', 1153576),
    (58, 'Mookuthi Amman 2', 1327835),
    (60, 'Scene', 1402181),
    (64, 'DNK', 1641520),
    (66, 'Disco', 1612811),
    (67, 'Udta Teer', 1375156),
    (100, 'Premada Oorali', 1735270),
    (101, 'Kantara - A Legend: Chapter 1', 1083637),
    (106, 'The Third Murder', 922673),
    (107, 'Ashleel Udyog Mitra Mandal', 1215150),
    (108, 'Antarvasna', 862163),
    (109, 'Gondhal', 1576389),
    (110, 'Gangor', 278986),
    (111, 'Bonolota Express', 1542995),
    (112, 'Dispassionate Love', 617359),
]

print(f"Testing {len(tmdb_ids)} movies for videos in TMDB...")
for mid, title, tid in tmdb_ids:
    res = _execute_tmdb_curl(f"/movie/{tid}/videos", timeout=6.0, retries=2)
    if not res:
        print(f"[{mid}] {title} (TMDB {tid}): Failed to fetch or null")
        continue
    results = res.get("results", [])
    print(f"[{mid}] {title} (TMDB {tid}): {len(results)} videos found")
    if results:
        for idx, v in enumerate(results):
            site = v.get("site")
            key = v.get("key")
            vtype = v.get("type")
            name = v.get("name")
            official = v.get("official")
            if site == "YouTube" and key:
                is_emb, is_sh, w, h, yt_title = check_youtube_video_details(key)
                print(f"   -> cand {idx}: type={vtype}, official={official}, key={key}, emb={is_emb}, short={is_sh}, res={w}x{h}, name='{name}'")
            else:
                print(f"   -> cand {idx}: site={site}, key={key}, type={vtype}")
