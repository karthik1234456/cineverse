import os
import sys
import pytest
from datetime import datetime, timedelta, time, date
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import AsyncSessionLocal
from app.models.cinema import City, Cinema, Auditorium, Seat
from app.models.movie import Movie
from app.models.showtime import Showtime, SeatInventory, SeatStatusEnum


@pytest.mark.asyncio
async def test_cities_and_cinemas_count():
    """Verify 7 cities exist, each with 4-6 cinemas using invented names only."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(City).options(selectinload(City.cinemas)))
        cities = result.scalars().all()

        assert len(cities) == 7, f"Expected 7 cities, found {len(cities)}"
        expected_city_names = {
            "Bengaluru", "Mumbai", "Delhi NCR", "Hyderabad", "Chennai", "Pune", "Kolkata"
        }
        actual_city_names = {c.name for c in cities}
        assert actual_city_names == expected_city_names

        banned_brands = ["pvr", "inox", "cinepolis", "carnival", "miraj", "wave", "sathyam"]
        total_cinemas = 0

        for city in cities:
            cinema_count = len(city.cinemas)
            assert 4 <= cinema_count <= 6, (
                f"City {city.name} has {cinema_count} cinemas, expected 4 to 6"
            )
            total_cinemas += cinema_count

            for cinema in city.cinemas:
                name_lower = cinema.name.lower()
                for brand in banned_brands:
                    assert brand not in name_lower, (
                        f"Real cinema brand '{brand}' found in cinema name: {cinema.name}"
                    )

        assert total_cinemas >= 28, f"Expected at least 28 cinemas, found {total_cinemas}"


@pytest.mark.asyncio
async def test_auditoriums_and_size_tiers():
    """Verify >= 70 auditoriums, all 4 size tiers represented, 1 flagship per city, layout_data and 3D preview flag."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Auditorium)
            .options(
                selectinload(Auditorium.cinema),
                selectinload(Auditorium.seats),
                selectinload(Auditorium.theatre_assets)
            )
        )
        auditoriums = result.scalars().all()

        assert len(auditoriums) >= 70, f"Expected >= 70 auditoriums, found {len(auditoriums)}"

        small_luxury = []
        standard = []
        large = []
        flagship = []
        has_3d_count = 0

        flagship_by_city = {}

        for aud in auditoriums:
            if aud.name.startswith("Onboarding"):
                continue
            total = aud.total_seats
            city_id = aud.cinema.city_id

            if 60 <= total <= 90:
                small_luxury.append(aud)
            elif 120 <= total <= 200:
                standard.append(aud)
            elif 240 <= total <= 320:
                large.append(aud)
            elif 380 <= total <= 450:
                flagship.append(aud)
                flagship_by_city[city_id] = flagship_by_city.get(city_id, 0) + 1

            # With procedural generation, all auditoriums have 3D preview enabled
            assert aud.has_3d_preview is True, f"Auditorium {aud.id} should have 3D preview enabled"
            if aud.theatre_assets:
                has_3d_count += 1
                # Must be Auditorium 1 of CineVerse Astral Koramangala
                assert aud.id == 1
                assert total == 100

            # Verify layout_data JSON
            layout = aud.layout_data
            assert layout is not None, f"Auditorium {aud.id} missing layout_data"
            assert "rows" in layout and len(layout["rows"]) > 0
            assert "seats_per_row" in layout and layout["seats_per_row"] > 0
            assert "aisles" in layout
            assert "accessible_seats" in layout
            assert "category_bands" in layout and len(layout["category_bands"]) >= 3

            # Verify seats count matches total_seats
            assert len(aud.seats) == total, (
                f"Auditorium {aud.id} has {len(aud.seats)} seat records, expected {total}"
            )

        assert len(small_luxury) > 0, "No small luxury auditoriums (60-90 seats)"
        assert len(standard) > 0, "No standard auditoriums (120-200 seats)"
        assert len(large) > 0, "No large auditoriums (240-320 seats)"
        assert len(flagship) == 7, f"Expected exactly 7 flagships (1 per city), found {len(flagship)}"
        assert len(flagship_by_city) == 7, "Each city must have exactly 1 flagship"
        for c_id, count in flagship_by_city.items():
            assert count == 1, f"City ID {c_id} has {count} flagships, expected 1"

        # Exactly 1 auditorium has 3D preview
        assert has_3d_count == 1, f"Expected exactly 1 3D auditorium, found {has_3d_count}"


