"""
Seeds technical specifications for CineVerse:
- Screen formats (17 exact labels)
- Sound systems (4 exact labels)
- Projection types (3 exact labels)
- Hall assignments across all 112 auditoriums in 7 cities
"""
import asyncio
from typing import Dict, List, Tuple
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal, init_db
from app.models.cinema import City, Cinema, Auditorium
from app.models.showtime import Showtime
from app.models.technical_specs import ScreenFormat, SoundSystem, ProjectionType

SCREEN_FORMATS_DATA = [
    {"name": "2D", "description": "Standard 2D cinematic projection", "requires_glasses": False},
    {"name": "3D", "description": "Stereoscopic 3D projection with polarized glasses", "requires_glasses": True},
    {"name": "IMAX 2D", "description": "IMAX expansive curved screen with laser precision", "requires_glasses": False},
    {"name": "IMAX 3D", "description": "IMAX high-contrast stereoscopic 3D with custom glasses", "requires_glasses": True},
    {"name": "4DX", "description": "Multi-sensory motion seats and dynamic synchronized motion", "requires_glasses": False},
    {"name": "4DX 3D", "description": "Multi-sensory motion seats with stereoscopic 3D glasses", "requires_glasses": True},
    {"name": "MX4D", "description": "Interactive motion seats with pitch, roll, and heave", "requires_glasses": False},
    {"name": "MX4D 3D", "description": "Motion seats with stereoscopic 3D glasses", "requires_glasses": True},
    {"name": "ScreenX", "description": "270-degree multi-projection panoramic auditorium experience", "requires_glasses": False},
    {"name": "2D SCREEN X", "description": "270-degree panoramic side-wall projection in 2D", "requires_glasses": False},
    {"name": "3D SCREEN X", "description": "270-degree panoramic experience with 3D glasses", "requires_glasses": True},
    {"name": "ICE", "description": "Immersive Cinema Experience with ambient LED side panels", "requires_glasses": False},
    {"name": "ICE 3D", "description": "ICE ambient visual panels with stereoscopic 3D glasses", "requires_glasses": True},
    {"name": "P[XL]", "description": "Premium extra-large giant screen with dual 4K laser", "requires_glasses": False},
    {"name": "EPIQ", "description": "Extravagant premium large-format screen with QSC sound", "requires_glasses": False},
    {"name": "Onyx (Samsung Onyx LED)", "description": "Self-emitting HDR 4K cinema LED screen with true blacks", "requires_glasses": False},
    {"name": "Dolby Cinema", "description": "Dolby Vision HDR dual-laser projection with Dolby Atmos", "requires_glasses": False},
]

SOUND_SYSTEMS_DATA = [
    {"name": "Standard 5.1", "description": "Surround 5.1 channel digital audio", "channels": "5.1"},
    {"name": "Dolby 7.1", "description": "Discrete 7.1 channel high-definition surround", "channels": "7.1"},
    {"name": "Dolby Atmos", "description": "Object-based 3D immersive spatial sound with overhead speakers", "channels": "Spatial object-based (up to 64 channels)"},
    {"name": "DTS:X", "description": "Multi-dimensional object-based surround sound without fixed channels", "channels": "Immersive object-based"},
]

PROJECTION_TYPES_DATA = [
    {"name": "Standard digital", "description": "High-definition DCI-compliant digital projection", "resolution": "2K Digital"},
    {"name": "4K Laser", "description": "Ultra-sharp 4K laser phosphors for rich contrast", "resolution": "4K Laser"},
    {"name": "RGB Laser", "description": "Pure 3-chip RGB direct laser projection with Rec. 2020 color", "resolution": "Pure RGB Laser"},
]

