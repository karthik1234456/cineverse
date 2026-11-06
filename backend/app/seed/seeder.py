import json
import asyncio
from datetime import datetime, date, timedelta, time
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.database import AsyncSessionLocal, init_db
from app.models.auth import User, RoleEnum
from app.models.cinema import City, Cinema, Auditorium, TheatreAsset, Seat
from app.models.movie import Movie, MovieCast, Review
from app.models.showtime import Showtime, PriceRule, SeatInventory, SeatStatusEnum
from app.models.booking import FnbItem
from app.models.promotion import Coupon, DiscountTypeEnum
from app.services.auth_service import hash_password


CITIES_DATA = [
    {"name": "Bengaluru", "slug": "bengaluru", "state": "Karnataka"},
    {"name": "Mumbai", "slug": "mumbai", "state": "Maharashtra"},
    {"name": "Delhi NCR", "slug": "delhi-ncr", "state": "Delhi"},
    {"name": "Hyderabad", "slug": "hyderabad", "state": "Telangana"},
    {"name": "Chennai", "slug": "chennai", "state": "Tamil Nadu"},
    {"name": "Pune", "slug": "pune", "state": "Maharashtra"},
    {"name": "Kolkata", "slug": "kolkata", "state": "West Bengal"},
]

CINEMAS_DATA = [
    {
        "city_name": "Bengaluru",
        "name": "CineVerse IMAX Koramangala",
        "slug": "cineverse-imax-koramangala",
        "address": "80 Feet Road, 4th Block, Koramangala, Bengaluru, Karnataka 560034",
        "facilities": ["IMAX with Laser", "Dolby Atmos", "Recliner Seats", "Gourmet F&B", "Valet Parking"],
        "has_3d": True
    },
    {
        "city_name": "Bengaluru",
        "name": "CineVerse Luxe Orion Mall",
        "slug": "cineverse-luxe-orion-mall",
        "address": "Brigade Gateway, 26/1 Dr Rajkumar Rd, Rajajinagar, Bengaluru 560055",
        "facilities": ["Dolby Atmos", "4DX", "Wheelchair Access", "In-seat Dining"],
        "has_3d": False
    },
    {
        "city_name": "Mumbai",
        "name": "CineVerse PXL Lower Parel",
        "slug": "cineverse-pxl-lower-parel",
        "address": "High Street Phoenix, Senapati Bapat Marg, Lower Parel, Mumbai 400013",
        "facilities": ["IMAX", "Dolby Atmos", "Recliners", "Cocktail Lounge"],
        "has_3d": True
    },
    {
        "city_name": "Mumbai",
        "name": "CineVerse Bandra West",
        "slug": "cineverse-bandra-west",
        "address": "Linking Road, Bandra West, Mumbai 400050",
        "facilities": ["Dolby 7.1", "Parking", "Cafeteria"],
        "has_3d": False
    },
    {
        "city_name": "Delhi NCR",
        "name": "CineVerse Grand Mall of India",
        "slug": "cineverse-grand-mall-of-india",
        "address": "Sector 18, Noida, Uttar Pradesh 201301",
        "facilities": ["IMAX 3D Laser", "4DX", "Dolby Atmos", "Recliner Gold"],
        "has_3d": True
    },
    {
        "city_name": "Hyderabad",
        "name": "CineVerse Inorbit Cyberabad",
        "slug": "cineverse-inorbit-cyberabad",
        "address": "Inorbit Mall, Madhapur, Hitech City, Hyderabad 500081",
        "facilities": ["Large Screen", "Dolby Atmos", "Food Court"],
        "has_3d": True
    },
    {
        "city_name": "Chennai",
        "name": "CineVerse Express Avenue",
        "slug": "cineverse-express-avenue",
        "address": "Club House Road, Royapettah, Chennai 600002",
        "facilities": ["Dolby Atmos", "RGB Laser", "Recliner"],
        "has_3d": True
    },
    {
        "city_name": "Pune",
        "name": "CineVerse Phoenix Marketcity",
        "slug": "cineverse-phoenix-marketcity",
        "address": "Viman Nagar, Pune, Maharashtra 411014",
        "facilities": ["Dolby Atmos", "4DX", "Valet"],
        "has_3d": False
    }
]