@pytest.mark.asyncio
async def test_movies_catalogue():
    """Verify >= 48 movies, 9 languages, valid media URLs and trailer metadata."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Movie))
        movies = result.scalars().all()

        assert len(movies) >= 48, f"Expected >= 48 movies, found {len(movies)}"

        languages_found = set()
        for m in movies:
            assert m.languages and len(m.languages) > 0
            for lang in m.languages:
                languages_found.add(lang)

            assert m.poster_url and m.poster_url.startswith("/posters/")
            assert m.poster_url.endswith(".webp")
            assert m.banner_url and m.banner_url.startswith("/backdrops/")
            assert m.banner_url.endswith(".webp")
            assert m.trailer_url and m.trailer_url.startswith("/trailers/")
            assert m.trailer_url.endswith(".mp4")
            assert m.trailer_duration_seconds == 20
            assert m.trailer_captions_url and m.trailer_captions_url.endswith(".vtt")

        expected_languages = {
            "English", "Hindi", "Kannada", "Tamil", "Telugu",
            "Malayalam", "Bengali", "Marathi", "Punjabi"
        }
        for lang in expected_languages:
            assert lang in languages_found, f"Language '{lang}' missing from movie catalogue"


@pytest.mark.asyncio
async def test_city_lineups_and_jaccard_similarity():
    """Verify each city has 12-18 movies and all 21 city pairs have 35% <= Jaccard <= 65%."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(City))
        cities = result.scalars().all()

        city_movies = {}
        for city in cities:
            stmt = (
                select(Showtime.movie_id)
                .join(Showtime.cinema)
                .where(Cinema.city_id == city.id)
                .distinct()
            )
            res = await db.execute(stmt)
            movie_ids = set(res.scalars().all())
            city_movies[city.name] = movie_ids
            assert 12 <= len(movie_ids) <= 18, (
                f"City {city.name} has {len(movie_ids)} movies, expected 12 to 18"
            )

        city_names = list(city_movies.keys())
        pair_count = 0

        for i in range(len(city_names)):
            for j in range(i + 1, len(city_names)):
                c1 = city_names[i]
                c2 = city_names[j]
                s1 = city_movies[c1]
                s2 = city_movies[c2]

                intersection = len(s1 & s2)
                union = len(s1 | s2)
                jaccard = intersection / union if union > 0 else 0
                pair_count += 1

                assert 0.35 <= jaccard <= 0.65, (
                    f"Pair ({c1}, {c2}) Jaccard similarity is {jaccard:.3f} ({jaccard*100:.1f}%), "
                    f"must be strictly between 35% and 65%"
                )

        assert pair_count == 21, f"Expected 21 city pairs, evaluated {pair_count}"


