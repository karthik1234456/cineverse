import sys
import os
import sqlite3
import json
import subprocess
sys.path.insert(0, os.path.abspath('backend'))

from app.services.catalog.tmdb import check_youtube_video_details

conn = sqlite3.connect('backend/cineverse.db')
cur = conn.cursor()
cur.execute("SELECT id, title, trailer_url, youtube_trailer_id, trailer_embeddable, is_showcase, source FROM movies")
movies = cur.fetchall()

print(f"Total movies in DB: {len(movies)}")

stats = {"hosted": 0, "youtube": 0, "none": 0}
for m in movies:
    mid, title, t_url, yt_id, is_emb, is_sc, src = m
    if t_url and (t_url.endswith('.mp4') or t_url.endswith('.webm') or t_url.startswith('/trailers/')):
        stats["hosted"] += 1
    elif yt_id or (t_url and 'youtube' in t_url):
        stats["youtube"] += 1
    else:
        stats["none"] += 1

print("Stats:", stats)
