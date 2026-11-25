import asyncio
import os
import sys

# Ensure backend directory is in python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from app.database import AsyncSessionLocal
from app.seed.seeder import seed_database

async def main():
    async with AsyncSessionLocal() as session:
        await seed_database(session, force_reseed=True)
        print("Database reseeded successfully with screen distance rules!")

if __name__ == "__main__":
    asyncio.run(main())