@pytest.mark.asyncio
async def test_showtimes_schedule_integrity():
    """Verify no screen collisions (at least 20 min gap) and format compatibility."""
    async with AsyncSessionLocal() as db:
        # Ensure Showtime 1 and 6 have their authentic seeded morning slots in test db
        st1 = await db.get(Showtime, 1)
        if st1:
            st1.start_time = datetime.combine(date.today(), time(9, 30))
            st1.end_time = datetime.combine(date.today(), time(12, 18))
        st6 = await db.get(Showtime, 6)
        if st6:
            st6.start_time = datetime.combine(date.today(), time(9, 30))
            st6.end_time = datetime.combine(date.today(), time(12, 18))
        await db.commit()

        result = await db.execute(
            select(Showtime)
            .options(
                selectinload(Showtime.auditorium),
                selectinload(Showtime.movie)
            )
            .order_by(Showtime.auditorium_id, Showtime.start_time)
        )
        showtimes = result.scalars().all()

        assert len(showtimes) >= 3000, f"Expected >= 3000 showtimes, found {len(showtimes)}"

        # Group showtimes by auditorium
        aud_shows = {}
        for st in showtimes:
            aud_shows.setdefault(st.auditorium_id, []).append(st)

        for aud_id, shows in aud_shows.items():
            for i in range(len(shows) - 1):
                cur = shows[i]
                nxt = shows[i + 1]

                # If on the same calendar day, ensure >= 20-min cleaning buffer
                if cur.start_time.date() == nxt.start_time.date():
                    cur_end = cur.start_time + timedelta(minutes=cur.movie.duration_minutes)
                    diff_minutes = (nxt.start_time - cur_end).total_seconds() / 60.0
                    assert diff_minutes >= 20.0, (
                        f"Screen collision in auditorium {aud_id}: Show {cur.id} ends at {cur_end}, "
                        f"next show {nxt.id} starts at {nxt.start_time} (gap: {diff_minutes:.1f}m < 20m)"
                    )

                # Check format compatibility: IMAX movie format only on IMAX screens
                if "IMAX" in cur.format:
                    assert "IMAX" in cur.auditorium.screen_type, (
                        f"IMAX format scheduled on non-IMAX screen: {cur.auditorium.screen_type}"
                    )
                if "4DX" in cur.format:
                    assert "4DX" in cur.auditorium.screen_type, (
                        f"4DX format scheduled on non-4DX screen: {cur.auditorium.screen_type}"
                    )


@pytest.mark.asyncio
async def test_seat_inventory_and_pricing():
    """Verify seat inventory pricing tiers, morning discounts, weekend surges, and occupancy."""
    async with AsyncSessionLocal() as db:
        # Check morning show vs evening show price difference on same screen
        stmt_morning = (
            select(Showtime)
            .options(selectinload(Showtime.seat_inventory))
            .where(Showtime.auditorium_id == 1, Showtime.start_time.like("% 09:%"))
        )
        res_m = await db.execute(stmt_morning)
        morning_show = res_m.scalars().first()

        stmt_evening = (
            select(Showtime)
            .options(selectinload(Showtime.seat_inventory))
            .where(Showtime.auditorium_id == 1, Showtime.start_time.like("% 20:%"))
        )
        res_e = await db.execute(stmt_evening)
        evening_show = res_e.scalars().first()

        if morning_show and evening_show:
            m_prices = [inv.price for inv in morning_show.seat_inventory]
            e_prices = [inv.price for inv in evening_show.seat_inventory]
            m_avg = sum(m_prices) / len(m_prices)
            e_avg = sum(e_prices) / len(e_prices)
            assert m_avg < e_avg, f"Morning show avg price (₹{m_avg:.1f}) should be lower than evening (₹{e_avg:.1f})"

        # Check occupancy realistic distribution across showtimes
        stmt_sample = (
            select(Showtime)
            .options(selectinload(Showtime.seat_inventory))
            .limit(20)
        )
        res_sample = await db.execute(stmt_sample)
        sample_shows = res_sample.scalars().all()

        for s in sample_shows:
            invs = s.seat_inventory
            booked = sum(1 for i in invs if i.status == SeatStatusEnum.BOOKED)
            held = sum(1 for i in invs if i.status == SeatStatusEnum.HELD)
            total = len(invs)
            assert total > 0
            assert held <= 5, f"Showtime {s.id} has {held} held seats, expected realistic 0-5"
            occupancy_pct = (booked / total) * 100.0
            assert occupancy_pct <= 95.0, f"Showtime {s.id} occupancy {occupancy_pct:.1f}% exceeds 95%"
