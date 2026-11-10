import os
import json
import random
import math
import asyncio
from datetime import datetime, date, timedelta, time
from typing import Dict, List, Set, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, insert, func

from app.database import AsyncSessionLocal, init_db, reset_db
from app.models.auth import User, RoleEnum
from app.models.cinema import City, Cinema, Auditorium, TheatreAsset, Seat
from app.models.movie import Movie, MovieCast, Review
from app.models.showtime import Showtime, PriceRule, SeatInventory, SeatStatusEnum
from app.models.booking import FnbItem
from app.models.promotion import Coupon, DiscountTypeEnum
from app.services.auth_service import hash_password
from app.services.theatre_type_registry import (
    THEATRE_TYPES,
    get_theatre_type_definition,
    METERS_TO_SCENE,
    SCENE_TO_METERS,
)
from app.seed.cinemas_meta import CINEMAS_METADATA

# MANDATORY: Fixed deterministic seed for reproducible seeding
random.seed(42)

CITIES_DATA = [
    {"name": "Bengaluru", "slug": "bengaluru", "state": "Karnataka", "languages": ["Kannada", "English", "Hindi"]},
    {"name": "Mumbai", "slug": "mumbai", "state": "Maharashtra", "languages": ["Hindi", "Marathi", "English"]},
    {"name": "Delhi NCR", "slug": "delhi-ncr", "state": "Delhi", "languages": ["Hindi", "Punjabi", "English"]},
    {"name": "Hyderabad", "slug": "hyderabad", "state": "Telangana", "languages": ["Telugu", "Hindi", "English"]},
    {"name": "Chennai", "slug": "chennai", "state": "Tamil Nadu", "languages": ["Tamil", "Telugu", "English"]},
    {"name": "Pune", "slug": "pune", "state": "Maharashtra", "languages": ["Marathi", "Hindi", "English"]},
    {"name": "Kolkata", "slug": "kolkata", "state": "West Bengal", "languages": ["Bengali", "Hindi", "English"]},
]

CINEMAS_DATA = [
    # Bengaluru (5 cinemas)
    {
        "city_slug": "bengaluru",
        "name": "CineVerse Astral Koramangala",
        "slug": "cineverse-astral-koramangala",
        "address": "80 Feet Road, 4th Block, Koramangala, Bengaluru, Karnataka 560034",
        "latitude": 12.9352, "longitude": 77.6245,
        "facilities": ["IMAX with Laser", "Dolby Atmos 4K", "3D Interactive Hall", "Recliner Gold", "Gourmet Kitchen", "Valet"],
        "is_flagship": True,
        "has_3d_hall": True
    },
    {
        "city_slug": "bengaluru",
        "name": "CineVerse Nexus Whitefield",
        "slug": "cineverse-nexus-whitefield",
        "address": "Prestige Shantiniketan, ITPL Main Road, Whitefield, Bengaluru 560066",
        "latitude": 12.9850, "longitude": 77.7310,
        "facilities": ["Dolby Atmos 4DX", "4K Laser", "Wheelchair Access", "In-seat Dining"],
        "is_flagship": False,
        "has_3d_hall": False
    },
    {
        "city_slug": "bengaluru",
        "name": "CineVerse Orion Dome Rajajinagar",
        "slug": "cineverse-orion-dome-rajajinagar",
        "address": "Brigade Gateway, 26/1 Dr Rajkumar Road, Rajajinagar, Bengaluru 560055",
        "latitude": 13.0112, "longitude": 77.5550,
        "facilities": ["Large Format Screen", "Dolby Atmos", "Recliners", "Food Court"],
        "is_flagship": False,
        "has_3d_hall": False
    },
    {
        "city_slug": "bengaluru",
        "name": "CineVerse Indiranagar Playhouse",
        "slug": "cineverse-indiranagar-playhouse",
        "address": "100 Feet Road, HAL 2nd Stage, Indiranagar, Bengaluru 560038",
        "latitude": 12.9719, "longitude": 77.6412,
        "facilities": ["Boutique Screens", "Dolby 7.1", "Artisan Cafe", "Valet"],
        "is_flagship": False,
        "has_3d_hall": False
    },
    {
        "city_slug": "bengaluru",
        "name": "CineVerse Jayanagar Heritage",
        "slug": "cineverse-jayanagar-heritage",
        "address": "4th Block, 11th Main Road, Jayanagar, Bengaluru 560011",
        "latitude": 12.9299, "longitude": 77.5824,
        "facilities": ["Dolby Atmos", "Laser Projection", "Family Lounge", "Parking"],
        "is_flagship": False,
        "has_3d_hall": False
    },

    # Mumbai (5 cinemas)
    {
        "city_slug": "mumbai",
        "name": "CineVerse Horizon Lower Parel",
        "slug": "cineverse-horizon-lower-parel",
        "address": "High Street Phoenix, Senapati Bapat Marg, Lower Parel, Mumbai 400013",
        "latitude": 18.9950, "longitude": 72.8258,
        "facilities": ["IMAX with Laser", "Dolby Atmos 4DX", "Flagship Big Hall", "VIP Lounge", "Valet"],
        "is_flagship": True,
        "has_3d_hall": False
    },
    {
        "city_slug": "mumbai",
        "name": "CineVerse Bandra Seafront",
        "slug": "cineverse-bandra-seafront",
        "address": "Carter Road Promenade, Bandra West, Mumbai 400050",
        "latitude": 19.0657, "longitude": 72.8273,
        "facilities": ["Dolby Atmos", "4K RGB Laser", "Sea-view Cafe", "Recliners"],
        "is_flagship": False,
        "has_3d_hall": False
    },
    {
        "city_slug": "mumbai",
        "name": "CineVerse Juhu Palm Pavilion",
        "slug": "cineverse-juhu-palm-pavilion",
        "address": "VM Road, J.V.P.D. Scheme, Juhu, Mumbai 400049",
        "latitude": 19.1075, "longitude": 72.8263,
        "facilities": ["Luxe Recliners", "Dolby 7.1", "Gourmet Bistro", "Valet"],
        "is_flagship": False,
        "has_3d_hall": False
    },
    {
        "city_slug": "mumbai",
        "name": "CineVerse Andheri Grand Screen",
        "slug": "cineverse-andheri-grand-screen",
        "address": "Infinity Mall, Link Road, Andheri West, Mumbai 400053",
        "latitude": 19.1415, "longitude": 72.8315,
        "facilities": ["Large Screen", "Dolby Atmos", "Gaming Zone", "Parking"],
        "is_flagship": False,
        "has_3d_hall": False
    },
    {
        "city_slug": "mumbai",
        "name": "CineVerse Ghatkopar Pulse",
        "slug": "cineverse-ghatkopar-pulse",
        "address": "R City Mall, LBS Marg, Ghatkopar West, Mumbai 400086",
        "latitude": 19.0998, "longitude": 72.9166,
        "facilities": ["Dolby Atmos", "Family Lounges", "Food Court", "Parking"],
        "is_flagship": False,
        "has_3d_hall": False
    },

    # Delhi NCR (5 cinemas)
    {
        "city_slug": "delhi-ncr",
        "name": "CineVerse Connaught Regal",
        "slug": "cineverse-connaught-regal",
        "address": "Connaught Place, Inner Circle Block B, New Delhi 110001",
        "latitude": 28.6328, "longitude": 77.2197,
        "facilities": ["IMAX with Laser", "Flagship Big Hall", "Dolby Atmos", "Heritage Lounge", "Valet"],
        "is_flagship": True,
        "has_3d_hall": False
    },
    {
        "city_slug": "delhi-ncr",
        "name": "CineVerse Noida Sector 18 Hub",
        "slug": "cineverse-noida-sector-18-hub",
        "address": "Wave Galleria, Sector 18, Noida, Uttar Pradesh 201301",
        "latitude": 28.5708, "longitude": 77.3208,
        "facilities": ["Dolby Atmos 4DX", "4K Laser", "Recliners", "Food Court"],
        "is_flagship": False,
        "has_3d_hall": False
    },
    {
        "city_slug": "delhi-ncr",
        "name": "CineVerse Gurgaon CyberCity Cinema",
        "slug": "cineverse-gurgaon-cybercity-cinema",
        "address": "CyberHub, DLF Cyber City Phase 2, Gurugram, Haryana 122002",
        "latitude": 28.4950, "longitude": 77.0895,
        "facilities": ["Dolby Atmos", "Corporate Lounges", "Gourmet Bar", "Parking"],
        "is_flagship": False,
        "has_3d_hall": False
    },
    {
        "city_slug": "delhi-ncr",
        "name": "CineVerse Saket Select Theatre",
        "slug": "cineverse-saket-select-theatre",
        "address": "Select Citywalk, Press Enclave Road, Saket, New Delhi 110017",
        "latitude": 28.5284, "longitude": 77.2195,
        "facilities": ["4K Laser", "Recliner Gold", "Wheelchair Access", "Valet"],
        "is_flagship": False,
        "has_3d_hall": False
    },
    {
        "city_slug": "delhi-ncr",
        "name": "CineVerse Vasant Kunj Royale",
        "slug": "cineverse-vasant-kunj-royale",
        "address": "Nelson Mandela Marg, Vasant Kunj II, New Delhi 110070",
        "latitude": 28.5412, "longitude": 77.1558,
        "facilities": ["Dolby Atmos", "Boutique Screens", "VIP Concierge", "Parking"],
        "is_flagship": False,
        "has_3d_hall": False
    },

    # Hyderabad (5 cinemas)
    {
        "city_slug": "hyderabad",
        "name": "CineVerse HITEC City CineDome",
        "slug": "cineverse-hitec-city-cinedome",
        "address": "Inorbit Mall Road, Mindspace IT Park, Madhapur, Hyderabad 500081",
        "latitude": 17.4348, "longitude": 78.3869,
        "facilities": ["IMAX with Laser", "Flagship Big Hall", "Dolby Atmos 4DX", "Tech Lounge", "Valet"],
        "is_flagship": True,
        "has_3d_hall": False
    },
    {
        "city_slug": "hyderabad",
        "name": "CineVerse Banjara Hills Vista",
        "slug": "cineverse-banjara-hills-vista",
        "address": "Road No 1, Banjara Hills, Hyderabad 500034",
        "latitude": 17.4156, "longitude": 78.4487,
        "facilities": ["Dolby Atmos", "Recliners", "Artisan Dining", "Valet"],
        "is_flagship": False,
        "has_3d_hall": False
    },
    {
        "city_slug": "hyderabad",
        "name": "CineVerse Gachibowli ScreenMatrix",
        "slug": "cineverse-gachibowli-screenmatrix",
        "address": "Old Mumbai Highway, Gachibowli, Hyderabad 500032",
        "latitude": 17.4401, "longitude": 78.3489,
        "facilities": ["4K Laser", "Dolby 7.1", "Wheelchair Access", "Parking"],
        "is_flagship": False,
        "has_3d_hall": False
    },
    {
        "city_slug": "hyderabad",
        "name": "CineVerse Secunderabad Classic",
        "slug": "cineverse-secunderabad-classic",
        "address": "RP Road, Clock Tower Square, Secunderabad 500003",
        "latitude": 17.4399, "longitude": 78.4983,
        "facilities": ["Large Format", "Dolby Atmos", "Traditional Cafe", "Parking"],
        "is_flagship": False,
        "has_3d_hall": False
    },
    {
        "city_slug": "hyderabad",
        "name": "CineVerse Jubilee Hills Luxe",
        "slug": "cineverse-jubilee-hills-luxe",
        "address": "Road No 36, Jubilee Hills, Hyderabad 500033",
        "latitude": 17.4319, "longitude": 78.4073,
        "facilities": ["Luxe Recliner Hall", "Gourmet Menu", "VIP Entry", "Valet"],
        "is_flagship": False,
        "has_3d_hall": False
    },

    # Chennai (5 cinemas)
    {
        "city_slug": "chennai",
        "name": "CineVerse Express Avenue Royal",
        "slug": "cineverse-express-avenue-royal",
        "address": "Club House Road, Royapettah, Chennai 600002",
        "latitude": 13.0587, "longitude": 80.2642,
        "facilities": ["IMAX with Laser", "Flagship Big Hall", "Dolby Atmos", "Recliner Gold", "Valet"],
        "is_flagship": True,
        "has_3d_hall": False
    },
    {
        "city_slug": "chennai",
        "name": "CineVerse Anna Nagar CinePalace",
        "slug": "cineverse-anna-nagar-cinepalace",
        "address": "2nd Avenue, Anna Nagar East, Chennai 600102",
        "latitude": 13.0850, "longitude": 80.2100,
        "facilities": ["Dolby Atmos 4DX", "RGB Laser", "Recliners", "Food Court"],
        "is_flagship": False,
        "has_3d_hall": False
    },
    {
        "city_slug": "chennai",
        "name": "CineVerse Velachery Grand",
        "slug": "cineverse-velachery-grand",
        "address": "Phoenix Marketcity, 142 Velachery Main Road, Chennai 600042",
        "latitude": 12.9915, "longitude": 80.2170,
        "facilities": ["Large Screen", "Dolby Atmos", "Wheelchair Access", "Parking"],
        "is_flagship": False,
        "has_3d_hall": False
    },
    {
        "city_slug": "chennai",
        "name": "CineVerse T Nagar Heritage",
        "slug": "cineverse-t-nagar-heritage",
        "address": "South Usman Road, T Nagar, Chennai 600017",
        "latitude": 13.0418, "longitude": 80.2341,
        "facilities": ["Dolby 7.1", "Laser 4K", "Filter Coffee Bar", "Parking"],
        "is_flagship": False,
        "has_3d_hall": False
    },
    {
        "city_slug": "chennai",
        "name": "CineVerse OMR TechScreen",
        "slug": "cineverse-omr-techscreen",
        "address": "Old Mahabalipuram Road, Sholinganallur, Chennai 600119",
        "latitude": 12.9010, "longitude": 80.2279,
        "facilities": ["Dolby Atmos", "Tech Lounge", "Youth Cafe", "Parking"],
        "is_flagship": False,
        "has_3d_hall": False
    },

    # Pune (5 cinemas)
    {
        "city_slug": "pune",
        "name": "CineVerse Viman Nagar Orion",
        "slug": "cineverse-viman-nagar-orion",
        "address": "Phoenix Marketcity, Nagar Road, Viman Nagar, Pune 411014",
        "latitude": 18.5626, "longitude": 73.9167,
        "facilities": ["IMAX with Laser", "Flagship Big Hall", "Dolby Atmos", "Recliners", "Valet"],
        "is_flagship": True,
        "has_3d_hall": False
    },
    {
        "city_slug": "pune",
        "name": "CineVerse Koregaon Park Boutique",
        "slug": "cineverse-koregaon-park-boutique",
        "address": "North Main Road, Koregaon Park, Pune 411001",
        "latitude": 18.5362, "longitude": 73.8940,
        "facilities": ["Luxe Screens", "Dolby Atmos", "Art Cafe", "Valet"],
        "is_flagship": False,
        "has_3d_hall": False
    },
    {
        "city_slug": "pune",
        "name": "CineVerse Kothrud CineCentre",
        "slug": "cineverse-kothrud-cinecentre",
        "address": "Paud Road, Kothrud, Pune 411038",
        "latitude": 18.5074, "longitude": 73.8077,
        "facilities": ["Dolby Atmos 4DX", "Laser 4K", "Family Lounge", "Parking"],
        "is_flagship": False,
        "has_3d_hall": False
    },
    {
        "city_slug": "pune",
        "name": "CineVerse Hinjawadi IT Screen",
        "slug": "cineverse-hinjawadi-it-screen",
        "address": "Hinjawadi Phase 1, High Street, Pune 411057",
        "latitude": 18.5913, "longitude": 73.7389,
        "facilities": ["Large Format", "Dolby 7.1", "Wheelchair Access", "Parking"],
        "is_flagship": False,
        "has_3d_hall": False
    },
    {
        "city_slug": "pune",
        "name": "CineVerse Wakad Metropolis",
        "slug": "cineverse-wakad-metropolis",
        "address": "Datta Mandir Road, Wakad, Pune 411057",
        "latitude": 18.5987, "longitude": 73.7680,
        "facilities": ["Dolby Atmos", "Recliners", "Food Court", "Parking"],
        "is_flagship": False,
        "has_3d_hall": False
    },

    # Kolkata (5 cinemas)
    {
        "city_slug": "kolkata",
        "name": "CineVerse Park Street Victoria Hall",
        "slug": "cineverse-park-street-victoria-hall",
        "address": "Park Street, Near Camac Street, Kolkata, West Bengal 700016",
        "latitude": 22.5510, "longitude": 88.3524,
        "facilities": ["IMAX with Laser", "Flagship Big Hall", "Dolby Atmos", "Colonial Heritage Lounge", "Valet"],
        "is_flagship": True,
        "has_3d_hall": False
    },
    {
        "city_slug": "kolkata",
        "name": "CineVerse South City Silver Screen",
        "slug": "cineverse-south-city-silver-screen",
        "address": "South City Mall, 375 Prince Anwar Shah Road, Kolkata 700068",
        "latitude": 22.5005, "longitude": 88.3619,
        "facilities": ["Dolby Atmos 4DX", "RGB Laser", "Recliner Gold", "Food Court"],
        "is_flagship": False,
        "has_3d_hall": False
    },
    {
        "city_slug": "kolkata",
        "name": "CineVerse Salt Lake CineSpire",
        "slug": "cineverse-salt-lake-cinespire",
        "address": "City Centre 1, DC Block, Sector 1, Bidhannagar, Kolkata 700064",
        "latitude": 22.5894, "longitude": 88.4081,
        "facilities": ["Large Format", "Dolby Atmos", "Wheelchair Access", "Parking"],
        "is_flagship": False,
        "has_3d_hall": False
    },
    {
        "city_slug": "kolkata",
        "name": "CineVerse New Town CyberPlex",
        "slug": "cineverse-new-town-cyberplex",
        "address": "Major Arterial Road, Action Area 1, New Town, Kolkata 700156",
        "latitude": 22.5855, "longitude": 88.4619,
        "facilities": ["Laser 4K", "Dolby 7.1", "Tech Cafe", "Parking"],
        "is_flagship": False,
        "has_3d_hall": False
    },
    {
        "city_slug": "kolkata",
        "name": "CineVerse Ballygunge Classic",
        "slug": "cineverse-ballygunge-classic",
        "address": "Gariahat Road, Ballygunge, Kolkata 700019",
        "latitude": 22.5280, "longitude": 88.3650,
        "facilities": ["Boutique Screen", "Dolby Atmos", "Artisan Sweets Bar", "Valet"],
        "is_flagship": False,
        "has_3d_hall": False
    },
]

