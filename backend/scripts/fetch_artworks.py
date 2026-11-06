# backend/scripts/fetch_artworks.py
import os
import io
import urllib.request
from PIL import Image

POSTERS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "public", "posters"))
GENERATED_BACKDROP = r"C:\Users\KARTHIK\.gemini\antigravity\brain\b126ff79-e052-4efd-9d46-663877753dee\quantum_odyssey_backdrop_clean_1793929956506.jpg"

os.makedirs(POSTERS_DIR, exist_ok=True)

ARTWORK_SOURCES = [
    {
        "slug": "quantum_odyssey",
        "title": "Quantum Odyssey: Beyond the Singularity",
        "banner_url": None, # Use GENERATED_BACKDROP
        "banner_w": 1920,
        "banner_h": 1080,
        "poster_url": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&h=900&q=85",
        "poster_w": 600,
        "poster_h": 900,
    },
    {
        "slug": "astra",
        "title": "Astra: Chronicles of the Celestial Throne",
        "banner_url": "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1920&h=1080&q=85",
        "banner_w": 1920,
        "banner_h": 1080,
        "poster_url": "https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=600&h=900&q=85",
        "poster_w": 600,
        "poster_h": 900,
    },
    {
        "slug": "shadow_protocol",
        "title": "Shadow Protocol: Bangalore Drift",
        "banner_url": "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=1920&h=1080&q=85",
        "banner_w": 1920,
        "banner_h": 1080,
        "poster_url": "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&h=900&q=85",
        "poster_w": 600,
        "poster_h": 900,
    },
    {
        "slug": "western_ghats",
        "title": "Echoes of the Western Ghats",
        "banner_url": "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1920&h=1080&q=85",
        "banner_w": 1920,
        "banner_h": 1080,
        "poster_url": "https://images.unsplash.com/photo-1511497584788-87676104235f?auto=format&fit=crop&w=600&h=900&q=85",
        "poster_w": 600,
        "poster_h": 900,
    },
    {
        "slug": "neon_metropolis",
        "title": "Neon Metropolis 2099",
        "banner_url": "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1920&h=1080&q=85",
        "banner_w": 1920,
        "banner_h": 1080,
        "poster_url": "https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=600&h=900&q=85",
        "poster_w": 600,
        "poster_h": 900,
    },
    {
        "slug": "last_kingdom",
        "title": "The Last Kingdom: Battle of Panipat",
        "banner_url": "https://images.unsplash.com/photo-1582650625119-3a31f8418365?auto=format&fit=crop&w=1920&h=1080&q=85",
        "banner_w": 1920,
        "banner_h": 1080,
        "poster_url": "https://images.unsplash.com/photo-1590077428593-a55bb07c4665?auto=format&fit=crop&w=600&h=900&q=85",
        "poster_w": 600,
        "poster_h": 900,
    },
    {
        "slug": "midnight_comedy",
        "title": "Midnight Comedy Club",
        "banner_url": "https://images.unsplash.com/photo-1570168007204-dfb528c6958f?auto=format&fit=crop&w=1920&h=1080&q=85",
        "banner_w": 1920,
        "banner_h": 1080,
        "poster_url": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=600&h=900&q=85",
        "poster_w": 600,
        "poster_h": 900,
    },
    {
        "slug": "solaris_fleet",
        "title": "Solaris Fleet: Mission Alpha",
        "banner_url": "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1920&h=1080&q=85",
        "banner_w": 1920,
        "banner_h": 1080,
        "poster_url": "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=600&h=900&q=85",
        "poster_w": 600,
        "poster_h": 900,
    },
    {
        "slug": "monsoon",
        "title": "Whispers of the Monsoon",
        "banner_url": "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=1920&h=1080&q=85",
        "banner_w": 1920,
        "banner_h": 1080,
        "poster_url": "https://images.unsplash.com/photo-1534067783941-51c9c23ecefd?auto=format&fit=crop&w=600&h=900&q=85",
        "poster_w": 600,
        "poster_h": 900,
    },
    {
        "slug": "inferno",
        "title": "Inferno: Mountain Rescue",
        "banner_url": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1920&h=1080&q=85",
        "banner_w": 1920,
        "banner_h": 1080,
        "poster_url": "https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?auto=format&fit=crop&w=600&h=900&q=85",
        "poster_w": 600,
        "poster_h": 900,
    },
    {
        "slug": "chakravyuh",
        "title": "Chakravyuh: The Heist of Mumbai",
        "banner_url": "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1920&h=1080&q=85",
        "banner_w": 1920,
        "banner_h": 1080,
        "poster_url": "https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=600&h=900&q=85",
        "poster_w": 600,
        "poster_h": 900,
    },
    {
        "slug": "forest_spirits",
        "title": "The Forest of Spirits",
        "banner_url": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1920&h=1080&q=85",
        "banner_w": 1920,
        "banner_h": 1080,
        "poster_url": "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&h=900&q=85",
        "poster_w": 600,
        "poster_h": 900,
    }
]