# Per-city auditorium format allocations (16 auditoriums per city, ordered by cinema screens)
# Each tuple: (screen_format_name, sound_system_name, projection_type_name, confirmed_with_cinema)
CITY_FORMAT_DISTRIBUTION: Dict[str, List[Tuple[str, str, str, bool]]] = {
    "bengaluru": [
        ("IMAX 3D", "Dolby Atmos", "RGB Laser", True),
        ("Dolby Cinema", "Dolby Atmos", "RGB Laser", True),
        ("4DX 3D", "Dolby Atmos", "4K Laser", True),
        ("P[XL]", "DTS:X", "4K Laser", True),
        ("ScreenX", "Dolby Atmos", "4K Laser", False),
        ("ICE 3D", "Dolby Atmos", "4K Laser", False),
        ("IMAX 3D", "Dolby Atmos", "RGB Laser", True),
        ("4DX 3D", "Dolby Atmos", "4K Laser", True),
        ("3D", "Dolby 7.1", "4K Laser", True),
        ("3D", "Dolby 7.1", "Standard digital", False),
        ("3D", "Dolby Atmos", "4K Laser", False),
        ("2D", "Dolby 7.1", "4K Laser", True),
        ("2D", "Standard 5.1", "Standard digital", True),
        ("2D", "Standard 5.1", "Standard digital", True),
        ("2D", "Dolby Atmos", "4K Laser", False),
        ("2D", "Standard 5.1", "Standard digital", False),
    ],
    "mumbai": [
        ("IMAX 3D", "Dolby Atmos", "RGB Laser", True),
        ("Dolby Cinema", "Dolby Atmos", "RGB Laser", True),
        ("4DX 3D", "Dolby Atmos", "4K Laser", True),
        ("Onyx (Samsung Onyx LED)", "Dolby Atmos", "RGB Laser", True),
        ("ScreenX", "Dolby Atmos", "4K Laser", False),
        ("IMAX 2D", "Dolby Atmos", "4K Laser", True),
        ("IMAX 3D", "Dolby Atmos", "RGB Laser", True),
        ("4DX 3D", "Dolby Atmos", "4K Laser", True),
        ("3D", "Dolby 7.1", "4K Laser", True),
        ("3D", "Dolby 7.1", "Standard digital", False),
        ("3D", "Dolby Atmos", "4K Laser", False),
        ("2D", "Dolby 7.1", "4K Laser", True),
        ("2D", "Standard 5.1", "Standard digital", True),
        ("2D", "Standard 5.1", "Standard digital", True),
        ("2D", "Dolby Atmos", "4K Laser", False),
        ("2D", "Standard 5.1", "Standard digital", False),
    ],
    "delhi-ncr": [
        ("IMAX 3D", "Dolby Atmos", "RGB Laser", True),
        ("Dolby Cinema", "Dolby Atmos", "RGB Laser", True),
        ("4DX 3D", "Dolby Atmos", "4K Laser", True),
        ("EPIQ", "Dolby Atmos", "4K Laser", True),
        ("2D SCREEN X", "Dolby Atmos", "4K Laser", False),
        ("ICE 3D", "Dolby Atmos", "4K Laser", False),
        ("IMAX 3D", "Dolby Atmos", "RGB Laser", True),
        ("4DX 3D", "Dolby Atmos", "4K Laser", True),
        ("3D", "Dolby 7.1", "4K Laser", True),
        ("3D", "Dolby 7.1", "Standard digital", False),
        ("3D", "Dolby Atmos", "4K Laser", False),
        ("2D", "Dolby 7.1", "4K Laser", True),
        ("2D", "Standard 5.1", "Standard digital", True),
        ("2D", "Standard 5.1", "Standard digital", True),
        ("2D", "Dolby Atmos", "4K Laser", False),
        ("2D", "Standard 5.1", "Standard digital", False),
    ],
    "hyderabad": [
        ("EPIQ", "Dolby Atmos", "RGB Laser", True),
        ("4DX 3D", "Dolby Atmos", "4K Laser", True),
        ("3D SCREEN X", "Dolby Atmos", "4K Laser", False),
        ("IMAX 2D", "Dolby Atmos", "4K Laser", True),
        ("EPIQ", "Dolby Atmos", "4K Laser", True),
        ("4DX 3D", "Dolby Atmos", "4K Laser", True),
        ("3D", "Dolby 7.1", "4K Laser", True),
        ("3D", "Dolby 7.1", "Standard digital", False),
        ("3D", "Dolby Atmos", "4K Laser", False),
        ("3D", "Dolby 7.1", "Standard digital", False),
        ("2D", "Dolby 7.1", "4K Laser", True),
        ("2D", "Standard 5.1", "Standard digital", True),
        ("2D", "Standard 5.1", "Standard digital", True),
        ("2D", "Dolby Atmos", "4K Laser", False),
        ("2D", "Standard 5.1", "Standard digital", False),
        ("2D", "Standard 5.1", "Standard digital", False),
    ],
    "chennai": [
        ("Dolby Cinema", "Dolby Atmos", "RGB Laser", True),
        ("4DX", "Dolby Atmos", "4K Laser", True),
        ("P[XL]", "DTS:X", "4K Laser", True),
        ("P[XL]", "DTS:X", "4K Laser", True),
        ("Dolby Cinema", "Dolby Atmos", "RGB Laser", True),
        ("4DX", "Dolby Atmos", "4K Laser", True),
        ("3D", "Dolby 7.1", "4K Laser", True),
        ("3D", "Dolby 7.1", "Standard digital", False),
        ("3D", "Dolby Atmos", "4K Laser", False),
        ("3D", "Dolby 7.1", "Standard digital", False),
        ("2D", "Dolby 7.1", "4K Laser", True),
        ("2D", "Standard 5.1", "Standard digital", True),
        ("2D", "Standard 5.1", "Standard digital", True),
        ("2D", "Dolby Atmos", "4K Laser", False),
        ("2D", "Standard 5.1", "Standard digital", False),
        ("2D", "Standard 5.1", "Standard digital", False),
    ],
    "pune": [
        ("4DX 3D", "Dolby Atmos", "4K Laser", True),
        ("MX4D 3D", "DTS:X", "4K Laser", True),
        ("ScreenX", "Dolby Atmos", "4K Laser", True),
        ("ScreenX", "Dolby Atmos", "4K Laser", True),
        ("4DX 3D", "Dolby Atmos", "4K Laser", True),
        ("MX4D 3D", "DTS:X", "4K Laser", True),
        ("3D", "Dolby 7.1", "4K Laser", True),
        ("3D", "Dolby 7.1", "Standard digital", False),
        ("3D", "Dolby Atmos", "4K Laser", False),
        ("3D", "Dolby 7.1", "Standard digital", False),
        ("2D", "Dolby 7.1", "4K Laser", True),
        ("2D", "Standard 5.1", "Standard digital", True),
        ("2D", "Standard 5.1", "Standard digital", True),
        ("2D", "Dolby Atmos", "4K Laser", False),
        ("2D", "Standard 5.1", "Standard digital", False),
        ("2D", "Standard 5.1", "Standard digital", False),
    ],
    "kolkata": [
        ("IMAX 3D", "Dolby Atmos", "RGB Laser", True),
        ("ICE", "Dolby Atmos", "4K Laser", True),
        ("MX4D", "DTS:X", "4K Laser", True),
        ("Dolby Cinema", "Dolby Atmos", "RGB Laser", True),
        ("IMAX 3D", "Dolby Atmos", "RGB Laser", True),
        ("ICE", "Dolby Atmos", "4K Laser", True),
        ("3D", "Dolby 7.1", "4K Laser", True),
        ("3D", "Dolby 7.1", "Standard digital", False),
        ("3D", "Dolby Atmos", "4K Laser", False),
        ("3D", "Dolby 7.1", "Standard digital", False),
        ("2D", "Dolby 7.1", "4K Laser", True),
        ("2D", "Standard 5.1", "Standard digital", True),
        ("2D", "Standard 5.1", "Standard digital", True),
        ("2D", "Dolby Atmos", "4K Laser", False),
        ("2D", "Standard 5.1", "Standard digital", False),
        ("2D", "Standard 5.1", "Standard digital", False),
    ],
}


