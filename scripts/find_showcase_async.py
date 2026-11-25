import asyncio
import sys
sys.path.insert(0, 'backend')
from app.database import AsyncSessionLocal
from app.models import Movie, Showtime
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Movie).where(Movie.is_showcase == True))
        movies = result.scalars().all()
        for m in movies:
            st_result = await session.execute(select(Showtime).where(Showtime.movie_id == m.id).limit(3))
            sts = st_result.scalars().all()
            print(f"Movie: {m.id} - {m.title} - trailer: {m.trailer_url}")
            for s in sts:
                print(f"   Showtime {s.id} (Cinema {s.cinema_id}, Audi {s.auditorium_id})")

asyncio.run(main())
