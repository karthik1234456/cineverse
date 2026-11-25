import sys
import os
sys.path.insert(0, os.path.abspath('backend'))

import asyncio
from app.services.catalog.tmdb import TMDBCatalogProvider, _execute_tmdb_curl
import sqlite3

async def main():
    provider = TMDBCatalogProvider()
    print("--- Probing TMDB Search ---")
    res = _execute_tmdb_curl('/search/movie', {'query': 'Heart of the Beast'})
    print("TMDB Search 'Heart of the Beast':", res)

    print("\n--- Checking TMDB discover / now playing ---")
    discover = _execute_tmdb_curl('/movie/now_playing', {'language': 'en-US', 'page': 1})
    if discover and 'results' in discover:
        print("Now playing count:", len(discover['results']))
        for m in discover['results']:
            print(f"  {m.get('id')}: {m.get('title')}")
    else:
        print("Discover returned:", discover)

    print("\n--- Database Check ---")
    conn = sqlite3.connect('backend/cineverse.db')
    cur = conn.cursor()
    cur.execute("SELECT id, title, trailer_url, youtube_trailer_id, trailer_embeddable FROM movies WHERE title LIKE '%Beast%' OR title LIKE '%Heart%'")
    rows = cur.fetchall()
    print("Database matches:", rows)

if __name__ == '__main__':
    asyncio.run(main())
