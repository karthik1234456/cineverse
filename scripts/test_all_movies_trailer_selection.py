import json
import subprocess
import os
import sqlite3

def check_youtube_video_details(video_key: str):
    if not video_key:
        return False, False, 0, 0, ""
    
    # 1. Check if Short
    is_short = False
    try:
        cmd_short = [
            "curl.exe" if os.name == "nt" else "curl",
            "-4", "-s", "-I",
            "--max-time", "1.5",
            f"https://www.youtube.com/shorts/{video_key}",
        ]
        res_short = subprocess.run(cmd_short, capture_output=True, text=True, timeout=2.0)
        if "HTTP/1.1 200" in res_short.stdout or "HTTP/2 200" in res_short.stdout:
            is_short = True
    except Exception:
        pass

    # 2. Check oEmbed
    is_embeddable = False
    w = 0
    h = 0
    title = ""
    try:
        url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_key}&format=json"
        cmd_oembed = [
            "curl.exe" if os.name == "nt" else "curl",
            "-4", "-s",
            "--max-time", "2.0",
            url,
        ]
        res_oembed = subprocess.run(cmd_oembed, capture_output=True, text=True, timeout=2.5)
        text = res_oembed.stdout.strip()
        if text.startswith("{"):
            data = json.loads(text)
            is_embeddable = True
            w = int(data.get("width", 0))
            h = int(data.get("height", 0))
            title = data.get("title", "")
    except Exception:
        pass

    return is_embeddable, is_short, w, h, title

def select_best_trailer(videos):
    yt_candidates = [v for v in videos if v.get("site") == "YouTube" and v.get("key")]
    def rank(v):
        vtype = v.get("type", "")
        off = bool(v.get("official", False))
        if vtype == "Trailer" and off: return 0
        if vtype == "Trailer": return 1
        if vtype == "Teaser" and off: return 2
        if vtype == "Teaser": return 3
        return 99

    eligible = [v for v in yt_candidates if rank(v) < 99]
    sorted_candidates = sorted(eligible, key=rank)

    for cand in sorted_candidates:
        key = cand.get("key")
        name = cand.get("name", "")
        if "#short" in name.lower() or "short" in name.lower():
            continue
        is_emb, is_sh, w, h, yt_title = check_youtube_video_details(key)
        if is_sh:
            continue
        if not is_emb:
            continue
        if h > 0 and w > 0 and h >= w:
            continue
        vtype = cand.get("type", "Trailer")
        is_off = cand.get("official", False)
        reason = f"{'Official' if is_off else 'Public'} 16:9 {vtype} ({w}x{h}) — oEmbed 200 OK: '{yt_title or name}'"
        return key, True, reason

    return None, False, "No qualifying 16:9 landscape embeddable trailer found; using Title Card"

def main():
    conn = sqlite3.connect("backend/cineverse.db")
    cur = conn.cursor()
    cur.execute("SELECT id, title, tmdb_id, youtube_trailer_id, trailer_url FROM movies WHERE is_tmdb = 1")
    db_movies = cur.fetchall()

    with open("backend/app/seed/tmdb_synced_cache.json", "r", encoding="utf-8") as f:
        cache = json.load(f)
    cache_by_id = {m.get("id"): m for m in cache}

    print(f"Comparing {len(db_movies)} DB movies against new strict trailer selector...")
    changed = []

    for m_id, title, tmdb_id, cur_yt_id, cur_url in db_movies:
        cache_item = cache_by_id.get(tmdb_id)
        if not cache_item:
            continue
        videos = cache_item.get("videos", {}).get("results", [])
        new_key, new_emb, new_reason = select_best_trailer(videos)
        
        if new_key != cur_yt_id:
            changed.append({
                "id": m_id,
                "title": title,
                "old_key": cur_yt_id,
                "new_key": new_key,
                "new_reason": new_reason,
            })
            print(f"CHANGED: [{m_id}] '{title}': '{cur_yt_id}' -> '{new_key}' ({new_reason})")
        else:
            print(f"UNCHANGED: [{m_id}] '{title}': '{cur_yt_id}'")

    print(f"\nTotal changed titles: {len(changed)}")
    with open("evidence/perf-profile/trailer_changes.json", "w", encoding="utf-8") as f:
        json.dump(changed, f, indent=2)

if __name__ == "__main__":
    main()