MOVIES_DATA = [
    {
        "title": "Quantum Odyssey: Beyond the Singularity",
        "slug": "quantum-odyssey",
        "synopsis": "When an uncharted gravitational anomaly threatens Earth's orbital stability, a rogue astrophysicist and a quantum AI embark on an irreversible trans-dimensional voyage to unravel the fabric of spacetime.",
        "poster_url": "/posters/quantum_odyssey.png",
        "banner_url": "/posters/quantum_odyssey_banner.png",
        "trailer_url": "/trailers/quantum_odyssey.webm",
        "duration_minutes": 168,
        "certificate": "UA",
        "release_date": date.today() - timedelta(days=5),
        "is_now_showing": True,
        "is_coming_soon": False,
        "rating_avg": 9.2,
        "rating_count": 4820,
        "interested_count": 18200,
        "languages": ["English", "Hindi", "Kannada", "Tamil", "Telugu"],
        "genres": ["Sci-Fi", "Adventure", "Thriller"],
        "formats": ["IMAX 3D", "4DX", "2D Dolby Atmos"],
        "cast": [
            {"person_name": "Marcus Vance", "role_name": "Dr. Elijah Cole", "category": "Cast"},
            {"person_name": "Elena Rostova", "role_name": "Commander Sarah Cruz", "category": "Cast"},
            {"person_name": "Christopher Nolan-esque", "role_name": "Director", "category": "Director"}
        ]
    },
    {
        "title": "Astra: Chronicles of the Celestial Throne",
        "slug": "astra-celestial-throne",
        "synopsis": "In an ancient subcontinent powered by celestial crystals, five rival kingdoms wage dynastic war until an exiled warrior discovers the cosmic origin of their mystic energies.",
        "poster_url": "/posters/astra.png",
        "banner_url": "/posters/astra_banner.png",
        "trailer_url": "/trailers/astra.webm",
        "duration_minutes": 175,
        "certificate": "UA",
        "release_date": date.today() - timedelta(days=2),
        "is_now_showing": True,
        "is_coming_soon": False,
        "rating_avg": 8.9,
        "rating_count": 3150,
        "interested_count": 14500,
        "languages": ["Hindi", "Telugu", "Tamil", "Kannada", "Malayalam"],
        "genres": ["Action", "Fantasy", "Epic"],
        "formats": ["IMAX 3D", "2D Dolby Atmos"],
        "cast": [
            {"person_name": "Ranveer Pratap", "role_name": "Prince Aditya", "category": "Cast"},
            {"person_name": "Ananya Sen", "role_name": "Warrior Princess Tara", "category": "Cast"},
            {"person_name": "SS Rajamouli style", "role_name": "Director", "category": "Director"}
        ]
    },
    {
        "title": "Shadow Protocol: Bangalore Drift",
        "slug": "shadow-protocol",
        "synopsis": "An undercover cyber operative in Bengaluru's tech corridor uncovers an international surveillance cartel manipulating sovereign infrastructure from the shadows.",
        "poster_url": "/posters/shadow_protocol.png",
        "banner_url": "/posters/shadow_protocol_banner.png",
        "trailer_url": "/trailers/shadow_protocol.webm",
        "duration_minutes": 142,
        "certificate": "A",
        "release_date": date.today() - timedelta(days=12),
        "is_now_showing": True,
        "is_coming_soon": False,
        "rating_avg": 8.6,
        "rating_count": 2100,
        "interested_count": 8900,
        "languages": ["Kannada", "Hindi", "English"],
        "genres": ["Action", "Crime", "Tech Thriller"],
        "formats": ["2D Dolby Atmos"],
        "cast": [
            {"person_name": "Vikram Dev", "role_name": "Agent Arjun Roy", "category": "Cast"},
            {"person_name": "Meera Rao", "role_name": "Kavya Menon", "category": "Cast"}
        ]
    },
    {
        "title": "Echoes of the Western Ghats",
        "slug": "echoes-western-ghats",
        "synopsis": "A poignant nature drama about an indigenous biologist fighting to safeguard an untouched rainforest sanctuary from industrial deforestation.",
        "poster_url": "/posters/western_ghats.png",
        "banner_url": "/posters/western_ghats_banner.png",
        "trailer_url": None,
        "duration_minutes": 130,
        "certificate": "U",
        "release_date": date.today() - timedelta(days=20),
        "is_now_showing": True,
        "is_coming_soon": False,
        "rating_avg": 9.4,
        "rating_count": 1850,
        "interested_count": 6200,
        "languages": ["Kannada", "Malayalam", "English"],
        "genres": ["Drama", "Nature", "Environmental"],
        "formats": ["2D Dolby Atmos"],
        "cast": [
            {"person_name": "Chetan Kumar", "role_name": "Guru", "category": "Cast"}
        ]
    },
    {
        "title": "Neon Metropolis 2099",
        "slug": "neon-metropolis-2099",
        "synopsis": "In a neon-drenched cyberpunk megacity, a rogue android detective partners with a human engineer to solve a high-level digital consciousness theft.",
        "poster_url": "/posters/neon_metropolis.png",
        "banner_url": "/posters/neon_metropolis_banner.png",
        "trailer_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "duration_minutes": 154,
        "certificate": "A",
        "release_date": date.today() - timedelta(days=1),
        "is_now_showing": True,
        "is_coming_soon": False,
        "rating_avg": 8.7,
        "rating_count": 940,
        "interested_count": 7800,
        "languages": ["English", "Hindi"],
        "genres": ["Sci-Fi", "Cyberpunk", "Mystery"],
        "formats": ["IMAX 3D", "4DX"],
        "cast": [
            {"person_name": "Lucas Grey", "role_name": "Detective Kael", "category": "Cast"}
        ]
    },
    {
        "title": "The Last Kingdom: Battle of Panipat",
        "slug": "last-kingdom-panipat",
        "synopsis": "An epic historical retelling of courage, betrayal, and tactical brilliance on the blood-soaked plains of 18th-century Panipat.",
        "poster_url": "/posters/last_kingdom.png",
        "banner_url": "/posters/last_kingdom_banner.png",
        "trailer_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "duration_minutes": 182,
        "certificate": "UA",
        "release_date": date.today() - timedelta(days=8),
        "is_now_showing": True,
        "is_coming_soon": False,
        "rating_avg": 8.5,
        "rating_count": 4200,
        "interested_count": 11200,
        "languages": ["Hindi", "Marathi", "English"],
        "genres": ["History", "War", "Drama"],
        "formats": ["2D Dolby Atmos", "IMAX"],
        "cast": [
            {"person_name": "Siddharth Shinde", "role_name": "Sadashiv Rao", "category": "Cast"}
        ]
    },
    {
        "title": "Midnight Comedy Club",
        "slug": "midnight-comedy-club",
        "synopsis": "Four struggling stand-up comedians accidentally become witnesses to a quirky mob heist, using crowd-work and slapstick timing to survive the night.",
        "poster_url": "/posters/midnight_comedy.png",
        "banner_url": "/posters/midnight_comedy_banner.png",
        "trailer_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "duration_minutes": 118,
        "certificate": "UA",
        "release_date": date.today() - timedelta(days=15),
        "is_now_showing": True,
        "is_coming_soon": False,
        "rating_avg": 8.1,
        "rating_count": 1420,
        "interested_count": 3900,
        "languages": ["Hindi", "English"],
        "genres": ["Comedy", "Romance"],
        "formats": ["2D"],
        "cast": [
            {"person_name": "Zakir Khan style", "role_name": "Sameer", "category": "Cast"}
        ]
    },
    {
        "title": "Solaris Fleet: Mission Alpha",
        "slug": "solaris-fleet",
        "synopsis": "Humanity's first deep-space exploration battlecruiser encounters an ancient ringworld with dark secrets that threaten planetary peace.",
        "poster_url": "/posters/solaris_fleet.png",
        "banner_url": "/posters/solaris_fleet_banner.png",
        "trailer_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "duration_minutes": 160,
        "certificate": "UA",
        "release_date": date.today() + timedelta(days=7),
        "is_now_showing": False,
        "is_coming_soon": True,
        "rating_avg": 0.0,
        "rating_count": 0,
        "interested_count": 34000,
        "languages": ["English", "Hindi"],
        "genres": ["Sci-Fi", "Action"],
        "formats": ["IMAX 3D", "4DX"],
        "cast": [{"person_name": "Johnathan Vance", "role_name": "Fleet Admiral", "category": "Cast"}]
    },
    {
        "title": "Whispers of the Monsoon",
        "slug": "whispers-monsoon",
        "synopsis": "A lyrical love story spanning two decades across Kerala backwaters, exploring memory, classical music, and homecoming.",
        "poster_url": "/posters/monsoon.png",
        "banner_url": "/posters/monsoon_banner.png",
        "trailer_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "duration_minutes": 138,
        "certificate": "U",
        "release_date": date.today() + timedelta(days=14),
        "is_now_showing": False,
        "is_coming_soon": True,
        "rating_avg": 0.0,
        "rating_count": 0,
        "interested_count": 19500,
        "languages": ["Malayalam", "Tamil", "Hindi"],
        "genres": ["Romance", "Musical", "Drama"],
        "formats": ["2D Dolby Atmos"],
        "cast": [{"person_name": "Dulquer style", "role_name": "Madhavan", "category": "Cast"}]
    },
    {
        "title": "Inferno: Mountain Rescue",
        "slug": "inferno-mountain-rescue",
        "synopsis": "An elite Himalayan search-and-rescue squadron must navigate treacherous blizzards and seismic avalanches to save stranded climbers.",
        "poster_url": "/posters/inferno.png",
        "banner_url": "/posters/inferno_banner.png",
        "trailer_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "duration_minutes": 128,
        "certificate": "UA",
        "release_date": date.today() + timedelta(days=21),
        "is_now_showing": False,
        "is_coming_soon": True,
        "rating_avg": 0.0,
        "rating_count": 0,
        "interested_count": 12800,
        "languages": ["Hindi", "English"],
        "genres": ["Thriller", "Adventure"],
        "formats": ["4DX", "2D"],
        "cast": [{"person_name": "Ajay Dev", "role_name": "Captain Kabir", "category": "Cast"}]
    },
    {
        "title": "Chakravyuh: The Heist of Mumbai",
        "slug": "chakravyuh-heist",
        "synopsis": "A master illusionist orchestrates a flawless diamond exchange heist in Mumbai's financial fortress while playing mind games with the ATS.",
        "poster_url": "/posters/chakravyuh.png",
        "banner_url": "/posters/chakravyuh_banner.png",
        "trailer_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "duration_minutes": 145,
        "certificate": "UA",
        "release_date": date.today() + timedelta(days=30),
        "is_now_showing": False,
        "is_coming_soon": True,
        "rating_avg": 0.0,
        "rating_count": 0,
        "interested_count": 27000,
        "languages": ["Hindi", "Marathi", "Telugu"],
        "genres": ["Thriller", "Action"],
        "formats": ["IMAX 3D", "2D"],
        "cast": [{"person_name": "Shahid style", "role_name": "Kabir Mathur", "category": "Cast"}]
    },
    {
        "title": "The Forest of Spirits",
        "slug": "forest-of-spirits",
        "synopsis": "In a remote village bordering dense forests, a young girl discovers an ethereal realm of folklore spirits guarded by a magical white leopard.",
        "poster_url": "/posters/forest_spirits.png",
        "banner_url": "/posters/forest_spirits_banner.png",
        "trailer_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "duration_minutes": 105,
        "certificate": "U",
        "release_date": date.today() + timedelta(days=35),
        "is_now_showing": False,
        "is_coming_soon": True,
        "rating_avg": 0.0,
        "rating_count": 0,
        "interested_count": 15400,
        "languages": ["English", "Hindi", "Tamil", "Telugu", "Kannada"],
        "genres": ["Animation", "Family", "Fantasy"],
        "formats": ["3D", "2D"],
        "cast": [{"person_name": "Miyazaki inspired", "role_name": "Director", "category": "Director"}]
    }
]

