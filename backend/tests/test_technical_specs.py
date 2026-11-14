import pytest
import time
import statistics
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.cinema import Auditorium, Cinema, City
from app.models.technical_specs import ScreenFormat, SoundSystem, ProjectionType
from app.services.auth_service import create_access_token

EXACT_SCREEN_FORMATS = [
    "2D",
    "3D",
    "IMAX 2D",
    "IMAX 3D",
    "4DX",
    "4DX 3D",
    "MX4D",
    "MX4D 3D",
    "ScreenX",
    "2D SCREEN X",
    "3D SCREEN X",
    "ICE",
    "ICE 3D",
    "P[XL]",
    "EPIQ",
    "Onyx (Samsung Onyx LED)",
    "Dolby Cinema",
]

EXACT_SOUND_SYSTEMS = [
    "Standard 5.1",
    "Dolby 7.1",
    "Dolby Atmos",
    "DTS:X",
]

EXACT_PROJECTION_TYPES = [
    "Standard digital",
    "4K Laser",
    "RGB Laser",
]

GLASSES_FORMATS = {
    "3D",
    "IMAX 3D",
    "4DX 3D",
    "MX4D 3D",
    "3D SCREEN X",
    "ICE 3D",
}


@pytest.mark.asyncio
async def test_exact_technical_specs_vocabularies(db_session):
    """
    Assert that seeded vocabularies match the exact label specifications:
    - 17 exact screen formats
    - 4 exact sound systems
    - 3 exact projection types
    """
    res = await db_session.execute(select(ScreenFormat.name))
    stored_formats = [r[0] for r in res.all()]
    assert sorted(stored_formats) == sorted(EXACT_SCREEN_FORMATS), (
        f"Screen formats mismatch. Expected {EXACT_SCREEN_FORMATS}, got {stored_formats}"
    )

    res = await db_session.execute(select(SoundSystem.name))
    stored_sounds = [r[0] for r in res.all()]
    assert sorted(stored_sounds) == sorted(EXACT_SOUND_SYSTEMS), (
        f"Sound systems mismatch. Expected {EXACT_SOUND_SYSTEMS}, got {stored_sounds}"
    )

    res = await db_session.execute(select(ProjectionType.name))
    stored_projections = [r[0] for r in res.all()]
    assert sorted(stored_projections) == sorted(EXACT_PROJECTION_TYPES), (
        f"Projection types mismatch. Expected {EXACT_PROJECTION_TYPES}, got {stored_projections}"
    )


@pytest.mark.asyncio
async def test_requires_glasses_flag_determinism(db_session):
    """
    Assert that requires_glasses is True if and only if the format is a 3D variant.
    """
    res = await db_session.execute(select(ScreenFormat))
    formats = res.scalars().all()
    for fmt in formats:
        if fmt.name in GLASSES_FORMATS:
            assert fmt.requires_glasses is True, f"Format {fmt.name} must require glasses"
        else:
            assert fmt.requires_glasses is False, f"Format {fmt.name} must NOT require glasses"


@pytest.mark.asyncio
async def test_auditorium_specs_coverage_and_realism(db_session):
    """
    Assert all auditoriums have a screen format, sound system, and projection type.
    Assert all 7 cities have 2D, 3D, and premium formats.
    """
    res = await db_session.execute(
        select(Auditorium)
        .options(
            selectinload(Auditorium.screen_format),
            selectinload(Auditorium.sound_system),
            selectinload(Auditorium.projection_type),
            selectinload(Auditorium.cinema).selectinload(Cinema.city),
        )
    )
    auditoriums = res.scalars().all()
    assert len(auditoriums) > 0, "No auditoriums found"

    city_formats = {}
    for aud in auditoriums:
        assert aud.screen_format is not None, f"Auditorium {aud.id} missing screen format"
        assert aud.sound_system is not None, f"Auditorium {aud.id} missing sound system"
        assert aud.projection_type is not None, f"Auditorium {aud.id} missing projection type"

        # Check property display string format: "Screen X · Format · Sound · Projection"
        display = aud.tech_specs_display
        assert aud.name in display, f"Display '{display}' missing auditorium name"
        assert aud.screen_format.name in display, f"Display '{display}' missing format name"
        assert aud.sound_system.name in display, f"Display '{display}' missing sound name"
        assert aud.projection_type.name in display, f"Display '{display}' missing projection name"

        city_id = aud.cinema.city_id
        if city_id not in city_formats:
            city_formats[city_id] = set()
        city_formats[city_id].add(aud.screen_format.name)

    # Check that all 7 cities have 2D and 3D
    res_cities = await db_session.execute(select(City.id))
    all_city_ids = [r[0] for r in res_cities.all()]
    for cid in all_city_ids:
        fmts = city_formats.get(cid, set())
        assert "2D" in fmts, f"City {cid} lacks 2D format"
        assert "3D" in fmts, f"City {cid} lacks 3D format"
        # Must have at least 1-2 premium formats beyond standard 2D and 3D
        premium = fmts - {"2D", "3D"}
        assert len(premium) >= 1, f"City {cid} lacks premium formats: {fmts}"