def download_and_save(url, target_path, target_size, fallback_banner_path=None):
    if os.path.exists(target_path) and os.path.getsize(target_path) > 50000:
        print(f"Already exists: {target_path} ({os.path.getsize(target_path)} bytes)")
        return

    success = False
    if url:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = resp.read()
            img = Image.open(io.BytesIO(data)).convert("RGB")
            img = img.resize(target_size, Image.Resampling.LANCZOS)
            img.save(target_path, "PNG", optimize=True)
            print(f"Saved {target_path} ({target_size[0]}x{target_size[1]}, {os.path.getsize(target_path)} bytes)")
            success = True
        except Exception as e:
            print(f"Error fetching {url}: {e}")

    if not success and fallback_banner_path and os.path.exists(fallback_banner_path):
        print(f"Creating {target_path} from fallback {fallback_banner_path}")
        img = Image.open(fallback_banner_path).convert("RGB")
        w, h = img.size
        # Center-crop to target aspect ratio
        target_aspect = target_size[0] / target_size[1] # e.g. 600/900 = 0.667
        current_aspect = w / h
        if current_aspect > target_aspect:
            new_w = int(h * target_aspect)
            left = (w - new_w) // 2
            img = img.crop((left, 0, left + new_w, h))
        else:
            new_h = int(w / target_aspect)
            top = (h - new_h) // 2
            img = img.crop((0, top, w, top + new_h))
        img = img.resize(target_size, Image.Resampling.LANCZOS)
        img.save(target_path, "PNG", optimize=True)
        print(f"Saved fallback {target_path} ({target_size[0]}x{target_size[1]}, {os.path.getsize(target_path)} bytes)")
        success = True

def process_all():
    print(f"Target directory: {POSTERS_DIR}")
    for item in ARTWORK_SOURCES:
        slug = item["slug"]
        banner_path = os.path.join(POSTERS_DIR, f"{slug}_banner.png")
        poster_path = os.path.join(POSTERS_DIR, f"{slug}.png")

        # Banner
        if item["banner_url"]:
            download_and_save(item["banner_url"], banner_path, (item["banner_w"], item["banner_h"]))
        elif os.path.exists(GENERATED_BACKDROP) and not (os.path.exists(banner_path) and os.path.getsize(banner_path) > 50000):
            img = Image.open(GENERATED_BACKDROP).convert("RGB")
            img = img.resize((item["banner_w"], item["banner_h"]), Image.Resampling.LANCZOS)
            img.save(banner_path, "PNG", optimize=True)
            print(f"Saved generated backdrop {banner_path} ({item['banner_w']}x{item['banner_h']}, {os.path.getsize(banner_path)} bytes)")

        # Poster
        download_and_save(item["poster_url"], poster_path, (item["poster_w"], item["poster_h"]), fallback_banner_path=banner_path)

if __name__ == "__main__":
    process_all()