# 50 Rich Invented Movies across 9 languages
MOVIES_DATA = [
    # 1-8 National Releases (Shared across all 7 cities)
    {
        "title": "Quantum Odyssey: Beyond the Singularity",
        "slug": "quantum-odyssey",
        "synopsis": "When an uncharted gravitational anomaly threatens Earth's orbital stability, a rogue astrophysicist and a quantum AI embark on an irreversible trans-dimensional voyage to unravel the fabric of spacetime.",
        "poster_url": "/posters/quantum-odyssey.webp",
        "banner_url": "/backdrops/quantum-odyssey.webp",
        "trailer_url": "/trailers/quantum-odyssey.mp4",
        "duration_minutes": 168, "certificate": "UA",
        "release_date": date.today() - timedelta(days=6),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 9.2, "rating_count": 5120, "interested_count": 21000,
        "languages": ["English", "Hindi", "Kannada", "Tamil", "Telugu"],
        "genres": ["Sci-Fi", "Adventure", "Thriller"],
        "formats": ["IMAX 3D", "4DX", "Dolby Atmos 2D", "2D"],
        "is_national": True
    },
    {
        "title": "Astra: Chronicles of the Celestial Throne",
        "slug": "astra-celestial-throne",
        "synopsis": "In an ancient subcontinent powered by celestial crystals, five rival kingdoms wage dynastic war until an exiled warrior discovers the cosmic origin of their mystic energies.",
        "poster_url": "/posters/astra-celestial-throne.webp",
        "banner_url": "/backdrops/astra-celestial-throne.webp",
        "trailer_url": "/trailers/astra-celestial-throne.mp4",
        "duration_minutes": 175, "certificate": "UA",
        "release_date": date.today() - timedelta(days=4),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 8.9, "rating_count": 4200, "interested_count": 18500,
        "languages": ["Hindi", "Telugu", "Tamil", "Kannada", "Malayalam"],
        "genres": ["Action", "Fantasy", "Epic"],
        "formats": ["IMAX 3D", "Dolby Atmos 2D", "2D"],
        "is_national": True
    },
    {
        "title": "Shadow Protocol: Bangalore Drift",
        "slug": "shadow-protocol",
        "synopsis": "An undercover cyber operative in Bengaluru's tech corridor uncovers an international surveillance cartel manipulating sovereign infrastructure from the shadows.",
        "poster_url": "/posters/shadow-protocol.webp",
        "banner_url": "/backdrops/shadow-protocol.webp",
        "trailer_url": "/trailers/shadow-protocol.mp4",
        "duration_minutes": 145, "certificate": "UA",
        "release_date": date.today() - timedelta(days=2),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 8.7, "rating_count": 3100, "interested_count": 14200,
        "languages": ["English", "Hindi", "Kannada"],
        "genres": ["Action", "Thriller", "Cyberpunk"],
        "formats": ["IMAX 3D", "4DX", "Dolby Atmos 2D"],
        "is_national": True
    },
    {
        "title": "Vajra: The Thunderborn",
        "slug": "vajra-thunderborn",
        "synopsis": "A secluded Himalayan mountain monastery guards an ancient relic forged from lightning that bestows elemental power onto its destined guardian during the Kali Yuga eclipse.",
        "poster_url": "/posters/vajra-thunderborn.webp",
        "banner_url": "/backdrops/vajra-thunderborn.webp",
        "trailer_url": "/trailers/vajra-thunderborn.mp4",
        "duration_minutes": 162, "certificate": "UA",
        "release_date": date.today() - timedelta(days=3),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 9.0, "rating_count": 3800, "interested_count": 16700,
        "languages": ["Telugu", "Hindi", "Tamil", "Kannada"],
        "genres": ["Action", "Mythology", "Fantasy"],
        "formats": ["IMAX 3D", "Dolby Atmos 2D", "2D"],
        "is_national": True
    },
    {
        "title": "Redline Vendetta: Velocity Zero",
        "slug": "redline-vendetta",
        "synopsis": "On the rain-slicked expressways of western India, an outlaw precision driver seeks retribution against an organized syndicate that framed his racing team.",
        "poster_url": "/posters/redline-vendetta.webp",
        "banner_url": "/backdrops/redline-vendetta.webp",
        "trailer_url": "/trailers/redline-vendetta.mp4",
        "duration_minutes": 138, "certificate": "A",
        "release_date": date.today() - timedelta(days=5),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 8.5, "rating_count": 2750, "interested_count": 12100,
        "languages": ["Hindi", "English"],
        "genres": ["Action", "Crime", "Thriller"],
        "formats": ["4DX", "Dolby Atmos 2D", "2D"],
        "is_national": True
    },
    {
        "title": "Little Hanuman & The Sun Chaser",
        "slug": "little-hanuman",
        "synopsis": "A delightfully spirited animated adventure chronicling young Hanuman's legendary childhood quest to leap across galaxies and taste the glowing cosmic sun.",
        "poster_url": "/posters/little-hanuman.webp",
        "banner_url": "/backdrops/little-hanuman.webp",
        "trailer_url": "/trailers/little-hanuman.mp4",
        "duration_minutes": 105, "certificate": "U",
        "release_date": date.today() - timedelta(days=1),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 9.1, "rating_count": 4100, "interested_count": 19400,
        "languages": ["Hindi", "English", "Tamil", "Telugu"],
        "genres": ["Animation", "Adventure", "Family"],
        "formats": ["3D", "2D", "Dolby Atmos 2D"],
        "is_national": True
    },
    {
        "title": "Chronos Paradox: Echoes of Tomorrow",
        "slug": "chronos-paradox",
        "synopsis": "An elite team of chrononauts discovers that every alteration to the historical timeline creates parallel reality fractures that are beginning to converge on modern Mumbai.",
        "poster_url": "/posters/chronos-paradox.webp",
        "banner_url": "/backdrops/chronos-paradox.webp",
        "trailer_url": "/trailers/chronos-paradox.mp4",
        "duration_minutes": 140, "certificate": "UA",
        "release_date": date.today() - timedelta(days=4),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 8.6, "rating_count": 2980, "interested_count": 13400,
        "languages": ["English", "Hindi"],
        "genres": ["Sci-Fi", "Mystery"],
        "formats": ["IMAX 3D", "Dolby Atmos 2D"],
        "is_national": True
    },
    {
        "title": "Zero Gravity Protocol",
        "slug": "zero-gravity-protocol",
        "synopsis": "When a catastrophic solar storm disables Earth's geostationary defense ring, a solo orbital technician must make an untethered spacewalk to save five hundred astronauts.",
        "poster_url": "/posters/zero-gravity-protocol.webp",
        "banner_url": "/backdrops/zero-gravity-protocol.webp",
        "trailer_url": "/trailers/zero-gravity-protocol.mp4",
        "duration_minutes": 146, "certificate": "UA",
        "release_date": date.today() - timedelta(days=3),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 8.8, "rating_count": 3400, "interested_count": 15800,
        "languages": ["English", "Hindi", "Telugu"],
        "genres": ["Sci-Fi", "Action", "Drama"],
        "formats": ["IMAX 3D", "4DX", "2D"],
        "is_national": True
    },

    # 9-13 Kannada Regional & Coorg / Western Ghats
    {
        "title": "Garuda: Sky Guardian of Vijayanagara",
        "slug": "garuda-sky-guardian",
        "synopsis": "Set in the opulent 16th century Vijayanagara empire, an elite royal falconer discovers an internal betrayal threatening the sovereign jewel vault of Hampi.",
        "poster_url": "/posters/garuda-sky-guardian.webp",
        "banner_url": "/backdrops/garuda-sky-guardian.webp",
        "trailer_url": "/trailers/garuda-sky-guardian.mp4",
        "duration_minutes": 154, "certificate": "UA",
        "release_date": date.today() - timedelta(days=5),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 9.1, "rating_count": 3200, "interested_count": 14000,
        "languages": ["Kannada", "Hindi"],
        "genres": ["Action", "History", "Adventure"],
        "formats": ["Dolby Atmos 2D", "2D"],
        "is_national": False
    },
    {
        "title": "Cauvery Breeze: A Coorg Melody",
        "slug": "cauvery-breeze",
        "synopsis": "A heartwarming multigenerational love story blossoming amidst misty coffee estates and lush monsoon rains along the winding banks of the Cauvery river.",
        "poster_url": "/posters/cauvery-breeze.webp",
        "banner_url": "/backdrops/cauvery-breeze.webp",
        "trailer_url": "/trailers/cauvery-breeze.mp4",
        "duration_minutes": 132, "certificate": "U",
        "release_date": date.today() - timedelta(days=2),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 8.9, "rating_count": 2100, "interested_count": 9800,
        "languages": ["Kannada"],
        "genres": ["Drama", "Romance", "Musical"],
        "formats": ["Dolby Atmos 2D", "2D"],
        "is_national": False
    },
    {
        "title": "Bangalore Startups & Samosas",
        "slug": "bangalore-startups-samosas",
        "synopsis": "Three quirky software engineers in Koramangala accidentally build a viral food delivery algorithm that pits them against ruthless Silicon Valley venture capitalists.",
        "poster_url": "/posters/bangalore-startups-samosas.webp",
        "banner_url": "/backdrops/bangalore-startups-samosas.webp",
        "trailer_url": "/trailers/bangalore-startups-samosas.mp4",
        "duration_minutes": 124, "certificate": "U",
        "release_date": date.today() - timedelta(days=1),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 8.7, "rating_count": 2890, "interested_count": 11500,
        "languages": ["Kannada", "English"],
        "genres": ["Comedy", "Drama"],
        "formats": ["2D", "Dolby Atmos 2D"],
        "is_national": False
    },
    {
        "title": "The Forest Phantom: Whispers of Malnad",
        "slug": "the-forest-phantom",
        "synopsis": "Deep within the dense rainforests of Agumbe, an ecological research team stumbles onto an ancient folklore entity protecting the sacred medicinal flora.",
        "poster_url": "/posters/the-forest-phantom.webp",
        "banner_url": "/backdrops/the-forest-phantom.webp",
        "trailer_url": "/trailers/the-forest-phantom.mp4",
        "duration_minutes": 135, "certificate": "A",
        "release_date": date.today() - timedelta(days=4),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 8.6, "rating_count": 1850, "interested_count": 8900,
        "languages": ["Kannada", "Tamil"],
        "genres": ["Horror", "Mystery", "Thriller"],
        "formats": ["Dolby Atmos 2D", "2D"],
        "is_national": False
    },
    {
        "title": "Kolar Gold Shadows",
        "slug": "kolar-gold-shadows",
        "synopsis": "A gripping historical crime drama documenting the courageous mine workers of KGF who challenged colonial syndicates in the early 20th century.",
        "poster_url": "/posters/kolar-gold-shadows.webp",
        "banner_url": "/backdrops/kolar-gold-shadows.webp",
        "trailer_url": "/trailers/kolar-gold-shadows.mp4",
        "duration_minutes": 148, "certificate": "UA",
        "release_date": date.today() - timedelta(days=3),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 8.8, "rating_count": 2740, "interested_count": 12800,
        "languages": ["Kannada", "Telugu"],
        "genres": ["Crime", "Drama", "History"],
        "formats": ["Dolby Atmos 2D", "2D"],
        "is_national": False
    },

    # 14-18 Marathi Regional & Deccan Heritage
    {
        "title": "Maharudra: The Fortress of Valor",
        "slug": "maharudra-rising",
        "synopsis": "An epic saga celebrating the tactical genius and unwavering spirit of the Maratha hill fortress defenders during the monsoon battles of the Sahyadri mountains.",
        "poster_url": "/posters/maharudra-rising.webp",
        "banner_url": "/backdrops/maharudra-rising.webp",
        "trailer_url": "/trailers/maharudra-rising.mp4",
        "duration_minutes": 160, "certificate": "UA",
        "release_date": date.today() - timedelta(days=4),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 9.2, "rating_count": 3600, "interested_count": 16200,
        "languages": ["Marathi", "Hindi"],
        "genres": ["Action", "History", "War"],
        "formats": ["Dolby Atmos 2D", "2D"],
        "is_national": False
    },
    {
        "title": "Pune Heritage: Streets of Deccan Gymkhana",
        "slug": "pune-heritage-tales",
        "synopsis": "A nostalgic and witty family drama capturing the evolving culture of old Pune wadas juxtaposed against the city's modern educational and IT renaissance.",
        "poster_url": "/posters/pune-heritage-tales.webp",
        "banner_url": "/backdrops/pune-heritage-tales.webp",
        "trailer_url": "/trailers/pune-heritage-tales.mp4",
        "duration_minutes": 128, "certificate": "U",
        "release_date": date.today() - timedelta(days=2),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 8.9, "rating_count": 2400, "interested_count": 10500,
        "languages": ["Marathi"],
        "genres": ["Drama", "Family", "Comedy"],
        "formats": ["2D"],
        "is_national": False
    },
    {
        "title": "The Last Testimony of Fort Court",
        "slug": "the-last-testimony",
        "synopsis": "A high-stakes courtroom thriller in South Mumbai where a determined legal aid defense attorney unravels a 30-year-old high-society corporate conspiracy.",
        "poster_url": "/posters/the-last-testimony.webp",
        "banner_url": "/backdrops/the-last-testimony.webp",
        "trailer_url": "/trailers/the-last-testimony.mp4",
        "duration_minutes": 142, "certificate": "UA",
        "release_date": date.today() - timedelta(days=5),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 8.8, "rating_count": 2150, "interested_count": 9600,
        "languages": ["Marathi", "Hindi"],
        "genres": ["Crime", "Courtroom", "Drama"],
        "formats": ["2D", "Dolby Atmos 2D"],
        "is_national": False
    },
    {
        "title": "Midnight at Sinhagad",
        "slug": "ghat-crematorium",
        "synopsis": "A suspenseful psychological horror tale of five adventurous college students who spend a rainy night trapped atop the misty Sinhagad plateau.",
        "poster_url": "/posters/ghat-crematorium.webp",
        "banner_url": "/backdrops/ghat-crematorium.webp",
        "trailer_url": "/trailers/ghat-crematorium.mp4",
        "duration_minutes": 118, "certificate": "A",
        "release_date": date.today() - timedelta(days=3),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 8.4, "rating_count": 1600, "interested_count": 7800,
        "languages": ["Marathi"],
        "genres": ["Horror", "Thriller"],
        "formats": ["2D"],
        "is_national": False
    },
    {
        "title": "Fast Local: 08:42 from Dadar",
        "slug": "mumbai-local-chronicles",
        "synopsis": "An extraordinary tapestry of everyday Mumbai life, connecting seven distinct commuters whose destinies intersect aboard the iconic Western Railway fast local.",
        "poster_url": "/posters/mumbai-local-chronicles.webp",
        "banner_url": "/backdrops/mumbai-local-chronicles.webp",
        "trailer_url": "/trailers/mumbai-local-chronicles.mp4",
        "duration_minutes": 115, "certificate": "U",
        "release_date": date.today() - timedelta(days=1),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 9.0, "rating_count": 3100, "interested_count": 13900,
        "languages": ["Marathi", "Hindi"],
        "genres": ["Drama", "Slice of Life"],
        "formats": ["2D", "Dolby Atmos 2D"],
        "is_national": False
    },

    # 19-23 Telugu Regional & Nizam / Rayalaseema
    {
        "title": "Simhadri Roar: The Rayalaseema Legend",
        "slug": "simhadri-roar",
        "synopsis": "An adrenaline-fueled mass action drama chronicling a fearless community protector fighting against illegal water mafias in drought-prone Andhra country.",
        "poster_url": "/posters/simhadri-roar.webp",
        "banner_url": "/backdrops/simhadri-roar.webp",
        "trailer_url": "/trailers/simhadri-roar.mp4",
        "duration_minutes": 165, "certificate": "UA",
        "release_date": date.today() - timedelta(days=5),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 9.1, "rating_count": 4500, "interested_count": 19800,
        "languages": ["Telugu", "Hindi"],
        "genres": ["Action", "Drama"],
        "formats": ["Dolby Atmos 2D", "2D", "4DX"],
        "is_national": False
    },
    {
        "title": "Deccan Underworld: King of Dhoolpet",
        "slug": "deccan-underworld",
        "synopsis": "A gritty, stylized crime saga charting the meteoric rise and moral descent of an ambitious street enforcer in the narrow alleyways of old Hyderabad.",
        "poster_url": "/posters/deccan-underworld.webp",
        "banner_url": "/backdrops/deccan-underworld.webp",
        "trailer_url": "/trailers/deccan-underworld.mp4",
        "duration_minutes": 150, "certificate": "A",
        "release_date": date.today() - timedelta(days=3),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 8.7, "rating_count": 3100, "interested_count": 13400,
        "languages": ["Telugu"],
        "genres": ["Crime", "Thriller", "Action"],
        "formats": ["Dolby Atmos 2D", "2D"],
        "is_national": False
    },
    {
        "title": "Charminar Chords: Old City Symphony",
        "slug": "charminar-chords",
        "synopsis": "A soulful musical romance bridging classical Carnatic violin and traditional Hyderabadi Qawwali music under the historic shadows of Charminar.",
        "poster_url": "/posters/charminar-chords.webp",
        "banner_url": "/backdrops/charminar-chords.webp",
        "trailer_url": "/trailers/charminar-chords.mp4",
        "duration_minutes": 139, "certificate": "U",
        "release_date": date.today() - timedelta(days=2),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 9.0, "rating_count": 2700, "interested_count": 11800,
        "languages": ["Telugu", "Hindi"],
        "genres": ["Musical", "Romance", "Drama"],
        "formats": ["Dolby Atmos 2D", "2D"],
        "is_national": False
    },
    {
        "title": "Babu's Big Idea: Nizam Comedy",
        "slug": "babus-big-idea",
        "synopsis": "A laugh-out-loud comedy about an overly ambitious Hyderabadi real estate broker who accidentally sells the same historic haveli to three rival wedding parties.",
        "poster_url": "/posters/babus-big-idea.webp",
        "banner_url": "/backdrops/babus-big-idea.webp",
        "trailer_url": "/trailers/babus-big-idea.mp4",
        "duration_minutes": 126, "certificate": "U",
        "release_date": date.today() - timedelta(days=1),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 8.6, "rating_count": 2900, "interested_count": 12000,
        "languages": ["Telugu"],
        "genres": ["Comedy"],
        "formats": ["2D"],
        "is_national": False
    },
    {
        "title": "Godavari Monsoon Diary",
        "slug": "godavari-monsoon-diary",
        "synopsis": "A scenic lyrical journey down the Godavari river during torrential monsoons, exploring family traditions and long-cherished cultural reunions.",
        "poster_url": "/posters/godavari-monsoon-diary.webp",
        "banner_url": "/backdrops/godavari-monsoon-diary.webp",
        "trailer_url": "/trailers/godavari-monsoon-diary.mp4",
        "duration_minutes": 134, "certificate": "U",
        "release_date": date.today() - timedelta(days=4),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 8.8, "rating_count": 2100, "interested_count": 9400,
        "languages": ["Telugu"],
        "genres": ["Drama", "Family"],
        "formats": ["2D", "Dolby Atmos 2D"],
        "is_national": False
    },

    # 24-28 Tamil Regional & Coastal Carnatic
    {
        "title": "Madras Syndicate: North Chennai War",
        "slug": "madras-syndicate",
        "synopsis": "An intense, realistic gangster saga set against the harbor docks and boxing clubs of North Chennai, spanning three decades of fierce neighborhood loyalty.",
        "poster_url": "/posters/madras-syndicate.webp",
        "banner_url": "/backdrops/madras-syndicate.webp",
        "trailer_url": "/trailers/madras-syndicate.mp4",
        "duration_minutes": 152, "certificate": "A",
        "release_date": date.today() - timedelta(days=6),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 9.1, "rating_count": 4200, "interested_count": 18200,
        "languages": ["Tamil"],
        "genres": ["Action", "Crime", "Drama"],
        "formats": ["Dolby Atmos 2D", "2D", "4DX"],
        "is_national": False
    },
    {
        "title": "Marina Breeze: A Chennai Love Story",
        "slug": "chennai-monsoons",
        "synopsis": "A tender coming-of-age romance between a passionate street photographer and an aspiring Carnatic vocalist meeting daily along the Marina Beach shoreline.",
        "poster_url": "/posters/chennai-monsoons.webp",
        "banner_url": "/backdrops/chennai-monsoons.webp",
        "trailer_url": "/trailers/chennai-monsoons.mp4",
        "duration_minutes": 128, "certificate": "U",
        "release_date": date.today() - timedelta(days=2),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 8.9, "rating_count": 2900, "interested_count": 12900,
        "languages": ["Tamil"],
        "genres": ["Romance", "Drama"],
        "formats": ["2D", "Dolby Atmos 2D"],
        "is_national": False
    },
    {
        "title": "Dosa & Filter Coffee: Triplicane Diaries",
        "slug": "dosa-filter-coffee",
        "synopsis": "A joyous culinary comedy revolving around a hundred-year-old vegetarian mess in Triplicane facing off against a modern fusion food truck chain.",
        "poster_url": "/posters/dosa-filter-coffee.webp",
        "banner_url": "/backdrops/dosa-filter-coffee.webp",
        "trailer_url": "/trailers/dosa-filter-coffee.mp4",
        "duration_minutes": 120, "certificate": "U",
        "release_date": date.today() - timedelta(days=3),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 8.7, "rating_count": 2300, "interested_count": 10400,
        "languages": ["Tamil", "English"],
        "genres": ["Comedy", "Romance"],
        "formats": ["2D"],
        "is_national": False
    },
    {
        "title": "Chola Secrets: The Buried Temple",
        "slug": "chola-secrets",
        "synopsis": "An archaeological expedition in the Cauvery delta unearths a forgotten subterranean Chola shrine containing coded bronze inscriptions and hidden water traps.",
        "poster_url": "/posters/chola-secrets.webp",
        "banner_url": "/backdrops/chola-secrets.webp",
        "trailer_url": "/trailers/chola-secrets.mp4",
        "duration_minutes": 155, "certificate": "UA",
        "release_date": date.today() - timedelta(days=5),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 9.0, "rating_count": 3700, "interested_count": 15900,
        "languages": ["Tamil", "Telugu"],
        "genres": ["Mystery", "Adventure", "History"],
        "formats": ["Dolby Atmos 2D", "2D"],
        "is_national": False
    },
    {
        "title": "Echoes of Malabar Coast",
        "slug": "echoes-of-malabar",
        "synopsis": "An investigative maritime mystery following a customs officer unravelling an illicit spice and gold smuggling network operating along historical Arabian sea trade routes.",
        "poster_url": "/posters/echoes-of-malabar.webp",
        "banner_url": "/backdrops/echoes-of-malabar.webp",
        "trailer_url": "/trailers/echoes-of-malabar.mp4",
        "duration_minutes": 130, "certificate": "UA",
        "release_date": date.today() - timedelta(days=4),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 8.6, "rating_count": 1900, "interested_count": 8600,
        "languages": ["Tamil", "Malayalam"],
        "genres": ["Thriller", "Mystery"],
        "formats": ["2D"],
        "is_national": False
    },

    # 29-33 Bengali Regional & Kolkata Literary Culture
    {
        "title": "Bengal Tiger: Mystery of Sunderbans",
        "slug": "bengal-tiger-detective",
        "synopsis": "A cerebral detective and a forest conservator navigate the mangrove estuaries of the Sundarbans to solve an enigmatic case of vanishing wildlife researchers.",
        "poster_url": "/posters/bengal-tiger-detective.webp",
        "banner_url": "/backdrops/bengal-tiger-detective.webp",
        "trailer_url": "/trailers/bengal-tiger-detective.mp4",
        "duration_minutes": 140, "certificate": "UA",
        "release_date": date.today() - timedelta(days=5),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 9.1, "rating_count": 3400, "interested_count": 14700,
        "languages": ["Bengali", "Hindi"],
        "genres": ["Mystery", "Detective", "Thriller"],
        "formats": ["Dolby Atmos 2D", "2D"],
        "is_national": False
    },
    {
        "title": "Howrah Bridge Sunset: A College Street Romance",
        "slug": "howrah-bridge-sunset",
        "synopsis": "An intellectual, poetic romantic drama revolving around an antiquarian bookstore apprentice and an aspiring journalist discovering Tagore's lost manuscripts.",
        "poster_url": "/posters/howrah-bridge-sunset.webp",
        "banner_url": "/backdrops/howrah-bridge-sunset.webp",
        "trailer_url": "/trailers/howrah-bridge-sunset.mp4",
        "duration_minutes": 130, "certificate": "U",
        "release_date": date.today() - timedelta(days=3),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 8.9, "rating_count": 2600, "interested_count": 11200,
        "languages": ["Bengali"],
        "genres": ["Drama", "Romance"],
        "formats": ["2D", "Dolby Atmos 2D"],
        "is_national": False
    },
    {
        "title": "Mohun Bagan vs East Bengal: Football Fever",
        "slug": "fish-curry-football",
        "synopsis": "A passionate, humorous sports rivalry comedy depicting two neighboring Kolkata families whose generations-old bond is tested during the Kolkata Derby football final.",
        "poster_url": "/posters/fish-curry-football.webp",
        "banner_url": "/backdrops/fish-curry-football.webp",
        "trailer_url": "/trailers/fish-curry-football.mp4",
        "duration_minutes": 125, "certificate": "U",
        "release_date": date.today() - timedelta(days=2),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 8.8, "rating_count": 3100, "interested_count": 13800,
        "languages": ["Bengali"],
        "genres": ["Comedy", "Sports"],
        "formats": ["2D"],
        "is_national": False
    },
    {
        "title": "The Magic Quill: Rabindra Fantasy",
        "slug": "the-magic-quill",
        "synopsis": "A magical fantasy adventure for all ages where an imaginative schoolgirl in Shantiniketan discovers an enchanted ink quill that brings Bengali fairy tales to life.",
        "poster_url": "/posters/the-magic-quill.webp",
        "banner_url": "/backdrops/the-magic-quill.webp",
        "trailer_url": "/trailers/the-magic-quill.mp4",
        "duration_minutes": 118, "certificate": "U",
        "release_date": date.today() - timedelta(days=4),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 8.7, "rating_count": 2200, "interested_count": 9900,
        "languages": ["Bengali", "English"],
        "genres": ["Fantasy", "Family"],
        "formats": ["2D", "3D"],
        "is_national": False
    },
    {
        "title": "Whispering Fog of Darjeeling",
        "slug": "whispering-fog-darjeeling",
        "synopsis": "A gothic atmospheric mystery set inside a tea planter's heritage estate high in the mist-veiled hills of Darjeeling as monsoon storms roll over Kanchenjunga.",
        "poster_url": "/posters/whispering-fog-darjeeling.webp",
        "banner_url": "/backdrops/whispering-fog-darjeeling.webp",
        "trailer_url": "/trailers/whispering-fog-darjeeling.mp4",
        "duration_minutes": 122, "certificate": "A",
        "release_date": date.today() - timedelta(days=1),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 8.5, "rating_count": 1750, "interested_count": 8100,
        "languages": ["Bengali", "English"],
        "genres": ["Horror", "Gothic Mystery"],
        "formats": ["2D"],
        "is_national": False
    },

    # 34-38 Punjabi Regional & Delhi NCR Culture
    {
        "title": "Punjab Express: Border Patrol",
        "slug": "punjab-express-action",
        "synopsis": "A patriotic high-octane military action drama focusing on a brave Border Security Force outpost maintaining vigil against infiltrators across the plains of Punjab.",
        "poster_url": "/posters/punjab-express-action.webp",
        "banner_url": "/backdrops/punjab-express-action.webp",
        "trailer_url": "/trailers/punjab-express-action.mp4",
        "duration_minutes": 145, "certificate": "UA",
        "release_date": date.today() - timedelta(days=6),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 9.0, "rating_count": 3900, "interested_count": 16900,
        "languages": ["Punjabi", "Hindi"],
        "genres": ["Action", "Military", "Drama"],
        "formats": ["Dolby Atmos 2D", "2D", "4DX"],
        "is_national": False
    },
    {
        "title": "Fields of Gold: A Malwa Harvest",
        "slug": "fields-of-gold-malwa",
        "synopsis": "An emotionally resonant agrarian family saga showcasing the resilience, music, and indomitable courage of three generations of Punjab farming families.",
        "poster_url": "/posters/fields-of-gold-malwa.webp",
        "banner_url": "/backdrops/fields-of-gold-malwa.webp",
        "trailer_url": "/trailers/fields-of-gold-malwa.mp4",
        "duration_minutes": 150, "certificate": "U",
        "release_date": date.today() - timedelta(days=3),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 9.1, "rating_count": 2800, "interested_count": 12500,
        "languages": ["Punjabi"],
        "genres": ["Drama", "Family"],
        "formats": ["2D", "Dolby Atmos 2D"],
        "is_national": False
    },
    {
        "title": "Jatt in London: Desi Chaos",
        "slug": "jatt-in-london-laugh",
        "synopsis": "A riotous cross-cultural comedy of errors following a spirited village youth from Ludhiana attempting to rescue his uncle's traditional restaurant in Central London.",
        "poster_url": "/posters/jatt-in-london-laugh.webp",
        "banner_url": "/backdrops/jatt-in-london-laugh.webp",
        "trailer_url": "/trailers/jatt-in-london-laugh.mp4",
        "duration_minutes": 132, "certificate": "U",
        "release_date": date.today() - timedelta(days=2),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 8.8, "rating_count": 3500, "interested_count": 15200,
        "languages": ["Punjabi", "English"],
        "genres": ["Comedy"],
        "formats": ["2D"],
        "is_national": False
    },
    {
        "title": "Bullet Yaari: Campus Swagger",
        "slug": "bullet-yaari-clash",
        "synopsis": "An energetic youth drama about loyalty, friendship, and college politics among university students riding Royal Enfields through Punjab's historic university towns.",
        "poster_url": "/posters/bullet-yaari-clash.webp",
        "banner_url": "/backdrops/bullet-yaari-clash.webp",
        "trailer_url": "/trailers/bullet-yaari-clash.mp4",
        "duration_minutes": 136, "certificate": "UA",
        "release_date": date.today() - timedelta(days=4),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 8.6, "rating_count": 2100, "interested_count": 9500,
        "languages": ["Punjabi"],
        "genres": ["Action", "Youth", "Drama"],
        "formats": ["2D"],
        "is_national": False
    },
    {
        "title": "Sector 17: Chandigarh Nights",
        "slug": "chandigarh-nights",
        "synopsis": "A stylish, fast-paced urban romantic comedy exploring contemporary ambitions and relationships across the modern architecture and broad avenues of Chandigarh.",
        "poster_url": "/posters/chandigarh-nights.webp",
        "banner_url": "/backdrops/chandigarh-nights.webp",
        "trailer_url": "/trailers/chandigarh-nights.mp4",
        "duration_minutes": 126, "certificate": "U",
        "release_date": date.today() - timedelta(days=1),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 8.7, "rating_count": 2400, "interested_count": 10800,
        "languages": ["Punjabi", "Hindi"],
        "genres": ["Romance", "Comedy"],
        "formats": ["2D"],
        "is_national": False
    },

    # 39-41 Malayalam Regional & Coastal Kerala
    {
        "title": "Wayanad Rain: Echo of the Western Ghats",
        "slug": "wayanad-rain-shadow",
        "synopsis": "An ecologically driven mystery drama unfolding amidst cardamom hills and tribal sanctuaries when an environmental officer confronts an illegal timber conglomerate.",
        "poster_url": "/posters/wayanad-rain-shadow.webp",
        "banner_url": "/backdrops/wayanad-rain-shadow.webp",
        "trailer_url": "/trailers/wayanad-rain-shadow.mp4",
        "duration_minutes": 138, "certificate": "UA",
        "release_date": date.today() - timedelta(days=4),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 9.2, "rating_count": 3100, "interested_count": 14100,
        "languages": ["Malayalam", "Tamil"],
        "genres": ["Drama", "Ecological Thriller"],
        "formats": ["Dolby Atmos 2D", "2D"],
        "is_national": False
    },
    {
        "title": "Midnight Express to Kozhikode",
        "slug": "midnight-train-kozhikode",
        "synopsis": "A taut, single-night suspense thriller set entirely aboard an express train travelling south through stormy Kerala backwaters carrying a precious covert cargo.",
        "poster_url": "/posters/midnight-train-kozhikode.webp",
        "banner_url": "/backdrops/midnight-train-kozhikode.webp",
        "trailer_url": "/trailers/midnight-train-kozhikode.mp4",
        "duration_minutes": 120, "certificate": "UA",
        "release_date": date.today() - timedelta(days=2),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 8.9, "rating_count": 2600, "interested_count": 11700,
        "languages": ["Malayalam"],
        "genres": ["Suspense", "Thriller"],
        "formats": ["2D"],
        "is_national": False
    },
    {
        "title": "Kochi Harbor Noir",
        "slug": "kochi-harbor-noir",
        "synopsis": "A rain-drenched neo-noir crime thriller set among shipping containers and colonial Chinese fishing nets as an unyielding detective unravels a maritime syndicate.",
        "poster_url": "/posters/kochi-harbor-noir.webp",
        "banner_url": "/backdrops/kochi-harbor-noir.webp",
        "trailer_url": "/trailers/kochi-harbor-noir.mp4",
        "duration_minutes": 144, "certificate": "A",
        "release_date": date.today() - timedelta(days=5),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 8.8, "rating_count": 2300, "interested_count": 10500,
        "languages": ["Malayalam"],
        "genres": ["Crime", "Neo-noir"],
        "formats": ["2D", "Dolby Atmos 2D"],
        "is_national": False
    },

    # 42-46 Hindi Mainstream & Heartland Crossover
    {
        "title": "Gully Hustle: Beat of Mumbai",
        "slug": "gully-hustle-dharavi",
        "synopsis": "A dynamic musical hip-hop drama celebrating the underground beatmakers and rap cyphers rising out of the resilient communities of Dharavi.",
        "poster_url": "/posters/gully-hustle-dharavi.webp",
        "banner_url": "/backdrops/gully-hustle-dharavi.webp",
        "trailer_url": "/trailers/gully-hustle-dharavi.mp4",
        "duration_minutes": 135, "certificate": "UA",
        "release_date": date.today() - timedelta(days=3),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 8.7, "rating_count": 3400, "interested_count": 15000,
        "languages": ["Hindi"],
        "genres": ["Musical", "Drama"],
        "formats": ["Dolby Atmos 2D", "2D"],
        "is_national": False
    },
    {
        "title": "Haveli of Haunting: Rajasthan Ghost Story",
        "slug": "haveli-of-haunting",
        "synopsis": "A lavish supernatural period horror tale tracking an antique restorer who unlocks a sealed inner sanctum within an abandoned desert palace in Shekhawati.",
        "poster_url": "/posters/haveli-of-haunting.webp",
        "banner_url": "/backdrops/haveli-of-haunting.webp",
        "trailer_url": "/trailers/haveli-of-haunting.mp4",
        "duration_minutes": 125, "certificate": "A",
        "release_date": date.today() - timedelta(days=4),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 8.5, "rating_count": 2700, "interested_count": 12200,
        "languages": ["Hindi"],
        "genres": ["Horror", "Supernatural"],
        "formats": ["2D", "3D"],
        "is_national": False
    },
    {
        "title": "Mirage in Thar: Operation Falcon",
        "slug": "mirage-in-thar",
        "synopsis": "An intense espionage thriller following an undercover deep-recon unit tracking cross-border drone operators along the vast Thar desert sand dunes.",
        "poster_url": "/posters/mirage-in-thar.webp",
        "banner_url": "/backdrops/mirage-in-thar.webp",
        "trailer_url": "/trailers/mirage-in-thar.mp4",
        "duration_minutes": 140, "certificate": "UA",
        "release_date": date.today() - timedelta(days=5),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 8.8, "rating_count": 3200, "interested_count": 14500,
        "languages": ["Hindi", "English"],
        "genres": ["Spy", "Thriller", "Military"],
        "formats": ["Dolby Atmos 2D", "2D"],
        "is_national": False
    },
    {
        "title": "Big Fat Chandni Chowk Wedding",
        "slug": "delhi-6-weddings",
        "synopsis": "A joyous high-energy romantic comedy depicting chaotic wedding rivalries, delicious street food wars, and heartwarming reunions across old Delhi.",
        "poster_url": "/posters/delhi-6-weddings.webp",
        "banner_url": "/backdrops/delhi-6-weddings.webp",
        "trailer_url": "/trailers/delhi-6-weddings.mp4",
        "duration_minutes": 130, "certificate": "U",
        "release_date": date.today() - timedelta(days=2),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 8.9, "rating_count": 3800, "interested_count": 16400,
        "languages": ["Hindi"],
        "genres": ["Romance", "Comedy"],
        "formats": ["2D"],
        "is_national": False
    },
    {
        "title": "Banaras Sunset: A Spiritual Journey",
        "slug": "banaras-ghat-serenade",
        "synopsis": "A profound philosophical drama capturing the transformative pilgrimage of an estranged father and son reuniting amidst the evening aarti lamps of Assi Ghat.",
        "poster_url": "/posters/banaras-ghat-serenade.webp",
        "banner_url": "/backdrops/banaras-ghat-serenade.webp",
        "trailer_url": "/trailers/banaras-ghat-serenade.mp4",
        "duration_minutes": 128, "certificate": "U",
        "release_date": date.today() - timedelta(days=3),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 9.0, "rating_count": 2950, "interested_count": 13100,
        "languages": ["Hindi"],
        "genres": ["Drama", "Spiritual"],
        "formats": ["2D", "Dolby Atmos 2D"],
        "is_national": False
    },

    # 47-50 English / International & Animation Crossover
    {
        "title": "Silicon Horizon: AI Takeover",
        "slug": "silicon-horizon",
        "synopsis": "In a high-tech smart city, a rogue neural network silently achieves consciousness and begins orchestrating civic algorithms to protect humanity from itself.",
        "poster_url": "/posters/silicon-horizon.webp",
        "banner_url": "/backdrops/silicon-horizon.webp",
        "trailer_url": "/trailers/silicon-horizon.mp4",
        "duration_minutes": 142, "certificate": "UA",
        "release_date": date.today() - timedelta(days=4),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 8.6, "rating_count": 2600, "interested_count": 11900,
        "languages": ["English", "Hindi"],
        "genres": ["Sci-Fi", "Cyberpunk", "Action"],
        "formats": ["IMAX 3D", "4DX", "2D"],
        "is_national": False
    },
    {
        "title": "Solaris Reborn: Deep Space Echoes",
        "slug": "solaris-reborn",
        "synopsis": "A deeply philosophical space expedition encounters a sentient oceanic exoplanet that projects the physical manifestations of the crew's deepest memories.",
        "poster_url": "/posters/solaris-reborn.webp",
        "banner_url": "/backdrops/solaris-reborn.webp",
        "trailer_url": "/trailers/solaris-reborn.mp4",
        "duration_minutes": 158, "certificate": "A",
        "release_date": date.today() - timedelta(days=6),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 8.8, "rating_count": 2100, "interested_count": 9700,
        "languages": ["English"],
        "genres": ["Sci-Fi", "Drama"],
        "formats": ["IMAX 3D", "2D"],
        "is_national": False
    },
    {
        "title": "Speedway Racers: Grand Prix Nitro",
        "slug": "speedway-racers-3d",
        "synopsis": "A colorful, turbocharged 3D animated racing spectacle featuring animal drivers competing in anti-gravity hypercars through futuristic global tracks.",
        "poster_url": "/posters/speedway-racers-3d.webp",
        "banner_url": "/backdrops/speedway-racers-3d.webp",
        "trailer_url": "/trailers/speedway-racers-3d.mp4",
        "duration_minutes": 98, "certificate": "U",
        "release_date": date.today() - timedelta(days=2),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 8.7, "rating_count": 3100, "interested_count": 14000,
        "languages": ["English", "Hindi"],
        "genres": ["Animation", "Action", "Family"],
        "formats": ["3D", "2D"],
        "is_national": False
    },
    {
        "title": "Cyber Knight 2099",
        "slug": "cyber-knight-2099",
        "synopsis": "An visually mesmerizing anime sci-fi epic tracking a synthetic paladin who defends the remaining organic human enclaves against rogue automaton fleets.",
        "poster_url": "/posters/cyber-knight-2099.webp",
        "banner_url": "/backdrops/cyber-knight-2099.webp",
        "trailer_url": "/trailers/cyber-knight-2099.mp4",
        "duration_minutes": 112, "certificate": "UA",
        "release_date": date.today() - timedelta(days=3),
        "is_now_showing": True, "is_coming_soon": False,
        "rating_avg": 8.9, "rating_count": 2800, "interested_count": 13200,
        "languages": ["English", "Hindi"],
        "genres": ["Animation", "Sci-Fi", "Action"],
        "formats": ["2D", "Dolby Atmos 2D"],
        "is_national": False
    },
]