FNB_DATA = [
    {
        "name": "Caramel Popcorn (Large)",
        "description": "Freshly popped warm golden corn tossed in rich gourmet caramel glaze.",
        "category": "Popcorn",
        "price": 320.0,
        "image_url": "/fnb/popcorn_caramel.png"
    },
    {
        "name": "Classic Salted Popcorn (Tub)",
        "description": "Traditional cinema buttered salted popcorn in a jumbo sharing tub.",
        "category": "Popcorn",
        "price": 280.0,
        "image_url": "/fnb/popcorn_salted.png"
    },
    {
        "name": "Pepsi Fountain Chill (800ml)",
        "description": "Chilled sparkling Pepsi served in an insulated souvenir cup.",
        "category": "Beverage",
        "price": 190.0,
        "image_url": "/fnb/pepsi.png"
    },
    {
        "name": "Loaded Cheese Nachos with Jalapeños",
        "description": "Crispy Mexican corn tortilla chips with warm nacho cheddar sauce and chunky salsa.",
        "category": "Snacks",
        "price": 260.0,
        "image_url": "/fnb/nachos.png"
    },
    {
        "name": "CineVerse Grand Movie Combo",
        "description": "1 Large Caramel Popcorn + 2 Large Sodas + 1 Loaded Nachos tub.",
        "category": "Combo",
        "price": 690.0,
        "image_url": "/fnb/grand_combo.png"
    }
]

