import json
import asyncio
from datetime import date, datetime, timedelta, time
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.database import AsyncSessionLocal
from app.models.movie import Movie, MovieCast
from app.models.cinema import Cinema, Auditorium
from app.models.showtime import Showtime, SeatInventory, SeatStatusEnum

TMDB_NON_SHOWCASE_MOVIES: List[Dict[str, Any]] = [
    {
        "title": "Jawan",
        "slug": "jawan-872585",
        "synopsis": "A high-octane action thriller which outlines the emotional journey of a man who is set out to rectify the wrongs in society.",
        "poster_url": "https://image.tmdb.org/t/p/w500/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg",
        "banner_url": "https://image.tmdb.org/t/p/original/rLb2cwF3Pazuxaj0sRXQ037tGI1.jpg",
        "trailer_url": "https://www.youtube-nocookie.com/embed/MWOlnZSnXWE",
        "duration_minutes": 169,
        "certificate": "UA",
        "release_date": date(2023, 9, 7),
        "is_now_showing": True,
        "is_coming_soon": False,
        "rating_avg": 7.4,
        "rating_count": 280,
        "interested_count": 14200,
        "languages": ["Hindi", "Tamil", "Telugu"],
        "genres": ["Action", "Thriller"],
        "formats": ["2D", "IMAX with Laser", "4DX"],
        "tmdb_id": 872585,
        "tmdb_vote_average": 7.4,
        "tmdb_popularity": 42.5,
        "is_tmdb": True,
    },
    {
        "title": "Fast X",
        "slug": "fast-x-385687",
        "synopsis": "Over many missions and against impossible odds, Dom Toretto and his family have outsmarted, out-nerved and outdriven every foe in their path.",
        "poster_url": "https://image.tmdb.org/t/p/w500/1E5baAaEse26fej7uHcjOgEE2t2.jpg",
        "banner_url": "https://image.tmdb.org/t/p/original/rLb2cwF3Pazuxaj0sRXQ037tGI1.jpg",
        "trailer_url": "https://www.youtube-nocookie.com/embed/32RAq6JzY-w",
        "duration_minutes": 142,
        "certificate": "UA",
        "release_date": date(2023, 5, 19),
        "is_now_showing": True,
        "is_coming_soon": False,
        "rating_avg": 7.1,
        "rating_count": 4850,
        "interested_count": 25000,
        "languages": ["English", "Hindi"],
        "genres": ["Action", "Crime", "Thriller"],
        "formats": ["2D", "IMAX 3D", "4DX"],
        "tmdb_id": 385687,
        "tmdb_vote_average": 7.1,
        "tmdb_popularity": 65.2,
        "is_tmdb": True,
    },
    {
        "title": "Oppenheimer",
        "slug": "oppenheimer-872585",
        "synopsis": "The story of J. Robert Oppenheimer's role in the development of the atomic bomb during World War II.",
        "poster_url": "https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
        "banner_url": "https://image.tmdb.org/t/p/original/rLb2cwF3Pazuxaj0sRXQ037tGI1.jpg",
        "trailer_url": "https://www.youtube-nocookie.com/embed/uYPbbksJxIg",
        "duration_minutes": 180,
        "certificate": "A",
        "release_date": date(2023, 7, 21),
        "is_now_showing": True,
        "is_coming_soon": False,
        "rating_avg": 8.1,
        "rating_count": 9100,
        "interested_count": 32000,
        "languages": ["English", "Hindi"],
        "genres": ["Drama", "History"],
        "formats": ["2D", "IMAX with Laser"],
        "tmdb_id": 872585,
        "tmdb_vote_average": 8.1,
        "tmdb_popularity": 85.0,
        "is_tmdb": True,
    },
    {
        "title": "Deadpool & Wolverine",
        "slug": "deadpool-and-wolverine-533535",
        "synopsis": "A listless Wade Wilson toils away in civilian life with his days as the morally flexible mercenary, Deadpool, behind him.",
        "poster_url": "https://image.tmdb.org/t/p/w500/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg",
        "banner_url": "https://image.tmdb.org/t/p/original/rLb2cwF3Pazuxaj0sRXQ037tGI1.jpg",
        "trailer_url": "https://www.youtube-nocookie.com/embed/73_1biulkYk",
        "duration_minutes": 128,
        "certificate": "A",
        "release_date": date(2024, 7, 26),
        "is_now_showing": True,
        "is_coming_soon": False,
        "rating_avg": 7.7,
        "rating_count": 5200,
        "interested_count": 48000,
        "languages": ["English", "Hindi", "Tamil", "Telugu"],
        "genres": ["Action", "Comedy", "Sci-Fi"],
        "formats": ["2D", "3D", "IMAX 3D", "4DX"],
        "tmdb_id": 533535,
        "tmdb_vote_average": 7.7,
        "tmdb_popularity": 92.0,
        "is_tmdb": True,
    },
    {
        "title": "Avengers: Infinity War",
        "slug": "avengers-infinity-war-299536",
        "synopsis": "As the Avengers and their allies have continued to protect the world from threats too large for any one hero to handle, a new danger has emerged from the cosmic shadows: Thanos.",
        "poster_url": "https://image.tmdb.org/t/p/w500/7WsyChQLEftFiDOVTGkv3hFpyyt.jpg",
        "banner_url": "https://image.tmdb.org/t/p/original/rLb2cwF3Pazuxaj0sRXQ037tGI1.jpg",
        "trailer_url": "https://www.youtube-nocookie.com/embed/6ZfuNTqbHE8",
        "duration_minutes": 149,
        "certificate": "UA",
        "release_date": date(2018, 4, 27),
        "is_now_showing": True,
        "is_coming_soon": False,
        "rating_avg": 8.3,
        "rating_count": 28900,
        "interested_count": 65000,
        "languages": ["English", "Hindi", "Tamil", "Telugu"],
        "genres": ["Action", "Adventure", "Sci-Fi"],
        "formats": ["2D", "IMAX 3D"],
        "tmdb_id": 299536,
        "tmdb_vote_average": 8.3,
        "tmdb_popularity": 78.4,
        "is_tmdb": True,
    },
    {
        "title": "Dune: Part Two",
        "slug": "dune-part-two-693134",
        "synopsis": "Follow the mythic journey of Paul Atreides as he unites with Chani and the Fremen while on a path of revenge against the conspirators who destroyed his family.",
        "poster_url": "https://image.tmdb.org/t/p/w500/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg",
        "banner_url": "https://image.tmdb.org/t/p/original/rLb2cwF3Pazuxaj0sRXQ037tGI1.jpg",
        "trailer_url": "https://www.youtube-nocookie.com/embed/Way9Dexny3w",
        "duration_minutes": 166,
        "certificate": "UA",
        "release_date": date(2024, 3, 1),
        "is_now_showing": True,
        "is_coming_soon": False,
        "rating_avg": 8.2,
        "rating_count": 5800,
        "interested_count": 39000,
        "languages": ["English", "Hindi"],
        "genres": ["Sci-Fi", "Adventure"],
        "formats": ["2D", "IMAX with Laser", "Dolby Atmos 2D"],
        "tmdb_id": 693134,
        "tmdb_vote_average": 8.2,
        "tmdb_popularity": 81.0,
        "is_tmdb": True,
    },
    {
        "title": "Interstellar",
        "slug": "interstellar-157336",
        "synopsis": "The adventures of a group of explorers who make use of a newly discovered wormhole to surpass the limitations on human space travel.",
        "poster_url": "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
        "banner_url": "https://image.tmdb.org/t/p/original/rLb2cwF3Pazuxaj0sRXQ037tGI1.jpg",
        "trailer_url": "https://www.youtube-nocookie.com/embed/zSWdZVtXT7E",
        "duration_minutes": 169,
        "certificate": "UA",
        "release_date": date(2014, 11, 7),
        "is_now_showing": True,
        "is_coming_soon": False,
        "rating_avg": 8.4,
        "rating_count": 35400,
        "interested_count": 78000,
        "languages": ["English", "Hindi"],
        "genres": ["Adventure", "Drama", "Sci-Fi"],
        "formats": ["2D", "IMAX 3D"],
        "tmdb_id": 157336,
        "tmdb_vote_average": 8.4,
        "tmdb_popularity": 88.5,
        "is_tmdb": True,
    },
    {
        "title": "Inception",
        "slug": "inception-27205",
        "synopsis": "Cobb, a skilled thief who steals corporate secrets through the use of dream-sharing technology, is given the inverse task of planting an idea into the mind of a C.E.O.",
        "poster_url": "https://image.tmdb.org/t/p/w500/edv5CZvWj09upOsy2Y6IwDhK8bt.jpg",
        "banner_url": "https://image.tmdb.org/t/p/original/rLb2cwF3Pazuxaj0sRXQ037tGI1.jpg",
        "trailer_url": "https://www.youtube-nocookie.com/embed/YoHD9XEInc0",
        "duration_minutes": 148,
        "certificate": "UA",
        "release_date": date(2010, 7, 16),
        "is_now_showing": True,
        "is_coming_soon": False,
        "rating_avg": 8.4,
        "rating_count": 36200,
        "interested_count": 62000,
        "languages": ["English", "Hindi"],
        "genres": ["Action", "Sci-Fi", "Adventure"],
        "formats": ["2D", "IMAX with Laser"],
        "tmdb_id": 27205,
        "tmdb_vote_average": 8.4,
        "tmdb_popularity": 74.0,
        "is_tmdb": True,
    },
    {
        "title": "The Dark Knight",
        "slug": "the-dark-knight-155",
        "synopsis": "Batman raises the stakes in his war on crime. With the help of Lt. Jim Gordon and District Attorney Harvey Dent, Batman sets out to dismantle the remaining criminal organizations that plague the streets.",
        "poster_url": "https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
        "banner_url": "https://image.tmdb.org/t/p/original/rLb2cwF3Pazuxaj0sRXQ037tGI1.jpg",
        "trailer_url": "https://www.youtube-nocookie.com/embed/EXeTwQWrcwY",
        "duration_minutes": 152,
        "certificate": "UA",
        "release_date": date(2008, 7, 18),
        "is_now_showing": True,
        "is_coming_soon": False,
        "rating_avg": 8.5,
        "rating_count": 32100,
        "interested_count": 89000,
        "languages": ["English", "Hindi"],
        "genres": ["Drama", "Action", "Crime", "Thriller"],
        "formats": ["2D", "IMAX with Laser"],
        "tmdb_id": 155,
        "tmdb_vote_average": 8.5,
        "tmdb_popularity": 95.0,
        "is_tmdb": True,
    },
    {
        "title": "Spider-Man: Across the Spider-Verse",
        "slug": "spider-man-across-the-spider-verse-569094",
        "synopsis": "After reuniting with Gwen Stacy, Brooklyn's full-time, friendly neighborhood Spider-Man is catapulted across the Multiverse.",
        "poster_url": "https://image.tmdb.org/t/p/w500/8Vt6mWEReuy4Of61Lnj5Xj704m8.jpg",
        "banner_url": "https://image.tmdb.org/t/p/original/rLb2cwF3Pazuxaj0sRXQ037tGI1.jpg",
        "trailer_url": "https://www.youtube-nocookie.com/embed/cqGjhVJWtEg",
        "duration_minutes": 140,
        "certificate": "U",
        "release_date": date(2023, 6, 2),
        "is_now_showing": True,
        "is_coming_soon": False,
        "rating_avg": 8.4,
        "rating_count": 6500,
        "interested_count": 45000,
        "languages": ["English", "Hindi", "Tamil", "Telugu"],
        "genres": ["Animation", "Action", "Adventure", "Sci-Fi"],
        "formats": ["2D", "3D", "IMAX 3D", "4DX"],
        "tmdb_id": 569094,
        "tmdb_vote_average": 8.4,
        "tmdb_popularity": 79.2,
        "is_tmdb": True,
    },
    {
        "title": "Gladiator II",
        "slug": "gladiator-ii-558449",
        "synopsis": "Years after witnessing the death of the revered hero Maximus at the hands of his uncle, Lucius must enter the Colosseum.",
        "poster_url": "https://image.tmdb.org/t/p/w500/2cxhvwyEwRlysAmRH4iodkvo0z5.jpg",
        "banner_url": "https://image.tmdb.org/t/p/original/rLb2cwF3Pazuxaj0sRXQ037tGI1.jpg",
        "trailer_url": "https://www.youtube-nocookie.com/embed/4rgYUipGJNo",
        "duration_minutes": 148,
        "certificate": "A",
        "release_date": date(2024, 11, 22),
        "is_now_showing": True,
        "is_coming_soon": False,
        "rating_avg": 7.0,
        "rating_count": 2100,
        "interested_count": 31000,
        "languages": ["English", "Hindi"],
        "genres": ["Action", "Adventure", "Drama"],
        "formats": ["2D", "IMAX with Laser", "4DX"],
        "tmdb_id": 558449,
        "tmdb_vote_average": 7.0,
        "tmdb_popularity": 86.0,
        "is_tmdb": True,
    },
    {
        "title": "Wicked",
        "slug": "wicked-402431",
        "synopsis": "Elphaba, an ostracized but fiercely independent young woman born with green skin, and Glinda, a privileged and aristocratic young woman, form an unlikely friendship.",
        "poster_url": "https://image.tmdb.org/t/p/w500/xDGbZ0JJ3mYaGKy4Nzd9Kph6M9L.jpg",
        "banner_url": "https://image.tmdb.org/t/p/original/rLb2cwF3Pazuxaj0sRXQ037tGI1.jpg",
        "trailer_url": "https://www.youtube-nocookie.com/embed/6COmYeLsz4c",
        "duration_minutes": 160,
        "certificate": "U",
        "release_date": date(2024, 11, 22),
        "is_now_showing": True,
        "is_coming_soon": False,
        "rating_avg": 7.5,
        "rating_count": 1800,
        "interested_count": 27000,
        "languages": ["English", "Hindi"],
        "genres": ["Fantasy", "Musical", "Drama"],
        "formats": ["2D", "Dolby Atmos 2D"],
        "tmdb_id": 402431,
        "tmdb_vote_average": 7.5,
        "tmdb_popularity": 72.0,
        "is_tmdb": True,
    },
    {
        "title": "Alien: Romulus",
        "slug": "alien-romulus-945961",
        "synopsis": "While scavenging the deep ends of a derelict space station, a group of young space colonizers come face to face with the most terrifying life form in the universe.",
        "poster_url": "https://image.tmdb.org/t/p/w500/b33nnKl1GSFbao4l3fZDDqsMx0F.jpg",
        "banner_url": "https://image.tmdb.org/t/p/original/rLb2cwF3Pazuxaj0sRXQ037tGI1.jpg",
        "trailer_url": "https://www.youtube-nocookie.com/embed/x0XDEhP4MQs",
        "duration_minutes": 119,
        "certificate": "A",
        "release_date": date(2024, 8, 16),
        "is_now_showing": True,
        "is_coming_soon": False,
        "rating_avg": 7.3,
        "rating_count": 2900,
        "interested_count": 34000,
        "languages": ["English", "Hindi"],
        "genres": ["Horror", "Sci-Fi"],
        "formats": ["2D", "IMAX with Laser", "4DX"],
        "tmdb_id": 945961,
        "tmdb_vote_average": 7.3,
        "tmdb_popularity": 80.0,
        "is_tmdb": True,
    },
    {
        "title": "Inside Out 2",
        "slug": "inside-out-2-1022789",
        "synopsis": "Teenager Riley's mind headquarters is undergoing a sudden demolition to make room for something entirely unexpected: new Emotions!",
        "poster_url": "https://image.tmdb.org/t/p/w500/vpnVM9B6NMmQpWeZvzLvDESb2QY.jpg",
        "banner_url": "https://image.tmdb.org/t/p/original/rLb2cwF3Pazuxaj0sRXQ037tGI1.jpg",
        "trailer_url": "https://www.youtube-nocookie.com/embed/LEjhY15eCx0",
        "duration_minutes": 96,
        "certificate": "U",
        "release_date": date(2024, 6, 14),
        "is_now_showing": True,
        "is_coming_soon": False,
        "rating_avg": 7.6,
        "rating_count": 4800,
        "interested_count": 52000,
        "languages": ["English", "Hindi"],
        "genres": ["Animation", "Family", "Comedy"],
        "formats": ["2D", "3D"],
        "tmdb_id": 1022789,
        "tmdb_vote_average": 7.6,
        "tmdb_popularity": 83.5,
        "is_tmdb": True,
    },
    {
        "title": "Untitled Upcoming Feature",
        "slug": "untitled-upcoming-feature-999999",
        "synopsis": "An upcoming Indian theatrical release pending official artwork and poster clearance.",
        "poster_url": "",
        "banner_url": "",
        "trailer_url": None,
        "duration_minutes": 135,
        "certificate": "UA",
        "release_date": date(2026, 12, 25),
        "is_now_showing": False,
        "is_coming_soon": True,
        "rating_avg": 8.0,
        "rating_count": 0,
        "interested_count": 1200,
        "languages": ["Hindi", "Kannada"],
        "genres": ["Drama"],
        "formats": ["2D"],
        "tmdb_id": 999999,
        "tmdb_vote_average": 0.0,
        "tmdb_popularity": 5.0,
        "is_tmdb": True,
    }
]


