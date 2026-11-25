import json
import subprocess
import urllib.request
import os

def is_youtube_short(key: str) -> bool:
    """Returns True if YouTube treats this key as a vertical Short (HTTP 200 on /shorts/{key})."""
    if not key:
        return False
    try:
        cmd = [
            "curl.exe" if os.name == "nt" else "curl",
            "-4", "-s", "-I",
            "--max-time", "2.0",
            f"https://www.youtube.com/shorts/{key}"
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=2.5)
        # 200 OK means it is served as a Short; 303 redirect means standard video
        return "HTTP/1.1 200" in res.stdout or "HTTP/2 200" in res.stdout
    except Exception:
        return False

def get_oembed_info(key: str):
    """Fetches oEmbed info. Returns (is_embeddable, width, height, title)."""
    if not key:
        return False, 0, 0, ""
    try:
        url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={key}&format=json"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=2.5) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode())
                w = data.get("width", 0)
                h = data.get("height", 0)
                title = data.get("title", "")
                return True, w, h, title
    except Exception:
        pass
    return False, 0, 0, ""

def test_social_reckoning():
    with open('backend/app/seed/tmdb_synced_cache.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    movie = next(m for m in data if m.get('id') == 1281331)
    videos = movie.get('videos', {}).get('results', [])
    print(f"Evaluating {len(videos)} candidate videos for {movie.get('title')}...")
    
    # Priority sorting:
    # 0: Official Trailer, 1: Any Trailer, 2: Official Teaser, 3: Any Teaser, 4: Other
    def priority(v):
        vtype = v.get("type", "")
        off = bool(v.get("official", False))
        if vtype == "Trailer" and off: return 0
        if vtype == "Trailer": return 1
        if vtype == "Teaser" and off: return 2
        if vtype == "Teaser": return 3
        return 4

    sorted_candidates = sorted([v for v in videos if v.get("site") == "YouTube" and v.get("key")], key=priority)
    
    selected = None
    selected_reason = ""
    for cand in sorted_candidates:
        key = cand.get("key")
        name = cand.get("name", "")
        vtype = cand.get("type", "")
        off = bool(cand.get("official", False))
        
        # Check if Short by name
        if "#short" in name.lower() or "short" in name.lower():
            print(f"Skipping {key} ({name}): Short in name")
            continue
            
        # Check if YouTube treats as Short
        if is_youtube_short(key):
            print(f"Skipping {key} ({name}): Detected as YouTube Short via /shorts/{key} (HTTP 200)")
            continue
            
        # Check oEmbed
        embeddable, w, h, title = get_oembed_info(key)
        if not embeddable:
            print(f"Skipping {key} ({name}): oEmbed refused embedding")
            continue
            
        if h > w:
            print(f"Skipping {key} ({name}): Vertical video ({w}x{h})")
            continue
            
        selected = cand
        selected_reason = f"Official 16:9 {vtype} ({w}x{h}) — oEmbed 200 OK: '{title}'"
        break
        
    if selected:
        print(f"\nSUCCESS! Selected: {selected.get('key')} | Type: {selected.get('type')} | Name: {selected.get('name')}")
        print(f"Reason: {selected_reason}")
    else:
        print("\nNo qualifying candidate! Fallback to title card.")

if __name__ == "__main__":
    test_social_reckoning()
