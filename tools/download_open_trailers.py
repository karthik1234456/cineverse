import os
import urllib.request

trailers_dir = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'public', 'trailers')
os.makedirs(trailers_dir, exist_ok=True)

downloads = [
    ("quantum_odyssey.webm", "https://upload.wikimedia.org/wikipedia/commons/e/ef/Artemis_III_Announcement_%28Official_NASA_Trailer%29.webm"),
    ("astra.webm", "https://upload.wikimedia.org/wikipedia/commons/c/ce/2026_Total_Solar_Eclipse_%28Official_NASA_Trailer%29.webm"),
    ("shadow_protocol.ogv", "https://upload.wikimedia.org/wikipedia/commons/b/b3/Big_Buck_Bunny_Trailer_400p.ogv")
]

for filename, url in downloads:
    target_path = os.path.join(trailers_dir, filename)
    if os.path.exists(target_path) and os.path.getsize(target_path) > 100000:
        print(f"Already exists: {filename} ({os.path.getsize(target_path)} bytes)")
        continue
    print(f"Downloading {filename} from {url}...")
    req = urllib.request.Request(url, headers={"User-Agent": "CineVerseEducational/1.0 (contact@cineverse.in)"})
    with urllib.request.urlopen(req) as resp, open(target_path, 'wb') as f:
        data = resp.read()
        f.write(data)
    print(f"Downloaded {filename}: {os.path.getsize(target_path)} bytes")

