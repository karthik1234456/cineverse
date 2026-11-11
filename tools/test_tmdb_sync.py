import os
import subprocess
import json
from dotenv import load_dotenv

load_dotenv(".env")
load_dotenv("backend/.env")
key = os.getenv("TMDB_API_KEY", "")

def fetch_tmdb(endpoint, params=None, retries=3):
    q = [f"api_key={key}"]
    if params:
        for k, v in params.items():
            q.append(f"{k}={v}")
    url = f"https://api.themoviedb.org/3{endpoint}?" + "&".join(q)
    for attempt in range(retries):
        res = subprocess.run(
            ["curl.exe", "-s", "--tlsv1.3", "--ssl-no-revoke", "--doh-url", "https://cloudflare-dns.com/dns-query", url],
            capture_output=True,
            text=True
        )
        if res.returncode == 0 and res.stdout:
            try:
                return json.loads(res.stdout)
            except Exception:
                pass
    return None

def inspect():
    data = fetch_tmdb("/movie/now_playing", {"region": "IN", "page": 1})
    if not data:
        print("Failed to fetch now_playing")
        return
    results = data.get("results", [])
    print(f"Total now_playing in IN: {len(results)}")
    for m in results:
        print(f"ID {m.get('id')}: {m.get('title')} [{m.get('original_language')}] | Poster: {m.get('poster_path')} | Rel: {m.get('release_date')}")

    data_up = fetch_tmdb("/movie/upcoming", {"region": "IN", "page": 1})
    if data_up:
        res_up = data_up.get("results", [])
        print(f"\nTotal upcoming in IN: {len(res_up)}")
        for m in res_up[:5]:
            print(f"ID {m.get('id')}: {m.get('title')} [{m.get('original_language')}] | Poster: {m.get('poster_path')} | Rel: {m.get('release_date')}")

if __name__ == "__main__":
    inspect()