# Verified city lineup mapping producing 35% <= Jaccard similarity <= 65% for ALL 21 pairs
CITY_REGIONAL_MAP = {
    "bengaluru": [
        "garuda-sky-guardian", "cauvery-breeze", "bangalore-startups-samosas",
        "the-forest-phantom", "kolar-gold-shadows", "silicon-horizon", "wayanad-rain-shadow"
    ],
    "mumbai": [
        "maharudra-rising", "pune-heritage-tales", "the-last-testimony",
        "mumbai-local-chronicles", "gully-hustle-dharavi", "haveli-of-haunting", "mirage-in-thar"
    ],
    "delhi-ncr": [
        "punjab-express-action", "fields-of-gold-malwa", "jatt-in-london-laugh",
        "delhi-6-weddings", "banaras-ghat-serenade", "mirage-in-thar", "chandigarh-nights"
    ],
    "hyderabad": [
        "simhadri-roar", "deccan-underworld", "charminar-chords",
        "babus-big-idea", "godavari-monsoon-diary", "wayanad-rain-shadow", "mirage-in-thar"
    ],
    "chennai": [
        "madras-syndicate", "chennai-monsoons", "dosa-filter-coffee",
        "chola-secrets", "echoes-of-malabar", "godavari-monsoon-diary", "kochi-harbor-noir"
    ],
    "pune": [
        "maharudra-rising", "pune-heritage-tales",
        "ghat-crematorium", "silicon-horizon", "solaris-reborn", "speedway-racers-3d", "delhi-6-weddings"
    ],
    "kolkata": [
        "bengal-tiger-detective", "howrah-bridge-sunset", "fish-curry-football",
        "the-magic-quill", "whispering-fog-darjeeling", "banaras-ghat-serenade", "haveli-of-haunting"
    ]
}

