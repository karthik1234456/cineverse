import asyncio
import sys
sys.path.insert(0, 'backend')
from app.database import AsyncSessionLocal
from app.models import Showtime, Movie
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as session:
        # Check showtime 1875
        res = await session.execute(
            select(Showtime, Movie).join(Movie, Showtime.movie_id == Movie.id).where(Showtime.id == 1875)
        )
        row = res.first()
        if row:
            st, m = row
            print(f"Showtime 1875: Movie {m.id} - {m.title} (showcase={m.is_showcase}, trailer={m.trailer_url})")

        # Check any showcase movie showtimes
        res2 = await session.execute(
            select(Showtime, Movie).join(Movie, Showtime.movie_id == Movie.id).where(Movie.is_showcase == True).limit(5)
        )
        rows2 = res2.all()
        print(f"Showcase showtimes count: {len(rows2)}")
        for st, m in rows2:
            print(f"Showtime {st.id} in Cinema {st.cinema_id}, Audi {st.auditorium_id} for Movie {m.id} - {m.title} (trailer={m.trailer_url})")

asyncio.run(main())
