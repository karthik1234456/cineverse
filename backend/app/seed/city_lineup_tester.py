import random
from typing import Dict, List, Set

# Set fixed deterministic seed
random.seed(42)

CITIES = [
    {"name": "Bengaluru", "slug": "bengaluru", "state": "Karnataka", "languages": ["Kannada", "English", "Hindi"]},
    {"name": "Mumbai", "slug": "mumbai", "state": "Maharashtra", "languages": ["Hindi", "Marathi", "English"]},
    {"name": "Delhi NCR", "slug": "delhi-ncr", "state": "Delhi", "languages": ["Hindi", "Punjabi", "English"]},
    {"name": "Hyderabad", "slug": "hyderabad", "state": "Telangana", "languages": ["Telugu", "Hindi", "English"]},
    {"name": "Chennai", "slug": "chennai", "state": "Tamil Nadu", "languages": ["Tamil", "Telugu", "English"]},
    {"name": "Pune", "slug": "pune", "state": "Maharashtra", "languages": ["Marathi", "Hindi", "English"]},
    {"name": "Kolkata", "slug": "kolkata", "state": "West Bengal", "languages": ["Bengali", "Hindi", "English"]},
]

# 50 Invented Movies across 9 languages
ALL_MOVIES = [
    # National Releases (High broad appeal across all cities)
    {"slug": "quantum-odyssey", "title": "Quantum Odyssey: Beyond the Singularity", "lang": "English", "is_national": True, "genres": ["Sci-Fi", "Adventure"], "cert": "UA", "duration": 168},
    {"slug": "astra-celestial-throne", "title": "Astra: Chronicles of the Celestial Throne", "lang": "Hindi", "is_national": True, "genres": ["Action", "Fantasy"], "cert": "UA", "duration": 175},
    {"slug": "shadow-protocol", "title": "Shadow Protocol: Bangalore Drift", "lang": "English", "is_national": True, "genres": ["Action", "Thriller"], "cert": "UA", "duration": 145},
    {"slug": "vajra-thunderborn", "title": "Vajra: The Thunderborn", "lang": "Telugu", "is_national": True, "genres": ["Action", "Mythology"], "cert": "UA", "duration": 162},
    {"slug": "redline-vendetta", "title": "Redline Vendetta: Velocity Zero", "lang": "Hindi", "is_national": True, "genres": ["Action", "Crime"], "cert": "A", "duration": 138},
    {"slug": "little-hanuman", "title": "Little Hanuman & The Sun Chaser", "lang": "Hindi", "is_national": True, "genres": ["Animation", "Adventure"], "cert": "U", "duration": 105},
    {"slug": "chronos-paradox", "title": "Chronos Paradox: Echoes of Tomorrow", "lang": "English", "is_national": True, "genres": ["Sci-Fi", "Mystery"], "cert": "UA", "duration": 140},
    {"slug": "zero-gravity-protocol", "title": "Zero Gravity Protocol", "lang": "English", "is_national": True, "genres": ["Sci-Fi", "Action"], "cert": "UA", "duration": 146},

    # Kannada Regional & Bilingual
    {"slug": "garuda-sky-guardian", "title": "Garuda: Sky Guardian of Vijayanagara", "lang": "Kannada", "is_national": False, "genres": ["Action", "Period"], "cert": "UA", "duration": 154},
    {"slug": "cauvery-breeze", "title": "Cauvery Breeze: A Coorg Melody", "lang": "Kannada", "is_national": False, "genres": ["Drama", "Romance"], "cert": "U", "duration": 132},
    {"slug": "bangalore-startups-samosas", "title": "Bangalore Startups & Samosas", "lang": "Kannada", "is_national": False, "genres": ["Comedy", "Drama"], "cert": "U", "duration": 124},
    {"slug": "the-forest-phantom", "title": "The Forest Phantom: Whispers of Malnad", "lang": "Kannada", "is_national": False, "genres": ["Horror", "Mystery"], "cert": "A", "duration": 135},
    {"slug": "kolar-gold-shadows", "title": "Kolar Gold Shadows", "lang": "Kannada", "is_national": False, "genres": ["Crime", "Drama"], "cert": "UA", "duration": 148},

    # Marathi Regional
    {"slug": "maharudra-rising", "title": "Maharudra: The Fortress of Valor", "lang": "Marathi", "is_national": False, "genres": ["History", "Action"], "cert": "UA", "duration": 160},
    {"slug": "pune-heritage-tales", "title": "Pune Heritage: Streets of Deccan Gymkhana", "lang": "Marathi", "is_national": False, "genres": ["Drama", "Family"], "cert": "U", "duration": 128},
    {"slug": "the-last-testimony", "title": "The Last Testimony of Fort Court", "lang": "Marathi", "is_national": False, "genres": ["Crime", "Courtroom"], "cert": "UA", "duration": 142},
    {"slug": "ghat-crematorium", "title": "Midnight at Sinhagad", "lang": "Marathi", "is_national": False, "genres": ["Horror", "Thriller"], "cert": "A", "duration": 118},
    {"slug": "mumbai-local-chronicles", "title": "Fast Local: 08:42 from Dadar", "lang": "Marathi", "is_national": False, "genres": ["Drama", "Slice of Life"], "cert": "U", "duration": 115},

    # Telugu Regional
    {"slug": "simhadri-roar", "title": "Simhadri Roar: The Rayalaseema Legend", "lang": "Telugu", "is_national": False, "genres": ["Action", "Drama"], "cert": "UA", "duration": 165},
    {"slug": "deccan-underworld", "title": "Deccan Underworld: King of Dhoolpet", "lang": "Telugu", "is_national": False, "genres": ["Crime", "Thriller"], "cert": "A", "duration": 150},
    {"slug": "charminar-chords", "title": "Charminar Chords: Old City Symphony", "lang": "Telugu", "is_national": False, "genres": ["Musical", "Romance"], "cert": "U", "duration": 139},
    {"slug": "babus-big-idea", "title": "Babu's Big Idea: Nizam Comedy", "lang": "Telugu", "is_national": False, "genres": ["Comedy"], "cert": "U", "duration": 126},
    {"slug": "godavari-monsoon-diary", "title": "Godavari Monsoon Diary", "lang": "Telugu", "is_national": False, "genres": ["Drama", "Romance"], "cert": "U", "duration": 134},

    # Tamil Regional
    {"slug": "madras-syndicate", "title": "Madras Syndicate: North Chennai War", "lang": "Tamil", "is_national": False, "genres": ["Action", "Crime"], "cert": "A", "duration": 152},
    {"slug": "chennai-monsoons", "title": "Marina Breeze: A Chennai Love Story", "lang": "Tamil", "is_national": False, "genres": ["Romance", "Drama"], "cert": "U", "duration": 128},
    {"slug": "dosa-filter-coffee", "title": "Dosa & Filter Coffee: Triplicane Diaries", "lang": "Tamil", "is_national": False, "genres": ["Comedy", "Romance"], "cert": "U", "duration": 120},
    {"slug": "chola-secrets", "title": "Chola Secrets: The Buried Temple", "lang": "Tamil", "is_national": False, "genres": ["Mystery", "Adventure"], "cert": "UA", "duration": 155},
    {"slug": "echoes-of-malabar", "title": "Echoes of Malabar Coast", "lang": "Tamil", "is_national": False, "genres": ["Thriller", "Drama"], "cert": "UA", "duration": 130},

    # Bengali Regional
    {"slug": "bengal-tiger-detective", "title": "Bengal Tiger: Mystery of Sunderbans", "lang": "Bengali", "is_national": False, "genres": ["Mystery", "Thriller"], "cert": "UA", "duration": 140},
    {"slug": "howrah-bridge-sunset", "title": "Howrah Bridge Sunset: A College Street Romance", "lang": "Bengali", "is_national": False, "genres": ["Drama", "Romance"], "cert": "U", "duration": 130},
    {"slug": "fish-curry-football", "title": "Mohun Bagan vs East Bengal: Football Fever", "lang": "Bengali", "is_national": False, "genres": ["Comedy", "Sports"], "cert": "U", "duration": 125},
    {"slug": "the-magic-quill", "title": "The Magic Quill: Rabindra Fantasy", "lang": "Bengali", "is_national": False, "genres": ["Fantasy", "Family"], "cert": "U", "duration": 118},
    {"slug": "whispering-fog-darjeeling", "title": "Whispering Fog of Darjeeling", "lang": "Bengali", "is_national": False, "genres": ["Horror", "Mystery"], "cert": "A", "duration": 122},

    # Punjabi Regional
    {"slug": "punjab-express-action", "title": "Punjab Express: Border Patrol", "lang": "Punjabi", "is_national": False, "genres": ["Action", "Drama"], "cert": "UA", "duration": 145},
    {"slug": "fields-of-gold-malwa", "title": "Fields of Gold: A Malwa Harvest", "lang": "Punjabi", "is_national": False, "genres": ["Drama", "Family"], "cert": "U", "duration": 150},
    {"slug": "jatt-in-london-laugh", "title": "Jatt in London: Desi Chaos", "lang": "Punjabi", "is_national": False, "genres": ["Comedy"], "cert": "U", "duration": 132},
    {"slug": "bullet-yaari-clash", "title": "Bullet Yaari: Campus Swagger", "lang": "Punjabi", "is_national": False, "genres": ["Action", "Youth"], "cert": "UA", "duration": 136},
    {"slug": "chandigarh-nights", "title": "Sector 17: Chandigarh Nights", "lang": "Punjabi", "is_national": False, "genres": ["Romance", "Drama"], "cert": "U", "duration": 126},

    # Malayalam Regional / Crossover
    {"slug": "wayanad-rain-shadow", "title": "Wayanad Rain: Echo of the Western Ghats", "lang": "Malayalam", "is_national": False, "genres": ["Drama", "Thriller"], "cert": "UA", "duration": 138},
    {"slug": "midnight-train-kozhikode", "title": "Midnight Express to Kozhikode", "lang": "Malayalam", "is_national": False, "genres": ["Suspense", "Mystery"], "cert": "UA", "duration": 120},
    {"slug": "kochi-harbor-noir", "title": "Kochi Harbor Noir", "lang": "Malayalam", "is_national": False, "genres": ["Crime", "Neo-noir"], "cert": "A", "duration": 144},

    # Hindi Mainstream / Crossover
    {"slug": "gully-hustle-dharavi", "title": "Gully Hustle: Beat of Mumbai", "lang": "Hindi", "is_national": False, "genres": ["Musical", "Drama"], "cert": "UA", "duration": 135},
    {"slug": "haveli-of-haunting", "title": "Haveli of Haunting: Rajasthan Ghost Story", "lang": "Hindi", "is_national": False, "genres": ["Horror"], "cert": "A", "duration": 125},
    {"slug": "mirage-in-thar", "title": "Mirage in Thar: Operation Falcon", "lang": "Hindi", "is_national": False, "genres": ["Spy", "Thriller"], "cert": "UA", "duration": 140},
    {"slug": "delhi-6-weddings", "title": "Big Fat Chandni Chowk Wedding", "lang": "Hindi", "is_national": False, "genres": ["Romance", "Comedy"], "cert": "U", "duration": 130},
    {"slug": "banaras-ghat-serenade", "title": "Banaras Sunset: A Spiritual Journey", "lang": "Hindi", "is_national": False, "genres": ["Drama"], "cert": "U", "duration": 128},

    # English / International / Crossover
    {"slug": "silicon-horizon", "title": "Silicon Horizon: AI Takeover", "lang": "English", "is_national": False, "genres": ["Sci-Fi", "Cyberpunk"], "cert": "UA", "duration": 142},
    {"slug": "solaris-reborn", "title": "Solaris Reborn: Deep Space Echoes", "lang": "English", "is_national": False, "genres": ["Sci-Fi", "Drama"], "cert": "A", "duration": 158},
    {"slug": "speedway-racers-3d", "title": "Speedway Racers: Grand Prix Nitro", "lang": "English", "is_national": False, "genres": ["Animation", "Action"], "cert": "U", "duration": 98},
    {"slug": "cyber-knight-2099", "title": "Cyber Knight 2099", "lang": "English", "is_national": False, "genres": ["Animation", "Sci-Fi"], "cert": "UA", "duration": 112},
]