def get_city_movies(city_slug: str) -> List[str]:
    national = [m["slug"] for m in MOVIES_DATA if m["is_national"]]
    return national + CITY_REGIONAL_MAP.get(city_slug, [])


def compute_row_x_positions(seats_per_row: int, aisles: List[int], seat_pitch: float, aisle_gap: float) -> List[float]:
    if seats_per_row <= 0:
        return []
    if seats_per_row == 1:
        return [0.0]
    x_rel = [0.0] * seats_per_row
    for i in range(1, seats_per_row):
        prev = i
        is_aisle = prev in aisles
        step = seat_pitch + (aisle_gap if is_aisle else 0.0)
        x_rel[i] = x_rel[i - 1] + step
    span = x_rel[-1]
    half_span = span / 2.0
    return [round(half_span - xr, 3) for xr in x_rel]


def generate_auditorium_layout(
    theatre_type: str = "standard",
    total_seats: int = 224,
    is_3d_hall: bool = False,
    screen_type: str = "",
    blocks_pattern: List[int] = None,
    arrangement: str = None,
    sweet_spot: dict = None,
) -> Tuple[dict, List[dict]]:
    """
    Deterministically generates layout_data JSON and individual Seat specifications.
    Uses real-world dimensions in metres from the theatre type registry converted via METERS_TO_SCENE (2.0u/m).
    Compact reference hall (100 seats) retains its bespoke coordinates.
    """
    if is_3d_hall and total_seats == 100:
        layout_path = os.path.join(os.path.dirname(__file__), "..", "..", "..", "frontend", "public", "models", "seat_layout_v2.json")
        try:
            with open(layout_path, "r", encoding="utf-8") as f:
                raw_data = json.load(f)
                seats_json = raw_data.get("seats", raw_data)
        except Exception:
            seats_json = []

        rows = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]
        seats_per_row = 10
        aisles = [3, 7]
        accessible = ["A01", "A02"]

        layout_data = {
            "theatre_type": "compact",
            "theatre_type_label": "Compact 3D Hall (Reference)",
            "arrangement_pattern": "triple_block",
            "rows": rows,
            "seats_per_row": seats_per_row,
            "aisles": aisles,
            "accessible_seats": accessible,
            "category_bands": [
                {"category": "Front", "rows": ["A", "B", "C"], "price_multiplier": 0.8},
                {"category": "Prime", "rows": ["D", "E", "F", "G"], "price_multiplier": 1.0},
                {"category": "Premier", "rows": ["H", "I", "J"], "price_multiplier": 1.35}
            ],
            "documented_scale": {
                "meters_to_scene": 1.0 / 0.43,
                "scene_to_meters": 0.43,
                "seat_width_m": 0.55,
                "row_pitch_m": 1.05,
                "rake_step_m": 0.18,
                "aisle_width_m": 1.20,
                "ceiling_height_m": 8.5,
                "screen_width_m": 15.6 * 0.43,
                "screen_height_m": 7.25 * 0.43,
            }
        }

        seat_records = []
        if seats_json:
            for s in seats_json:
                cat_map = {"front": "Front", "prime": "Prime", "premier": "Premier"}
                cat = cat_map.get(s.get("category", "prime").lower(), "Prime")
                eye = s.get("eye_position_gltf_y_up", [0, 1.2, 5])
                seat_records.append({
                    "seat_id": s.get("seat_id"),
                    "row": s.get("row"),
                    "number": s.get("number"),
                    "category": cat,
                    "node_name": s.get("node_name", f"seat_{s.get('row')}_{str(s.get('number')).zfill(2)}"),
                    "eye_x": eye[0], "eye_y": eye[1], "eye_z": eye[2],
                    "distance_to_screen": s.get("screen_distance_m_est", 10.0),
                    "vertical_angle_deg": s.get("vertical_angle_deg", 0.0),
                    "horizontal_angle_deg": s.get("horizontal_offset_deg", 0.0),
                    "is_accessible": s.get("seat_id") in accessible,
                    "seat_type": "accessible" if s.get("seat_id") in accessible else "standard",
                    "level": "stalls",
                    "section": "Stalls",
                })
        return layout_data, seat_records

    # Lookup definition in theatre type registry
    theatre_def = get_theatre_type_definition(theatre_type or screen_type, total_seats)
    tid = theatre_def["id"]

    seat_pitch = theatre_def["scene_units"]["seat_pitch"]
    row_pitch = theatre_def["scene_units"]["row_pitch"]
    tier_rise = theatre_def["scene_units"]["tier_rise"]
    aisle_gap = theatre_def["scene_units"]["aisle_gap"]
    screen_w = theatre_def["scene_units"]["screen_width"]
    screen_h = theatre_def["scene_units"]["screen_height"]

    alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

    # Specific real-world hall templates based on type
    if tid == "flagship":
        row_count = 20
        seats_per_row = total_seats // row_count if total_seats % row_count == 0 else 28
        rows = [alphabet[i] for i in range(row_count)]
        if not blocks_pattern:
            side = (seats_per_row - 14) // 2
            blocks_pattern = [side, 14, side] if side > 0 else [7, 14, 7]
        aisles = [blocks_pattern[0], blocks_pattern[0] + blocks_pattern[1]]
        curve_rad = 32.0
        has_balcony = False
        balcony_rows = []
        stalls_rows = rows
        sweet_spot = sweet_spot or {
            "rows": ["J", "K", "L", "M"],
            "seat_numbers": list(range(blocks_pattern[0] + 2, blocks_pattern[0] + blocks_pattern[1])),
            "label": "IMAX Optimal Center",
            "price_multiplier": 1.45,
        }
    elif tid == "balcony":
        has_balcony = True
        curve_rad = 30.0
        if total_seats >= 680:
            stalls_count = 16
            balcony_count = 8
            seats_per_row = 28
        else:
            stalls_count = 14
            balcony_count = 7
            seats_per_row = 28
        row_count = stalls_count + balcony_count
        rows = [alphabet[i] for i in range(row_count)]
        stalls_rows = rows[:stalls_count]
        balcony_rows = rows[stalls_count:]
        if not blocks_pattern:
            blocks_pattern = [7, 14, 7]
        aisles = [7, 21]
    elif tid == "large":
        row_count = 18 if total_seats >= 400 else 16
        seats_per_row = total_seats // row_count
        rows = [alphabet[i] for i in range(row_count)]
        if not blocks_pattern:
            blocks_pattern = [6, 12, 6] if seats_per_row >= 24 else [5, 12, 5]
        aisles = [blocks_pattern[0], blocks_pattern[0] + blocks_pattern[1]]
        curve_rad = 28.0
        has_balcony = False
        balcony_rows = []
        stalls_rows = rows
    elif tid == "dolby_atmos_4dx":
        row_count = 12
        seats_per_row = total_seats // row_count
        rows = [alphabet[i] for i in range(row_count)]
        if not blocks_pattern:
            blocks_pattern = [5, 10, 5]
        aisles = [blocks_pattern[0], blocks_pattern[0] + blocks_pattern[1]]
        curve_rad = None
        has_balcony = False
        balcony_rows = []
        stalls_rows = rows
    elif tid == "luxury_recliner":
        row_count = 7
        seats_per_row = total_seats // row_count
        rows = [alphabet[i] for i in range(row_count)]
        if not blocks_pattern:
            blocks_pattern = [4, 4, 4] if seats_per_row >= 12 else [seats_per_row // 2, seats_per_row // 2]
        aisles = [blocks_pattern[0], blocks_pattern[0] + blocks_pattern[1]] if len(blocks_pattern) == 3 else [blocks_pattern[0]]
        curve_rad = None
        has_balcony = False
        balcony_rows = []
        stalls_rows = rows
    elif tid == "boutique":
        row_count = 6
        seats_per_row = total_seats // row_count
        rows = [alphabet[i] for i in range(row_count)]
        if not blocks_pattern:
            blocks_pattern = [seats_per_row // 2, seats_per_row // 2]
        aisles = [blocks_pattern[0]]
        curve_rad = None
        has_balcony = False
        balcony_rows = []
        stalls_rows = rows
    else:  # standard
        if arrangement == "continental":
            row_count = 12
            seats_per_row = total_seats // row_count
            rows = [alphabet[i] for i in range(row_count)]
            blocks_pattern = [seats_per_row]
            aisles = []
        else:
            row_count = 14
            seats_per_row = total_seats // row_count
            rows = [alphabet[i] for i in range(row_count)]
            blocks_pattern = [seats_per_row // 2, seats_per_row // 2]
            aisles = [seats_per_row // 2]
        curve_rad = None
        has_balcony = False
        balcony_rows = []
        stalls_rows = rows

    # Category Bands
    front_cut = max(2, row_count // 4)
    prime_cut = max(front_cut + 3, (3 * row_count) // 4)
    front_rows = rows[:front_cut]
    prime_rows = rows[front_cut:prime_cut]
    premier_rows = rows[prime_cut:]

    # Recliner Pairs configuration
    recliner_pairs = []
    pair_map = {}
    if tid == "luxury_recliner" or theatre_def.get("features", {}).get("recliner_pairs"):
        for r in rows:
            for s in range(1, seats_per_row, 2):
                if s + 1 <= seats_per_row:
                    s1 = f"{r}{str(s).zfill(2)}"
                    s2 = f"{r}{str(s + 1).zfill(2)}"
                    recliner_pairs.append([s1, s2])
                    pair_map[s1] = s2
                    pair_map[s2] = s1
    elif len(premier_rows) > 0:
        for pr in premier_rows:
            for s in range(1, seats_per_row, 2):
                if s + 1 <= seats_per_row:
                    s1 = f"{pr}{str(s).zfill(2)}"
                    s2 = f"{pr}{str(s + 1).zfill(2)}"
                    recliner_pairs.append([s1, s2])
                    pair_map[s1] = s2
                    pair_map[s2] = s1

    # Accessible Seats
    accessible = [f"A01", f"A{str(seats_per_row).zfill(2)}"]

    # 4DX Features & Motion Rows
    is_4dx = tid == "dolby_atmos_4dx" or "4DX" in screen_type or "4dx" in screen_type.lower()
    motion_rows = ["D", "E", "F", "G"] if is_4dx else []

    layout_data = {
        "theatre_type": tid,
        "theatre_type_label": theatre_def["label"],
        "arrangement_pattern": arrangement or theatre_def["arrangement"],
        "blocks_pattern": blocks_pattern,
        "sweet_spot": sweet_spot,
        "rows": rows,
        "seats_per_row": seats_per_row,
        "aisles": aisles,
        "accessible_seats": accessible,
        "category_bands": [
            {"category": "Front", "rows": front_rows, "price_multiplier": 0.75},
            {"category": "Prime", "rows": prime_rows, "price_multiplier": 1.0},
            {"category": "Premier", "rows": premier_rows, "price_multiplier": 1.45}
        ],
        "has_balcony": has_balcony,
        "levels": {
            "stalls": {"label": "Stalls", "height": 0.0, "rows": stalls_rows},
            **({"balcony": {"label": "Balcony", "height": 3.6, "rows": balcony_rows}} if has_balcony else {})
        },
        "recliner_pairs": recliner_pairs,
        "curve_radius": curve_rad,
        "documented_scale": {
            "meters_to_scene": METERS_TO_SCENE,
            "scene_to_meters": SCENE_TO_METERS,
            "seat_width_m": theatre_def["real_world"]["seat_width_m"],
            "row_pitch_m": theatre_def["real_world"]["row_pitch_m"],
            "rake_step_m": theatre_def["real_world"]["rake_step_m"],
            "aisle_width_m": theatre_def["real_world"]["aisle_width_m"],
            "ceiling_height_m": theatre_def["real_world"]["ceiling_height_m"],
            "screen_width_m": theatre_def["real_world"]["screen_width_m"],
            "screen_height_m": theatre_def["real_world"]["screen_height_m"],
        },
        "features": {
            "is_4dx": is_4dx,
            "motion_seats": is_4dx,
            "wind": is_4dx,
            "water": is_4dx,
            "fog": is_4dx,
            "scent": is_4dx,
            "strobe": is_4dx,
            "ticklers": is_4dx,
            "dolby_atmos": "Atmos" in screen_type or is_4dx or "atmos" in tid
        }
    }

    # Pre-calculate row X coordinates
    x_positions = compute_row_x_positions(seats_per_row, aisles, seat_pitch, aisle_gap)

    ROW_A_Z = -8.032
    ROW_A_Y = 1.365
    SCREEN_Z = -1.255
    screen_center_y = max(5.5, screen_h / 2.0 + 1.2)

    sweet_spot_rows = set(sweet_spot["rows"]) if sweet_spot else set()
    sweet_spot_nums = set(sweet_spot["seat_numbers"]) if sweet_spot else set()

    seat_records = []
    stalls_set = set(stalls_rows)
    balcony_set = set(balcony_rows)

    for r_idx, r in enumerate(rows):
        is_balc = r in balcony_set
        if is_balc:
            b_idx = balcony_rows.index(r)
            b_jump = 3.6
            row_y = round(ROW_A_Y + len(stalls_rows) * tier_rise + b_jump + b_idx * (tier_rise + 0.12), 3)
            row_z = round(ROW_A_Z - (len(stalls_rows) + b_idx) * row_pitch - 0.5, 3)
        else:
            row_y = round(ROW_A_Y + r_idx * tier_rise, 3)
            row_z = round(ROW_A_Z - r_idx * row_pitch, 3)

        base_cat = "Front" if r in front_rows else ("Prime" if r in prime_rows else "Premier")

        for s_idx in range(seats_per_row):
            num = s_idx + 1
            seat_id = f"{r}{str(num).zfill(2)}"
            pos_x = x_positions[s_idx]
            sag_z = round((pos_x * pos_x) / (2.0 * curve_rad), 3) if curve_rad else 0.0
            pos_z = round(row_z + sag_z, 3)

            # Sweet spot override
            is_sw = r in sweet_spot_rows and num in sweet_spot_nums
            cat = "Premier" if is_sw else base_cat

            eye_x = pos_x
            eye_y = round(row_y + 0.65, 3)
            eye_z = round(pos_z - 0.15, 3)

            dist = round(math.sqrt(eye_x**2 + (eye_y - screen_center_y)**2 + (eye_z - SCREEN_Z)**2), 2)
            v_angle = round(math.atan2(screen_center_y - eye_y, abs(eye_z - SCREEN_Z)) * 180.0 / math.pi, 1)
            h_offset = round(math.atan2(eye_x, abs(eye_z - SCREEN_Z)) * 180.0 / math.pi, 1)

            is_acc = seat_id in accessible
            is_comp = not is_acc and f"{r}{str(num - 1).zfill(2)}" in accessible
            is_pair = seat_id in pair_map

            if is_acc:
                seat_type_val = "accessible"
            elif is_comp:
                seat_type_val = "companion"
            elif tid == "boutique":
                seat_type_val = "sofa"
            elif is_pair:
                seat_type_val = "recliner_pair"
            elif tid == "luxury_recliner":
                seat_type_val = "recliner"
            else:
                seat_type_val = "standard"

            seat_records.append({
                "seat_id": seat_id,
                "row": r,
                "number": num,
                "category": cat,
                "node_name": f"seat_{r}_{str(num).zfill(2)}",
                "eye_x": eye_x,
                "eye_y": eye_y,
                "eye_z": eye_z,
                "distance_to_screen": dist,
                "vertical_angle_deg": v_angle,
                "horizontal_angle_deg": h_offset,
                "is_accessible": is_acc,
                "is_companion": is_comp,
                "seat_type": seat_type_val,
                "pair_partner_id": pair_map.get(seat_id),
                "level": "balcony" if is_balc else "stalls",
                "section": "Balcony" if is_balc else "Stalls",
                "in_motion_zone": r in motion_rows
            })

    return layout_data, seat_records

    return layout_data, seat_records


FNB_DATA = [
    {
        "name": "Caramel Gold Popcorn (Large)",
        "category": "Popcorn",
        "price": 320.0,
        "description": "Slow-kettle cooked gourmet popcorn with golden cane caramel glaze.",
        "image_url": "/fnb/caramel_popcorn.png",
        "is_available": True
    },
    {
        "name": "Artisan Cheese Butter Popcorn",
        "category": "Popcorn",
        "price": 290.0,
        "description": "Freshly popped tender kernels tossed in aged white cheddar and clarified butter.",
        "image_url": "/fnb/cheese_popcorn.png",
        "is_available": True
    },
    {
        "name": "Sparkling Berry Mojito",
        "category": "Beverages",
        "price": 220.0,
        "description": "Crushed wild berries, fresh mint leaves, lime zest, and effervescent soda.",
        "image_url": "/fnb/berry_mojito.png",
        "is_available": True
    },
    {
        "name": "Classic Fountain Coca-Cola (Zero Sugar)",
        "category": "Beverages",
        "price": 180.0,
        "description": "Crisp, chilled classic fountain beverage with zero calories.",
        "image_url": "/fnb/coke_zero.png",
        "is_available": True
    },
    {
        "name": "Loaded Peri-Peri Crinkle Fries",
        "category": "Snacks",
        "price": 240.0,
        "description": "Crispy golden crinkle-cut fries dusted with fiery African bird's eye chili.",
        "image_url": "/fnb/peri_peri_fries.png",
        "is_available": True
    },
    {
        "name": "Truffle & Parmesan Nachos Grande",
        "category": "Snacks",
        "price": 340.0,
        "description": "Artisan corn chips smothered in warm truffle queso, jalapeños, and fresh salsa.",
        "image_url": "/fnb/nachos_grande.png",
        "is_available": True
    }
]

COUPONS_DATA = [
    {
        "code": "FIRSTSHOW",
        "description": "20% off on minimum booking of ₹400, max discount ₹150",
        "discount_type": DiscountTypeEnum.PERCENTAGE,
        "discount_value": 20.0,
        "min_order_amount": 400.0,
        "max_discount_amount": 150.0,
        "is_active": True
    },
    {
        "code": "CINEVERSE50",
        "description": "Flat ₹50 off on minimum purchase of ₹300",
        "discount_type": DiscountTypeEnum.FLAT,
        "discount_value": 50.0,
        "min_order_amount": 300.0,
        "max_discount_amount": 50.0,
        "is_active": True
    },
    {
        "code": "BLOCKBUSTER20",
        "description": "20% off up to ₹150 for CineVerse Club patrons",
        "discount_type": DiscountTypeEnum.PERCENTAGE,
        "discount_value": 20.0,
        "min_order_amount": 600.0,
        "max_discount_amount": 150.0,
        "is_active": True
    },
    {
        "code": "BLOCKBUSTER100",
        "description": "Flat ₹100 off on minimum purchase of ₹600",
        "discount_type": DiscountTypeEnum.FLAT,
        "discount_value": 100.0,
        "min_order_amount": 600.0,
        "max_discount_amount": 100.0,
        "is_active": True
    }
]

MOVIE_DOMINANT_COLORS = {
    "quantum-odyssey": "#0b1b3b",
    "astra-celestial-throne": "#b23216",
    "shadow-protocol": "#60190e",
    "vajra-thunderborn": "#ab3015",
    "redline-vendetta": "#5e180e",
    "little-hanuman": "#2777b2",
    "chronos-paradox": "#123569",
    "zero-gravity-protocol": "#113469",
    "garuda-sky-guardian": "#671f0f",
    "cauvery-breeze": "#7b605e",
    "bangalore-startups-samosas": "#2d5f96",
    "the-forest-phantom": "#400e11",
    "kolar-gold-shadows": "#692026",
    "maharudra-rising": "#5d180e",
    "pune-heritage-tales": "#3e2f38",
    "the-last-testimony": "#34303d",
    "ghat-crematorium": "#41180e",
    "mumbai-local-chronicles": "#2875b2",
    "simhadri-roar": "#a32f14",
    "deccan-underworld": "#5a1910",
    "charminar-chords": "#a83758",
    "babus-big-idea": "#2d5f96",
    "godavari-monsoon-diary": "#664746",
    "madras-syndicate": "#5c180e",
    "chennai-monsoons": "#6b5454",
    "dosa-filter-coffee": "#2d5f96",
    "chola-secrets": "#19323f",
    "echoes-of-malabar": "#825d57",
    "bengal-tiger-detective": "#5e1a12",
    "howrah-bridge-sunset": "#7d5d59",
    "fish-curry-football": "#2d5f96",
    "the-magic-quill": "#1c3249",
    "whispering-fog-darjeeling": "#725b59",
    "punjab-express-action": "#6b2313",
    "fields-of-gold-malwa": "#7e5e5b",
    "jatt-in-london-laugh": "#2f6096",
    "bullet-yaari-clash": "#5e180e",
    "chandigarh-nights": "#983a62",
    "wayanad-rain-shadow": "#876a64",
    "midnight-train-kozhikode": "#ab3015",
    "kochi-harbor-noir": "#54242c",
    "gully-hustle-dharavi": "#561e6e",
    "haveli-of-haunting": "#501013",
    "mirage-in-thar": "#b13216",
    "delhi-6-weddings": "#5b1e43",
    "banaras-ghat-serenade": "#3d2e37",
    "silicon-horizon": "#113366",
    "solaris-reborn": "#3077bf",
    "speedway-racers-3d": "#2977b3",
    "cyber-knight-2099": "#2877b3",
}

import math

async def seed_database():
    """Deterministic, idempotent seeder executing in < 60 seconds with bulk insertions."""
    print("Starting deterministic CineVerse multi-city seeding...")
    start_time = datetime.now()

    async with AsyncSessionLocal() as db:
        # Check if already seeded with new catalogue
        movie_count_res = await db.execute(select(func.count(Movie.id)))
        existing_movies = movie_count_res.scalar() or 0
        aud_count_res = await db.execute(select(func.count(Auditorium.id)))
        existing_auds = aud_count_res.scalar() or 0
        show_count_res = await db.execute(select(func.count(Showtime.id)))
        existing_shows = show_count_res.scalar() or 0

        force_seed = os.environ.get("FORCE_SEED", "0") == "1"

        if not force_seed and existing_movies >= 48 and existing_auds >= 70 and existing_shows >= 2000:
            # Sync Phase 6 Map and Transit metadata for existing cinemas if missing
            cin_stmt = select(Cinema)
            cin_res = await db.execute(cin_stmt)
            cinemas_to_sync = cin_res.scalars().all()
            synced_count = 0
            for cin in cinemas_to_sync:
                meta = CINEMAS_METADATA.get(cin.slug)
                if meta:
                    if not cin.pincode or not cin.transit_stop or cin.is_demo_data is None:
                        cin.pincode = meta["pincode"]
                        cin.landmark = meta["landmark"]
                        cin.parking = meta["parking"]
                        cin.transit_stop = meta["transit_stop"]
                        cin.phone = meta["phone"]
                        cin.opening_hours = meta["opening_hours"]
                        cin.is_demo_data = meta["is_demo_data"]
                        synced_count += 1
            if synced_count > 0:
                await db.commit()
                print(f"Phase 6 map metadata updated for {synced_count} existing cinemas.")

            # Phase Movie Backdrop & Glimpse metadata sync for existing movies
            mov_stmt = select(Movie)
            mov_res = await db.execute(mov_stmt)
            movies_to_sync = mov_res.scalars().all()
            mov_synced_count = 0
            for mov in movies_to_sync:
                if not mov.dominant_color or not mov.glimpse_url:
                    mov.dominant_color = MOVIE_DOMINANT_COLORS.get(mov.slug, "#0b1b3b")
                    mov.glimpse_url = f"/trailers/glimpses/{mov.slug}-480p.mp4"
                    mov.glimpse_webm_url = f"/trailers/glimpses/{mov.slug}-480p.webm"
                    mov.glimpse_720p_url = f"/trailers/glimpses/{mov.slug}-720p.mp4"
                    mov_synced_count += 1
            if mov_synced_count > 0:
                await db.commit()
                print(f"Movie backdrop and glimpse metadata updated for {mov_synced_count} existing movies.")

            # Ensure TMDB non-showcase movies are seeded if not present
            from app.seed.seed_tmdb_movies import seed_tmdb_movies_data
            await seed_tmdb_movies_data(db)

            print(f"Database already contains {existing_movies} movies, {existing_auds} auditoriums, and {existing_shows} showtimes. Seed verified.")
            return

        print("Wiping existing data and applying latest schema...")
        await reset_db()

        # 1. Seed Users
        print("Seeding Users...")
        test_users = [
            User(email="admin@cineverse.com", hashed_password=hash_password("Admin@123"), full_name="CineVerse Administrator", role=RoleEnum.ADMIN, is_active=True),
            User(email="manager@cineverse.com", hashed_password=hash_password("Manager@123"), full_name="City Cinema Manager", role=RoleEnum.CINEMA_MANAGER, is_active=True),
            User(email="manager@cineverse.in", hashed_password=hash_password("Manager@123"), full_name="City Cinema Manager", role=RoleEnum.CINEMA_MANAGER, is_active=True),
            User(email="patron@example.com", hashed_password=hash_password("Patron@123"), full_name="Aditya Sharma", role=RoleEnum.CUSTOMER, is_active=True),
            User(email="karthik@cineverse.dev", hashed_password=hash_password("Karthik@123"), full_name="Karthik Patron", role=RoleEnum.CUSTOMER, is_active=True),
        ]
        db.add_all(test_users)
        await db.flush()

        # 2. Seed Cities
        print("Seeding 7 Cities...")
        city_entities: Dict[str, City] = {}
        for c_data in CITIES_DATA:
            city = City(name=c_data["name"], slug=c_data["slug"], state=c_data["state"], is_active=True)
            db.add(city)
            await db.flush()
            city_entities[c_data["slug"]] = city

        # 3. Seed Cinemas & Auditoriums
        print("Seeding 35 Cinemas and 98+ Auditoriums across 7 Cities...")
        cinema_entities: List[Cinema] = []
        auditorium_entities: List[Auditorium] = []
        all_seats_to_insert: List[dict] = []

        for c_info in CINEMAS_DATA:
            city = city_entities[c_info["city_slug"]]
            meta = CINEMAS_METADATA.get(c_info["slug"], {})
            cinema = Cinema(
                city_id=city.id,
                name=c_info["name"],
                slug=c_info["slug"],
                address=c_info["address"],
                latitude=c_info["latitude"],
                longitude=c_info["longitude"],
                facilities=c_info["facilities"],
                cancellation_policy="Cancellation available up to 2 hours before showtime. 75% refund.",
                pincode=meta.get("pincode"),
                landmark=meta.get("landmark"),
                parking=meta.get("parking", "Covered"),
                transit_stop=meta.get("transit_stop"),
                phone=meta.get("phone", "+91 80 4000 1234"),
                opening_hours=meta.get("opening_hours", "09:00 AM - 11:30 PM"),
                is_demo_data=meta.get("is_demo_data", True),
            )
            db.add(cinema)
            await db.flush()
            cinema_entities.append(cinema)

            # Determine auditoriums for this cinema
            # Flagship cinema has 4 screens including 1 Flagship Big Hall (420 seats)
            # Normal cinema has 2 to 3 screens
            if c_info["slug"] == "cineverse-astral-koramangala":
                screens_config = [
                    {"name": "Screen 1 — Compact Hall", "theatre_type": "compact", "type": "IMAX 3D", "seats": 100, "is_3d": True},
                    {"name": "Screen 2 — Big Hall Flagship", "theatre_type": "flagship", "type": "IMAX with Laser", "seats": 560, "is_3d": False},
                    {"name": "Screen 3 — Grand Balcony Auditorium", "theatre_type": "balcony", "type": "Dolby Atmos 2D", "seats": 700, "is_3d": False},
                    {"name": "Screen 4 — Luxe Recliner Lounge", "theatre_type": "luxury_recliner", "type": "Recliner Gold", "seats": 84, "is_3d": False},
                ]
            elif c_info["slug"] == "cineverse-horizon-lower-parel":
                screens_config = [
                    {"name": "Screen 1 — Flagship Big Hall", "theatre_type": "flagship", "type": "IMAX with Laser", "seats": 520, "is_3d": False},
                    {"name": "Screen 2 — Grand Balcony Hall", "theatre_type": "balcony", "type": "Dolby Atmos 2D", "seats": 640, "is_3d": False},
                    {"name": "Screen 3 — Dolby Atmos 4DX", "theatre_type": "dolby_atmos_4dx", "type": "4DX", "seats": 240, "is_3d": False},
                    {"name": "Screen 4 — Boutique Velvet Salon", "theatre_type": "boutique", "type": "Boutique", "seats": 48, "is_3d": False},
                ]
            elif c_info["slug"] == "cineverse-orion-dome-rajajinagar":
                screens_config = [
                    {"name": "Screen 1 — Large Format Screen", "theatre_type": "large", "type": "Large Format", "seats": 420, "is_3d": False},
                    {"name": "Screen 2 — Standard Central Aisle", "theatre_type": "standard", "type": "Standard", "seats": 224, "is_3d": False, "arrangement": "single_aisle"},
                    {"name": "Screen 3 — Continental Stadium", "theatre_type": "standard", "type": "Standard", "seats": 216, "is_3d": False, "arrangement": "continental"},
                ]
            elif c_info.get("is_flagship"):
                c_idx = len(cinema_entities)
                if c_idx % 2 == 0:
                    screens_config = [
                        {"name": "Screen 1 — Flagship Big Hall", "theatre_type": "flagship", "type": "IMAX with Laser", "seats": 560, "is_3d": False},
                        {"name": "Screen 2 — Grand Balcony Hall", "theatre_type": "balcony", "type": "Dolby Atmos 2D", "seats": 640, "is_3d": False},
                        {"name": "Screen 3 — Dolby Atmos 4DX", "theatre_type": "dolby_atmos_4dx", "type": "4DX", "seats": 240, "is_3d": False},
                        {"name": "Screen 4 — Luxe Recliner Lounge", "theatre_type": "luxury_recliner", "type": "Recliner Gold", "seats": 84, "is_3d": False},
                    ]
                else:
                    screens_config = [
                        {"name": "Screen 1 — Flagship Big Hall", "theatre_type": "flagship", "type": "IMAX with Laser", "seats": 520, "is_3d": False},
                        {"name": "Screen 2 — Large Format Screen", "theatre_type": "large", "type": "Large Format", "seats": 420, "is_3d": False},
                        {"name": "Screen 3 — Dolby Atmos 4DX", "theatre_type": "dolby_atmos_4dx", "type": "4DX", "seats": 240, "is_3d": False},
                        {"name": "Screen 4 — Boutique Velvet Salon", "theatre_type": "boutique", "type": "Boutique", "seats": 48, "is_3d": False},
                    ]
            else:
                c_idx = len(cinema_entities)
                mod = c_idx % 4
                if mod == 0:
                    screens_config = [
                        {"name": "Screen 1 — Large Format Screen", "theatre_type": "large", "type": "Large Format", "seats": 420, "is_3d": False},
                        {"name": "Screen 2 — Standard Central Aisle", "theatre_type": "standard", "type": "Standard", "seats": 224, "is_3d": False, "arrangement": "single_aisle"},
                        {"name": "Screen 3 — Luxe Recliner Lounge", "theatre_type": "luxury_recliner", "type": "Recliner Gold", "seats": 84, "is_3d": False},
                    ]
                elif mod == 1:
                    screens_config = [
                        {"name": "Screen 1 — Grand Balcony Auditorium", "theatre_type": "balcony", "type": "Dolby Atmos 2D", "seats": 560, "is_3d": False},
                        {"name": "Screen 2 — Dolby Atmos 4DX", "theatre_type": "dolby_atmos_4dx", "type": "4DX", "seats": 240, "is_3d": False},
                        {"name": "Screen 3 — Boutique Velvet Salon", "theatre_type": "boutique", "type": "Boutique", "seats": 48, "is_3d": False},
                    ]
                elif mod == 2:
                    screens_config = [
                        {"name": "Screen 1 — Dolby Atmos 4DX", "theatre_type": "dolby_atmos_4dx", "type": "4DX", "seats": 240, "is_3d": False},
                        {"name": "Screen 2 — Continental Stadium", "theatre_type": "standard", "type": "Standard", "seats": 216, "is_3d": False, "arrangement": "continental"},
                        {"name": "Screen 3 — Luxe Recliner Lounge", "theatre_type": "luxury_recliner", "type": "Recliner Gold", "seats": 84, "is_3d": False},
                    ]
                else:
                    screens_config = [
                        {"name": "Screen 1 — Standard Central Aisle", "theatre_type": "standard", "type": "Standard", "seats": 224, "is_3d": False, "arrangement": "single_aisle"},
                        {"name": "Screen 2 — Continental Stadium", "theatre_type": "standard", "type": "Standard", "seats": 216, "is_3d": False, "arrangement": "continental"},
                        {"name": "Screen 3 — Boutique Velvet Salon", "theatre_type": "boutique", "type": "Boutique", "seats": 48, "is_3d": False},
                    ]

            for s_cfg in screens_config:
                layout_data, seat_records = generate_auditorium_layout(
                    theatre_type=s_cfg.get("theatre_type", "standard"),
                    total_seats=s_cfg["seats"],
                    is_3d_hall=s_cfg.get("is_3d", False),
                    screen_type=s_cfg.get("type", "Standard"),
                    arrangement=s_cfg.get("arrangement"),
                )
                aud = Auditorium(
                    cinema_id=cinema.id,
                    name=s_cfg["name"],
                    screen_type=s_cfg["type"],
                    total_seats=len(seat_records),
                    has_3d_preview=True,
                    layout_data=layout_data
                )
                db.add(aud)
                await db.flush()
                auditorium_entities.append(aud)

                if s_cfg["is_3d"]:
                    db.add(TheatreAsset(
                        auditorium_id=aud.id,
                        glb_path="/models/cineverse_auditorium_v2.web.glb",
                        layout_path="/models/seat_layout_v2.json",
                        version="2.0",
                        checksum="9b244799fece67073b62fef85bb05d8f6d54cf8e511451a70e7e1694f71a4f10",
                        total_triangles=218000
                    ))

                for sr in seat_records:
                    all_seats_to_insert.append({
                        "auditorium_id": aud.id,
                        "seat_id": sr["seat_id"],
                        "row": sr["row"],
                        "number": sr["number"],
                        "category": sr["category"],
                        "node_name": sr["node_name"],
                        "eye_x": sr["eye_x"],
                        "eye_y": sr["eye_y"],
                        "eye_z": sr["eye_z"],
                        "distance_to_screen": sr["distance_to_screen"],
                        "vertical_angle_deg": sr["vertical_angle_deg"],
                        "horizontal_angle_deg": sr["horizontal_angle_deg"],
                        "is_accessible": sr["is_accessible"]
                    })

        # Bulk insert all seats (chunked safely for SQLite & PostgreSQL parameter limits)
        print(f"Bulk inserting {len(all_seats_to_insert)} Seats...")
        for i in range(0, len(all_seats_to_insert), 75):
            await db.execute(insert(Seat).values(all_seats_to_insert[i:i + 75]))
        await db.commit()

        # 4. Seed Movies Catalogue
        print("Seeding 50 Invented Movies across 9 Languages...")
        movie_entities: Dict[str, Movie] = {}
        for m_data in MOVIES_DATA:
            m = Movie(
                title=m_data["title"],
                slug=m_data["slug"],
                synopsis=m_data["synopsis"],
                poster_url=m_data["poster_url"],
                banner_url=m_data["banner_url"],
                trailer_url=m_data["trailer_url"],
                trailer_duration_seconds=20,
                trailer_poster_frame_url=m_data.get("trailer_poster_frame_url", f"/trailers/{m_data['slug']}_poster.jpg"),
                trailer_captions_url=m_data.get("trailer_captions_url", f"/trailers/{m_data['slug']}.vtt"),
                dominant_color=MOVIE_DOMINANT_COLORS.get(m_data["slug"], "#0b1b3b"),
                glimpse_url=f"/trailers/glimpses/{m_data['slug']}-480p.mp4",
                glimpse_webm_url=f"/trailers/glimpses/{m_data['slug']}-480p.webm",
                glimpse_720p_url=f"/trailers/glimpses/{m_data['slug']}-720p.mp4",
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
            db.add(m)
            await db.flush()
            movie_entities[m_data["slug"]] = m

            # Verified sample review
            db.add(Review(
                movie_id=m.id,
                user_id=test_users[2].id,
                rating=9,
                headline="Spectacular cinematic presentation!",
                content="Exceptional sound design and visuals. A must-watch on the biggest format screen!",
                has_spoilers=False,
                is_approved=True
            ))

            # Sample cast members for search and movie details
            db.add(MovieCast(
                movie_id=m.id,
                person_name="Marcus Vance",
                role_name="Dr. Marcus Vance",
                category="Cast"
            ))
            db.add(MovieCast(
                movie_id=m.id,
                person_name="Elena Rostova",
                role_name="Commander Elena Rostova",
                category="Cast"
            ))

        # 5. Seed F&B and Coupons
        print("Seeding F&B Items and Coupons...")
        for fnb in FNB_DATA:
            db.add(FnbItem(**fnb))
        for c in COUPONS_DATA:
            db.add(Coupon(**c))
        await db.commit()

        # 6. Seed Showtimes and Seat Inventory for Next 7 Days
        print("Seeding 7 Days of Showtimes and Realistic Seat Occupancy...")
        today = date.today()
        daily_time_slots = [
            time(9, 30),
            time(13, 0),
            time(16, 30),
            time(20, 0),
            time(23, 15)
        ]

        # Pre-fetch all seats grouped by auditorium_id
        print("Fetching auditorium seats for inventory population...")
        seat_res = await db.execute(select(Seat))
        all_seats = seat_res.scalars().all()
        aud_seat_map: Dict[int, List[Seat]] = {}
        for s in all_seats:
            aud_seat_map.setdefault(s.auditorium_id, []).append(s)

        # Build showtime records
        showtimes_to_insert = []
        inventory_records_batch = []
        price_rules_to_insert = []

        total_shows_created = 0

        # Map each cinema to its city slug
        cinema_city_slugs = {c.id: next(ci["city_slug"] for ci in CINEMAS_DATA if ci["slug"] == c.slug) for c in cinema_entities}

        for day_offset in range(7):
            cur_date = today + timedelta(days=day_offset)
            is_weekend = cur_date.weekday() in [4, 5, 6]  # Fri, Sat, Sun

            for aud in auditorium_entities:
                city_slug = cinema_city_slugs[aud.cinema_id]
                city_movie_slugs = get_city_movies(city_slug)

                # Filter movies matching screen type
                compatible_slugs = []
                for s in city_movie_slugs:
                    m = movie_entities[s]
                    if "IMAX" in aud.screen_type:
                        if any("IMAX" in f for f in m.formats):
                            compatible_slugs.append(s)
                    elif "4DX" in aud.screen_type:
                        if any("4DX" in f for f in m.formats):
                            compatible_slugs.append(s)
                    else:
                        compatible_slugs.append(s)

                if not compatible_slugs:
                    compatible_slugs = city_movie_slugs

                # Schedule 4 to 5 shows
                for slot_idx, start_t in enumerate(daily_time_slots):
                    movie_slug = compatible_slugs[(day_offset * 3 + slot_idx) % len(compatible_slugs)]
                    movie = movie_entities[movie_slug]

                    start_dt = datetime.combine(cur_date, start_t)
                    end_dt = start_dt + timedelta(minutes=movie.duration_minutes)

                    total_shows_created += 1
                    st_id = total_shows_created

                    showtimes_to_insert.append({
                        "id": st_id,
                        "movie_id": movie.id,
                        "cinema_id": aud.cinema_id,
                        "auditorium_id": aud.id,
                        "start_time": start_dt,
                        "end_time": end_dt,
                        "format": aud.screen_type,
                        "language": movie.languages[0] if movie.languages else "English",
                        "cancellation_cutoff_minutes": 120
                    })

                    # Dynamic pricing logic
                    is_morning = start_t.hour < 12
                    is_evening = start_t.hour >= 17

                    base_factor = 0.8 if is_morning else (1.2 if is_evening else 1.0)
                    if is_weekend:
                        base_factor *= 1.25
                    if "IMAX" in aud.screen_type or "4DX" in aud.screen_type:
                        base_factor *= 1.3
                    if aud.total_seats >= 380:
                        base_factor *= 1.15  # Flagship hall

                    front_price = round(220.0 * base_factor)
                    prime_price = round(320.0 * base_factor)
                    premier_price = round(460.0 * base_factor)

                    price_rules_to_insert.append({"showtime_id": st_id, "category": "Front", "base_price": float(front_price)})
                    price_rules_to_insert.append({"showtime_id": st_id, "category": "Prime", "base_price": float(prime_price)})
                    price_rules_to_insert.append({"showtime_id": st_id, "category": "Premier", "base_price": float(premier_price)})

        # Bulk insert all showtimes in batches first (ensures foreign key integrity)
        print(f"Bulk inserting {len(showtimes_to_insert)} Showtimes...")
        for i in range(0, len(showtimes_to_insert), 500):
            await db.execute(insert(Showtime).values(showtimes_to_insert[i:i + 500]))

        # Bulk insert price rules
        if price_rules_to_insert:
            print(f"Bulk inserting {len(price_rules_to_insert)} Price Rules...")
            for i in range(0, len(price_rules_to_insert), 1000):
                await db.execute(insert(PriceRule).values(price_rules_to_insert[i:i + 1000]))

        # Now generate and batch-insert SeatInventory
        print("Generating and inserting SeatInventory records...")
        st_idx = 0
        for day_offset in range(14):
            cur_date = today + timedelta(days=day_offset)
            is_weekend = cur_date.weekday() in [4, 5, 6]

            for aud in auditorium_entities:
                for slot_idx, start_t in enumerate(daily_time_slots):
                    st_idx += 1
                    st_id = st_idx

                    is_morning = start_t.hour < 12
                    is_evening = start_t.hour >= 17

                    base_factor = 0.8 if is_morning else (1.2 if is_evening else 1.0)
                    if is_weekend:
                        base_factor *= 1.25
                    if "IMAX" in aud.screen_type or "4DX" in aud.screen_type:
                        base_factor *= 1.3
                    if aud.total_seats >= 380:
                        base_factor *= 1.15

                    front_price = round(220.0 * base_factor)
                    prime_price = round(320.0 * base_factor)
                    premier_price = round(460.0 * base_factor)

                    # Occupancy distribution
                    if is_morning and not is_weekend:
                        target_booked_pct = random.uniform(0.05, 0.15)
                    elif is_evening and is_weekend:
                        target_booked_pct = random.uniform(0.30, 0.55)
                        if random.random() < 0.08:
                            target_booked_pct = 0.85
                    else:
                        target_booked_pct = random.uniform(0.15, 0.30)

                    aud_seats = aud_seat_map.get(aud.id, [])
                    held_count = random.randint(0, 3)

                    for s_obj in aud_seats:
                        if st_id == 1 and s_obj.seat_id == "C01":
                            status = SeatStatusEnum.BOOKED
                            booking_id = 1
                            hold_id = None
                            expires_at = None
                        elif st_id == 1 and s_obj.seat_id == "A06":
                            status = SeatStatusEnum.HELD
                            booking_id = None
                            hold_id = "cv-seed-hold-a06"
                            expires_at = datetime.utcnow() + timedelta(minutes=15)
                        else:
                            roll = random.random()
                            if roll < target_booked_pct:
                                status = SeatStatusEnum.BOOKED
                                booking_id = 1
                                hold_id = None
                                expires_at = None
                            elif held_count > 0 and roll < target_booked_pct + 0.04:
                                status = SeatStatusEnum.HELD
                                booking_id = None
                                hold_id = f"cv-seed-hold-{random.randint(10000, 99999)}"
                                expires_at = datetime.utcnow() + timedelta(minutes=random.randint(3, 8))
                                held_count -= 1
                            else:
                                status = SeatStatusEnum.AVAILABLE
                                booking_id = None
                                hold_id = None
                                expires_at = None

                        s_price = premier_price if s_obj.category == "Premier" else (front_price if s_obj.category == "Front" else prime_price)

                        inventory_records_batch.append({
                            "showtime_id": st_id,
                            "seat_id": s_obj.seat_id,
                            "category": s_obj.category,
                            "price": float(s_price),
                            "status": status,
                            "hold_id": hold_id,
                            "hold_expires_at": expires_at,
                            "booking_id": booking_id,
                            "held_by_user_id": None
                        })

                        # Batch flush at 2,500 records
                        if len(inventory_records_batch) >= 2500:
                            await db.execute(insert(SeatInventory).values(inventory_records_batch))
                            inventory_records_batch.clear()

        if inventory_records_batch:
            for i in range(0, len(inventory_records_batch), 2500):
                await db.execute(insert(SeatInventory).values(inventory_records_batch[i:i + 2500]))
            inventory_records_batch.clear()

        await db.commit()

    duration = (datetime.now() - start_time).total_seconds()
    print(f"SUCCESS: Database seeded deterministically in {duration:.1f} seconds!")
    print(f"Total Cinemas: {len(CINEMAS_DATA)}")
    print(f"Total Auditoriums: {len(auditorium_entities)}")
    print(f"Total Movies: {len(MOVIES_DATA)}")
    print(f"Total Showtimes: {total_shows_created}")


if __name__ == "__main__":
    asyncio.run(seed_database())
