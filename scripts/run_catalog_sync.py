import os
import sys
sys.path.insert(0, os.path.abspath('backend'))
sys.path.insert(0, os.path.abspath('.'))

import asyncio
import sqlite3
import json
from app.database import AsyncSessionLocal, init_db
from app.services.catalog.tmdb import TMDBCatalogProvider
from app.models.movie import Movie
from sqlalchemy import select

async def main():
    await init_db()
    
    # Capture before state
    before_state = {}
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(Movie).where(Movie.is_tmdb == True))
        for m in res.scalars().all():
            before_state[m.id] = {
                "title": m.title,
                "yt_id": m.youtube_trailer_id,
                "url": m.trailer_url,
                "embeddable": m.trailer_embeddable,
            }
            
    print(f"Captured {len(before_state)} TMDB movies before sync.")
    print("Running catalogue sync with strict trailer selection...")
    provider = TMDBCatalogProvider()
    async with AsyncSessionLocal() as session:
        sync_res = await provider.sync_catalog(db=session, force_refresh=True)
    print("Sync finished:", sync_res.get("status"), f"Synced {sync_res.get('synced_count')} titles.")
    
    # Capture after state
    changed = []
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(Movie).where(Movie.is_tmdb == True))
        for m in res.scalars().all():
            old = before_state.get(m.id)
            if old:
                if old["yt_id"] != m.youtube_trailer_id:
                    changed.append({
                        "id": m.id,
                        "title": m.title,
                        "before_yt_id": old["yt_id"],
                        "after_yt_id": m.youtube_trailer_id,
                        "after_url": m.trailer_url,
                        "after_embeddable": m.trailer_embeddable,
                        "reason": getattr(m, "trailer_reason", None),
                    })
                    print(f"TITLE CHANGED: [{m.id}] '{m.title}' | {old['yt_id']} -> {m.youtube_trailer_id} | Reason: {getattr(m, 'trailer_reason', None)}")

    print(f"\nTotal titles with changed video choice: {len(changed)}")
    with open("evidence/perf-profile/catalogue_sync_changes.json", "w", encoding="utf-8") as f:
        json.dump(changed, f, indent=2)

if __name__ == "__main__":
    asyncio.run(main())