@pytest.mark.asyncio
async def test_facets_endpoint_scoping(client: AsyncClient):
    """
    Test GET /api/v1/technical-specs/facets endpoint with city scoping.
    """
    # Global facets
    resp = await client.get("/api/v1/technical-specs/facets")
    assert resp.status_code == 200
    data = resp.json()
    assert "formats" in data
    assert "sounds" in data
    assert "projections" in data
    assert len(data["formats"]) > 0

    # City-scoped facets for city 1 (Bengaluru)
    resp_city = await client.get("/api/v1/technical-specs/facets?city_id=1")
    assert resp_city.status_code == 200
    data_city = resp_city.json()
    # Bengaluru has formats with count > 0
    format_counts = {item["name"]: item["count"] for item in data_city["formats"]}
    assert format_counts.get("2D", 0) > 0
    assert format_counts.get("3D", 0) > 0


@pytest.mark.asyncio
async def test_cinemas_filtering_by_specs(client: AsyncClient, db_session):
    """
    Test filtering cinemas by screen format, sound system, and projection type.
    """
    # Filter by format IMAX 3D
    resp = await client.get("/api/v1/cinemas/?format=IMAX 3D")
    assert resp.status_code == 200
    cinemas = resp.json()
    assert len(cinemas) > 0, "Expected at least one cinema with IMAX 3D"
    for c in cinemas:
        # Check that this cinema actually has an auditorium with IMAX 3D
        aud_res = await db_session.execute(
            select(Auditorium)
            .options(selectinload(Auditorium.screen_format))
            .where(Auditorium.cinema_id == c["id"])
        )
        auds = aud_res.scalars().all()
        fmt_names = [a.screen_format.name for a in auds if a.screen_format]
        assert "IMAX 3D" in fmt_names, f"Cinema {c['id']} returned for IMAX 3D filter but has {fmt_names}"

    # Filter by sound Dolby Atmos
    resp_sound = await client.get("/api/v1/cinemas/?sound=Dolby Atmos")
    assert resp_sound.status_code == 200
    sound_cinemas = resp_sound.json()
    assert len(sound_cinemas) > 0


@pytest.mark.asyncio
async def test_movies_filtering_by_specs(client: AsyncClient):
    """
    Test filtering movies by technical specs query parameters.
    """
    resp = await client.get("/api/v1/movies?format=IMAX 3D")
    assert resp.status_code == 200
    movies = resp.json()
    assert isinstance(movies, list)


@pytest.mark.asyncio
async def test_search_understands_technical_labels(client: AsyncClient):
    """
    Test that global search recognizes labels like '4DX', 'Dolby Atmos', 'Laser'.
    """
    resp_4dx = await client.get("/api/v1/search?q=4DX", follow_redirects=True)
    assert resp_4dx.status_code == 200
    data_4dx = resp_4dx.json()
    assert len(data_4dx.get("cinemas", [])) > 0 or len(data_4dx.get("movies", [])) > 0

    resp_atmos = await client.get("/api/v1/search?q=Dolby Atmos", follow_redirects=True)
    assert resp_atmos.status_code == 200
    data_atmos = resp_atmos.json()
    assert len(data_atmos.get("cinemas", [])) > 0


@pytest.mark.asyncio
async def test_admin_update_auditorium_specs(client: AsyncClient, db_session):
    """
    Test admin capability to update auditorium technical specs assignment.
    """
    admin_token = create_access_token({"sub": "1", "email": "admin@cineverse.com", "role": "ADMIN"})
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Fetch auditorium 1
    res = await db_session.execute(select(Auditorium).where(Auditorium.id == 1))
    aud = res.scalars().first()
    assert aud is not None

    # Fetch format for Dolby Cinema
    res_fmt = await db_session.execute(select(ScreenFormat).where(ScreenFormat.name == "Dolby Cinema"))
    dolby_fmt = res_fmt.scalars().first()
    assert dolby_fmt is not None

    # PATCH auditorium specs
    patch_resp = await client.patch(
        "/api/v1/admin/auditoriums/1/specs",
        headers=headers,
        json={
            "screen_format_id": dolby_fmt.id,
            "confirmed_with_cinema": True,
            "is_demo": False,
        }
    )
    assert patch_resp.status_code == 200
    updated_data = patch_resp.json()
    assert updated_data["screen_format_name"] == "Dolby Cinema"
    assert updated_data["confirmed_with_cinema"] is True
    assert updated_data["is_demo"] is False


@pytest.mark.asyncio
async def test_latency_benchmark_under_300ms(client: AsyncClient):
    """
    Latency benchmark: measure p95 response time under 300 ms across filtered endpoints.
    """
    endpoints = [
        "/api/v1/movies?format=IMAX 3D",
        "/api/v1/cinemas/?sound=Dolby Atmos",
        "/api/v1/technical-specs/facets?city_id=1",
    ]

    latencies_ms = []
    # Warm up
    for ep in endpoints:
        await client.get(ep)

    # 45 benchmark requests (15 per endpoint)
    for _ in range(15):
        for ep in endpoints:
            t0 = time.perf_counter()
            resp = await client.get(ep)
            elapsed_ms = (time.perf_counter() - t0) * 1000
            assert resp.status_code == 200
            latencies_ms.append(elapsed_ms)

    latencies_sorted = sorted(latencies_ms)
    p95_idx = int(len(latencies_sorted) * 0.95)
    p95_ms = latencies_sorted[p95_idx]
    mean_ms = statistics.mean(latencies_ms)

    print(f"\n[BENCHMARK] Total calls: {len(latencies_ms)}, Mean: {mean_ms:.2f}ms, p95: {p95_ms:.2f}ms")
    assert p95_ms < 300, f"p95 latency {p95_ms:.2f}ms exceeded 300ms SLA threshold!"
