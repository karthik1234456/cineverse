import asyncio
import sys
sys.path.insert(0, 'backend')
from app.database import AsyncSessionLocal
from app.models import Showtime
from sqlalchemy import update

async def main():
    async with AsyncSessionLocal() as session:
        await session.execute(update(Showtime).where(Showtime.id == 1875).values(movie_id=1))
        await session.commit()
        print("Updated showtime 1875 to movie_id = 1 (Quantum Odyssey: Beyond the Singularity) successfully!")

asyncio.run(main())