print(f"Total Movies: {len(ALL_MOVIES)}")

def get_city_movies(city_slug: str) -> List[str]:
    # 7-8 National releases shared across all cities
    national = [m["slug"] for m in ALL_MOVIES if m["is_national"]]
    
    # Regional slots tailored by city
    regional_map = {
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
    
    city_lineup = list(national) + regional_map.get(city_slug, [])
    return city_lineup

city_lineups = {c["slug"]: set(get_city_movies(c["slug"])) for c in CITIES}

print("\n--- City Lineups Counts ---")
for city, movies in city_lineups.items():
    print(f"{city}: {len(movies)} movies now showing")

print("\n--- Pairwise Jaccard Similarities (Must be between 35% and 65%) ---")
similarities = []
violating = []
city_list = list(city_lineups.keys())
for i in range(len(city_list)):
    for j in range(i + 1, len(city_list)):
        c1 = city_list[i]
        c2 = city_list[j]
        s1 = city_lineups[c1]
        s2 = city_lineups[c2]
        inter = len(s1.intersection(s2))
        union = len(s1.union(s2))
        sim = inter / union
        similarities.append((c1, c2, sim))
        status = "OK" if 0.35 <= sim <= 0.65 else "FAIL"
        print(f"{c1} vs {c2}: inter={inter}, union={union}, sim={sim:.1%} [{status}]")
        if not (0.35 <= sim <= 0.65):
            violating.append((c1, c2, sim))

print(f"\nTotal pairs tested: {len(similarities)}")
print(f"Violations: {len(violating)}")
if violating:
    print("Violations detail:", violating)
else:
    print("ALL PAIRS SATISFY 35% <= similarity <= 65%!")
