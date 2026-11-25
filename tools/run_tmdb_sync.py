import asyncio
from app.database import AsyncSessionLocal
from app.services.catalog.tmdb import TMDBCatalogProvider, check_tmdb_key_status

async def main():
    print("Checking TMDB key status...")
    key_status = await check_tmdb_key_status()
    print("TMDB key check:", {k: v for k, v in key_status.items() if k != "key"})

    provider = TMDBCatalogProvider()
    async with AsyncSessionLocal() as db:
        print("Starting TMDB catalog sync...")
        res = await provider.sync_catalog(db)
        print("Sync result:", res)

if __name__ == "__main__":
    asyncio.run(main())
