import os
import sys
sys.path.insert(0, os.path.abspath('backend'))
sys.path.insert(0, os.path.abspath('.'))

import asyncio
import httpx
from app.database import AsyncSessionLocal
from app.models.movie import Movie
from sqlalchemy import select

async def check_all():
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(Movie).where(Movie.is_tmdb == True).order_by(Movie.id))
        movies = res.scalars().all()
        
        results = []
        async with httpx.AsyncClient(timeout=4.0) as client:
            for m in movies:
                t_url = m.trailer_url
                if not t_url or 'embed/' not in t_url:
                    results.append({'id': m.id, 'title': m.title, 'yt_id': None, 'status': 'no_trailer', 'oembed': None})
                    continue
                yt_id = t_url.split('embed/')[-1].split('?')[0]
                try:
                    r = await client.get(f'https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={yt_id}&format=json')
                    results.append({'id': m.id, 'title': m.title, 'yt_id': yt_id, 'status': 'ok' if r.status_code == 200 else f'http_{r.status_code}', 'oembed': r.status_code})
                except Exception as e:
                    results.append({'id': m.id, 'title': m.title, 'yt_id': yt_id, 'status': 'error', 'oembed': str(e)})

        print(f'Total TMDB movies: {len(results)}')
        ok_count = sum(1 for r in results if r['status'] == 'ok')
        no_trailer_count = sum(1 for r in results if r['status'] == 'no_trailer')
        err_count = sum(1 for r in results if r['status'] not in ('ok', 'no_trailer'))
        print(f'oEmbed OK: {ok_count}, No trailer: {no_trailer_count}, oEmbed Refused/Error: {err_count}\n')
        for r in results:
            print(f"{r['id']:2d} | {r['title'][:28]:28s} | {str(r['yt_id']):11s} | {r['status']}")

if __name__ == '__main__':
    asyncio.run(check_all())