async def seed_tmdb_movies_data(db: AsyncSession) -> int:
    """
    Inserts curated real TMDB non-showcase movies and creates sample showtimes.
    Returns count of movies inserted.
    """
    count_res = await db.execute(select(func.count(Movie.id)).where(Movie.is_tmdb.is_(True)))
    if (count_res.scalar() or 0) > 0:
        return 0

    inserted_movies: List[Movie] = []
    for item in TMDB_NON_SHOWCASE_MOVIES:
        m = Movie(
            title=item["title"],
            slug=item["slug"],
            synopsis=item["synopsis"],
            poster_url=item["poster_url"],
            banner_url=item["banner_url"],
            trailer_url=item["trailer_url"],
            duration_minutes=item["duration_minutes"],
            certificate=item["certificate"],
            release_date=item["release_date"],
            is_now_showing=item["is_now_showing"],
            is_coming_soon=item["is_coming_soon"],
            rating_avg=item["rating_avg"],
            rating_count=item["rating_count"],
            interested_count=item["interested_count"],
            languages=item["languages"],
            genres=item["genres"],
            formats=item["formats"],
            tmdb_id=item["tmdb_id"],
            tmdb_vote_average=item["tmdb_vote_average"],
            tmdb_popularity=item["tmdb_popularity"],
            is_tmdb=item["is_tmdb"],
            dominant_color="#1B1320",
        )
        db.add(m)
        inserted_movies.append(m)

    await db.flush()

    # Create showtimes for now-showing TMDB movies across existing cinemas
    cinemas_res = await db.execute(
        select(Cinema).options(selectinload(Cinema.auditoriums))
    )
    cinemas = cinemas_res.scalars().all()

    today = date.today()
    sample_slots = [time(11, 0), time(14, 30), time(18, 0), time(21, 30)]

    for mov in inserted_movies:
        if not mov.is_now_showing:
            continue
        # Assign to first 3 cinemas
        for cin in cinemas[:3]:
            if not cin.auditoriums:
                continue
            aud = cin.auditoriums[0]
            for day_offset in range(3):
                cur_date = today + timedelta(days=day_offset)
                for slot in sample_slots:
                    start_dt = datetime.combine(cur_date, slot)
                    end_dt = start_dt + timedelta(minutes=mov.duration_minutes + 20)
                    st = Showtime(
                        movie_id=mov.id,
                        cinema_id=cin.id,
                        auditorium_id=aud.id,
                        start_time=start_dt,
                        end_time=end_dt,
                        format=mov.formats[0] if mov.formats else "2D",
                        language=mov.languages[0] if mov.languages else "English",
                        cancellation_cutoff_minutes=120,
                    )
                    db.add(st)
                    await db.flush()

                    # Add price rules
                    for cat_name, b_price in [("Front", 180.0), ("Prime", 280.0), ("Premier", 380.0)]:
                        from app.models.showtime import PriceRule
                        db.add(PriceRule(
                            showtime_id=st.id,
                            category=cat_name,
                            base_price=b_price,
                        ))

                    # Seed standard seat inventory for this showtime
                    rows = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]
                    for r in rows:
                        for n in range(1, 11):
                            s_id = f"{r}{str(n).zfill(2)}"
                            cat = "Premier" if r in ["A", "B", "C"] else "Prime" if r in ["D", "E", "F", "G"] else "Front"
                            price = 380.0 if cat == "Premier" else 280.0 if cat == "Prime" else 180.0
                            db.add(SeatInventory(
                                showtime_id=st.id,
                                seat_id=s_id,
                                category=cat,
                                price=price,
                                status=SeatStatusEnum.AVAILABLE,
                            ))

    await db.commit()
    return len(inserted_movies)


if __name__ == "__main__":
    async def main():
        async with AsyncSessionLocal() as db:
            count = await seed_tmdb_movies_data(db)
            print(f"Seeded {count} real TMDB non-showcase movies.")
    asyncio.run(main())
