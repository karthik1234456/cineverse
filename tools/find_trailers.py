import urllib.request
import json
import urllib.parse
import os

titles = [
    ("quantum_odyssey", "File:Artemis III Announcement (Official NASA Trailer).webm"),
    ("astra", "File:2026 Total Solar Eclipse (Official NASA Trailer).webm"),
    ("shadow_protocol", "File:Big Buck Bunny Trailer 400p.ogv")
]

for key, title in titles:
    api = f"https://commons.wikimedia.org/w/api.php?action=query&titles={urllib.parse.quote(title)}&prop=imageinfo&iiprop=url|size|mime|derivatives&format=json"
    req = urllib.request.Request(api, headers={"User-Agent": "CineVerseEducational/1.0 (contact@cineverse.in)"})
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        page = next(iter(data["query"]["pages"].values()))
        info = page["imageinfo"][0]
        print(f"[{key}] {title}")
        print(f"  orig url: {info['url']}, size: {info.get('size')}")
        derivatives = info.get("derivatives", [])
        for d in derivatives:
            print(f"  deriv: {d.get('type')} {d.get('width')}p, size: {d.get('size')} -> {d.get('src')}")