async def seed_technical_specs(db: AsyncSession):
    print("--- Seeding Technical Specifications ---")
    
    # 1. Screen Formats
    format_map: Dict[str, ScreenFormat] = {}
    for item in SCREEN_FORMATS_DATA:
        existing = (await db.execute(select(ScreenFormat).where(ScreenFormat.name == item["name"]))).scalar_one_or_none()
        if not existing:
            existing = ScreenFormat(**item)
            db.add(existing)
            await db.flush()
        else:
            existing.description = item["description"]
            existing.requires_glasses = item["requires_glasses"]
            existing.is_active = True
        format_map[item["name"]] = existing

    # 2. Sound Systems
    sound_map: Dict[str, SoundSystem] = {}
    for item in SOUND_SYSTEMS_DATA:
        existing = (await db.execute(select(SoundSystem).where(SoundSystem.name == item["name"]))).scalar_one_or_none()
        if not existing:
            existing = SoundSystem(**item)
            db.add(existing)
            await db.flush()
        else:
            existing.description = item["description"]
            existing.channels = item["channels"]
            existing.is_active = True
        sound_map[item["name"]] = existing

    # 3. Projection Types
    projection_map: Dict[str, ProjectionType] = {}
    for item in PROJECTION_TYPES_DATA:
        existing = (await db.execute(select(ProjectionType).where(ProjectionType.name == item["name"]))).scalar_one_or_none()
        if not existing:
            existing = ProjectionType(**item)
            db.add(existing)
            await db.flush()
        else:
            existing.description = item["description"]
            existing.resolution = item["resolution"]
            existing.is_active = True
        projection_map[item["name"]] = existing

    await db.commit()
    print(f"Seeded {len(format_map)} Screen Formats, {len(sound_map)} Sound Systems, {len(projection_map)} Projection Types.")

    # 4. Assign specs to all auditoriums by city
    cities = (await db.execute(select(City))).scalars().all()
    total_auditoriums_updated = 0

    for city in cities:
        city_slug = city.slug.lower()
        distribution = CITY_FORMAT_DISTRIBUTION.get(city_slug)
        if not distribution:
            print(f"Warning: No distribution found for city {city.name} ({city_slug})")
            continue

        cinemas = (await db.execute(select(Cinema).where(Cinema.city_id == city.id).order_by(Cinema.id))).scalars().all()
        auditoriums: List[Auditorium] = []
        for c in cinemas:
            auds = (await db.execute(select(Auditorium).where(Auditorium.cinema_id == c.id).order_by(Auditorium.id))).scalars().all()
            auditoriums.extend(auds)

        print(f"Assigning specs to {len(auditoriums)} auditoriums in {city.name}...")
        for i, aud in enumerate(auditoriums):
            spec = distribution[i % len(distribution)]
            fmt_name, snd_name, prj_name, confirmed = spec

            fmt = format_map[fmt_name]
            snd = sound_map[snd_name]
            prj = projection_map[prj_name]

            aud.screen_format_id = fmt.id
            aud.sound_system_id = snd.id
            aud.projection_type_id = prj.id
            aud.screen_type = fmt.name
            aud.confirmed_with_cinema = confirmed
            aud.is_demo = not confirmed  # demo if not confirmed by real cinema
            total_auditoriums_updated += 1

            # Also update showtimes in this auditorium so format is consistent
            await db.execute(
                update(Showtime)
                .where(Showtime.auditorium_id == aud.id)
                .values(format=fmt.name)
            )

    await db.commit()
    print(f"Successfully assigned specs to {total_auditoriums_updated} auditoriums across all cities.")


async def main():
    await init_db()
    async with AsyncSessionLocal() as session:
        await seed_technical_specs(session)

if __name__ == "__main__":
    asyncio.run(main())