COUPONS_DATA = [
    {
        "code": "CINEVERSE50",
        "description": "50% off on all movie tickets up to ₹150",
        "discount_type": DiscountTypeEnum.PERCENTAGE,
        "discount_value": 50.0,
        "min_order_amount": 300.0,
        "max_discount_amount": 150.0
    },
    {
        "code": "BLOCKBUSTER100",
        "description": "Flat ₹100 discount on booking of 2 or more tickets",
        "discount_type": DiscountTypeEnum.FLAT,
        "discount_value": 100.0,
        "min_order_amount": 400.0,
        "max_discount_amount": 100.0
    },
    {
        "code": "FIRSTSHOW",
        "description": "Welcome 20% discount on your first CineVerse booking",
        "discount_type": DiscountTypeEnum.PERCENTAGE,
        "discount_value": 20.0,
        "min_order_amount": 250.0,
        "max_discount_amount": 200.0
    }
]


async def seed_database():
    print("Initializing database tables...")
    await init_db()

    async with AsyncSessionLocal() as db:
        # Check if already seeded
        res = await db.execute(select(City))
        if res.scalars().first():
            print("Database already contains data. Skipping re-seed.")
            return

        print("Seeding Users...")
        users = [
            User(
                email="admin@cineverse.in",
                phone="9876543210",
                hashed_password=hash_password("Admin@123"),
                full_name="CineVerse Admin",
                role=RoleEnum.ADMIN,
                is_active=True,
                is_verified=True
            ),
            User(
                email="manager@cineverse.in",
                phone="9876543211",
                hashed_password=hash_password("Manager@123"),
                full_name="Cinema Manager (Bengaluru)",
                role=RoleEnum.CINEMA_MANAGER,
                is_active=True,
                is_verified=True
            ),
            User(
                email="patron@example.com",
                phone="9876543212",
                hashed_password=hash_password("Patron@123"),
                full_name="Karthik Patron",
                role=RoleEnum.CUSTOMER,
                is_active=True,
                is_verified=True
            ),
            User(
                email="support@cineverse.in",
                phone="9876543213",
                hashed_password=hash_password("Support@123"),
                full_name="CineVerse Support Lead",
                role=RoleEnum.SUPPORT,
                is_active=True,
                is_verified=True
            )
        ]
        db.add_all(users)
        await db.flush()

        print("Seeding Cities...")
        city_map = {}
        for c in CITIES_DATA:
            city = City(name=c["name"], slug=c["slug"], state=c["state"], is_active=True)
            db.add(city)
            await db.flush()
            city_map[c["name"]] = city

        print("Loading 3D seat layout from seat_layout_v2.json...")
        layout_candidates = [
            Path("frontend/public/models/seat_layout_v2.json"),
            Path("../frontend/public/models/seat_layout_v2.json"),
            Path("seat_layout_v2_1.json"),
            Path("../seat_layout_v2_1.json"),
        ]
        layout_file = next((p for p in layout_candidates if p.exists()), None)
        seat_layout_data = []
        if layout_file:
            with open(layout_file, "r", encoding="utf-8") as f:
                parsed = json.load(f)
                seat_layout_data = parsed.get("seats", [])
        print(f"Loaded {len(seat_layout_data)} 3D seats from {layout_file}")

        print("Seeding Cinemas & Auditoriums...")
        cinema_entities = []
        auditorium_entities = []
        primary_3d_auditorium = None

        for c_data in CINEMAS_DATA:
            city_obj = city_map.get(c_data["city_name"])
            if not city_obj:
                continue

            cinema = Cinema(
                city_id=city_obj.id,
                name=c_data["name"],
                slug=c_data["slug"],
                address=c_data["address"],
                facilities=c_data["facilities"],
                images=["/cinemas/cinema_1.jpg", "/cinemas/cinema_2.jpg"]
            )
            db.add(cinema)
            await db.flush()
            cinema_entities.append(cinema)

            # Create Auditoriums for cinema
            if c_data["has_3d"]:
                aud_3d = Auditorium(
                    cinema_id=cinema.id,
                    name="Auditorium 1 — 3D Laser IMAX",
                    screen_type="IMAX 3D",
                    total_seats=100,
                    has_3d_preview=True
                )
                db.add(aud_3d)
                await db.flush()
                auditorium_entities.append(aud_3d)

                if primary_3d_auditorium is None:
                    primary_3d_auditorium = aud_3d

                glb_candidates = [
                    Path("frontend/public/models/cineverse_auditorium_v2.web.glb"),
                    Path("../frontend/public/models/cineverse_auditorium_v2.web.glb"),
                ]
                glb_file = next((p for p in glb_candidates if p.exists()), None)
                glb_checksum = "e1289e1ad3aa2b0fbff31633f016cb47e996dfc4d06dca6347b491d8153c3d9d"
                if glb_file:
                    import hashlib
                    glb_checksum = hashlib.sha256(glb_file.read_bytes()).hexdigest()

                # Attach TheatreAsset
                asset = TheatreAsset(
                    auditorium_id=aud_3d.id,
                    glb_path="/models/cineverse_auditorium_v2.web.glb",
                    layout_path="/models/seat_layout_v2.json",
                    version="2.0",
                    checksum=glb_checksum,
                    total_triangles=218000
                )
                db.add(asset)

                # Seed the 100 seats for this auditorium
                for s in seat_layout_data:
                    cat_map = {"front": "Front", "prime": "Prime", "premier": "Premier"}
                    cat = cat_map.get(s.get("category", "prime").lower(), "Prime")
                    eye = s.get("eye_position_gltf_y_up", [0, 1.2, 5])
                    seat = Seat(
                        auditorium_id=aud_3d.id,
                        seat_id=s.get("seat_id"),
                        row=s.get("row"),
                        number=s.get("number"),
                        category=cat,
                        node_name=s.get("node_name"),
                        eye_x=eye[0],
                        eye_y=eye[1],
                        eye_z=eye[2],
                        distance_to_screen=s.get("screen_distance_m_est", s.get("screen_distance", 10.0)),
                        vertical_angle_deg=s.get("vertical_angle_deg", 0.0),
                        horizontal_angle_deg=s.get("horizontal_offset_deg", 0.0)
                    )
                    db.add(seat)
            else:
                aud_std = Auditorium(
                    cinema_id=cinema.id,
                    name="Screen 1 — Dolby Atmos 4K",
                    screen_type="2D Dolby Atmos",
                    total_seats=100,
                    has_3d_preview=False
                )
                db.add(aud_std)
                await db.flush()
                auditorium_entities.append(aud_std)

                # Seed standard seats A01..J10
                for row_idx, r in enumerate("ABCDEFGHIJ"):
                    cat = "Front" if r in "ABC" else ("Prime" if r in "DEFG" else "Premier")
                    for n in range(1, 11):
                        seat_id = f"{r}{str(n).zfill(2)}"
                        seat = Seat(
                            auditorium_id=aud_std.id,
                            seat_id=seat_id,
                            row=r,
                            number=n,
                            category=cat,
                            node_name=f"seat_{r}_{str(n).zfill(2)}",
                            eye_x=0.0,
                            eye_y=1.2,
                            eye_z=float(row_idx * 1.5 + 4.0),
                            distance_to_screen=float(row_idx * 1.5 + 6.0),
                            vertical_angle_deg=5.0,
                            horizontal_angle_deg=0.0
                        )
                        db.add(seat)

        await db.flush()

        print("Seeding Movies...")
        movie_entities = []
        for m_data in MOVIES_DATA:
            movie = Movie(
                title=m_data["title"],
                slug=m_data["slug"],
                synopsis=m_data["synopsis"],
                poster_url=m_data["poster_url"],
                banner_url=m_data["banner_url"],
                trailer_url=m_data["trailer_url"],
                duration_minutes=m_data["duration_minutes"],
                certificate=m_data["certificate"],
                release_date=m_data["release_date"],
                is_now_showing=m_data["is_now_showing"],
                is_coming_soon=m_data["is_coming_soon"],
                rating_avg=m_data["rating_avg"],
                rating_count=m_data["rating_count"],
                interested_count=m_data["interested_count"],
                languages=m_data["languages"],
                genres=m_data["genres"],
                formats=m_data["formats"]
            )
            db.add(movie)
            await db.flush()
            movie_entities.append(movie)

            # Cast members
            for cast in m_data.get("cast", []):
                db.add(MovieCast(
                    movie_id=movie.id,
                    person_name=cast["person_name"],
                    role_name=cast["role_name"],
                    category=cast["category"]
                ))

            # Sample verified reviews for now showing movies
            if movie.is_now_showing:
                db.add(Review(
                    movie_id=movie.id,
                    user_id=users[2].id,
                    rating=9,
                    headline="Breathtaking visual spectacle!",
                    content="The 3D depth and sound mastering are phenomenal. Absolutely recommend seeing this in an IMAX auditorium from Prime row E or F!",
                    has_spoilers=False,
                    is_approved=True
                ))

        await db.flush()

        print("Seeding F&B Items...")
        for fnb in FNB_DATA:
            db.add(FnbItem(**fnb))

        print("Seeding Coupons...")
        for c in COUPONS_DATA:
            db.add(Coupon(**c))

        await db.flush()

        print("Seeding Showtimes for the next 7 days...")
        # Schedule showtimes for now_showing movies across auditoriums
        now_movies = [m for m in movie_entities if m.is_now_showing]
        daily_slots = [
            (time(10, 0), time(12, 45)),
            (time(13, 30), time(16, 15)),
            (time(17, 0), time(19, 45)),
            (time(20, 30), time(23, 15)),
        ]

        # Focus showtimes across our cinemas for the next 7 days
        today = date.today()
        price_maps = {
            "Front": 280.0,
            "Prime": 380.0,
            "Premier": 520.0
        }

        for day_offset in range(7):
            cur_date = today + timedelta(days=day_offset)

            for aud in auditorium_entities[:4]:  # Top 4 screens
                cinema = next(c for c in cinema_entities if c.id == aud.cinema_id)
                for slot_idx, (start_t, end_t) in enumerate(daily_slots):
                    movie = now_movies[(day_offset + slot_idx) % len(now_movies)]

                    st = Showtime(
                        movie_id=movie.id,
                        cinema_id=cinema.id,
                        auditorium_id=aud.id,
                        start_time=datetime.combine(cur_date, start_t),
                        end_time=datetime.combine(cur_date, end_t),
                        format=aud.screen_type,
                        language=movie.languages[0] if movie.languages else "English",
                        cancellation_cutoff_minutes=120
                    )
                    db.add(st)
                    await db.flush()

                    # Price rules
                    for cat, pr in price_maps.items():
                        db.add(PriceRule(showtime_id=st.id, category=cat, base_price=pr))

                    # Seed SeatInventory for this showtime
                    # Fetch seats for this auditorium
                    s_res = await db.execute(select(Seat).where(Seat.auditorium_id == aud.id))
                    aud_seats = s_res.scalars().all()

                    for seat_obj in aud_seats:
                        # Pre-book a realistic few seats (e.g., 5-10% of seats) for today to demonstrate live availability colors
                        is_booked_sample = (
                            day_offset == 0 and
                            seat_obj.seat_id in ["B01", "B02", "B03", "B04", "B05"]
                        )
                        is_held_sample = (
                            day_offset == 0 and
                            seat_obj.seat_id in ["C04", "C05"]
                        )
                        status = (
                            SeatStatusEnum.BOOKED if is_booked_sample else
                            SeatStatusEnum.HELD if is_held_sample else
                            SeatStatusEnum.AVAILABLE
                        )
                        inv = SeatInventory(
                            showtime_id=st.id,
                            seat_id=seat_obj.seat_id,
                            category=seat_obj.category,
                            price=price_maps.get(seat_obj.category, 380.0),
                            status=status,
                            booking_id=1 if is_booked_sample else None
                        )
                        db.add(inv)

        await db.commit()
        print("Database seeding completed successfully!")


if __name__ == "__main__":
    asyncio.run(seed_database())

