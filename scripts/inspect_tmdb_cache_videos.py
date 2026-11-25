import os
import sys
sys.path.insert(0, os.getcwd())
sys.path.insert(0, os.path.abspath('backend'))

import json
from app.services.catalog.tmdb import CACHE_FILE_PATH

with open(CACHE_FILE_PATH, 'r', encoding='utf-8') as f:
    data = json.load(f)

print(f"Total cached movies in {CACHE_FILE_PATH}: {len(data)}")
for i, item in enumerate(data):
    title = item.get("title")
    videos = item.get("videos", {}).get("results", [])
    print(f"[{i+1}] {title} (TMDB ID: {item.get('id')}) -> {len(videos)} videos")
    for v in videos[:4]:
        print(f"    * Type: {v.get('type')}, Official: {v.get('official')}, Site: {v.get('site')}, Key: {v.get('key')}, Name: {v.get('name')[:35]}")
