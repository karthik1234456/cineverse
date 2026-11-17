import os
import sys
import json
import sqlite3
import urllib.request
import urllib.error

DB_PATH = 'd:/projects/CineVerse/cineverse.db'
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

c.execute('''
    SELECT id, title, tmdb_id, is_tmdb, trailer_url, youtube_trailer_id, trailer_embeddable
    FROM movies
    ORDER BY id
''')
movies = c.fetchall()

readiness = []

for m in movies:
    m_id, title, tmdb_id, is_tmdb, trailer_url, yt_id, trailer_embed = m
    
    # Strategy determination
    if trailer_url and ('/trailers/' in trailer_url or trailer_url.endswith('.mp4') or 'googleapis.com' in trailer_url):
        strategy = 'video_texture'
        reason = 'Self-hosted MP4/WebM video asset'
        trailer_type = 'Hosted Video'
        embed_status = 'PASS (Hosted)'
    elif yt_id:
        # Check oEmbed live status
        try:
            req = urllib.request.Request(
                f'https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={yt_id}&format=json',
                headers={'User-Agent': 'Mozilla/5.0'}
            )
            with urllib.request.urlopen(req, timeout=3.0) as resp:
                if resp.status == 200:
                    strategy = 'youtube_css3d'
                    reason = 'oEmbed 200 OK — Embeddable on 3D screen'
                    trailer_type = 'Official YouTube'
                    embed_status = 'PASS (Embeddable)'
                else:
                    strategy = 'theatre_mode'
                    reason = f'oEmbed returned HTTP {resp.status} — Owner restricted embedding (Error 150/153)'
                    trailer_type = 'Restricted YouTube'
                    embed_status = f'FALLBACK (HTTP {resp.status})'
        except urllib.error.HTTPError as e:
            strategy = 'theatre_mode'
            reason = f'oEmbed HTTP {e.code} ({e.reason}) — Embedding restricted by copyright owner (Error 150/153)'
            trailer_type = 'Restricted YouTube'
            embed_status = f'FALLBACK (HTTP {e.code})'
        except Exception as e:
            strategy = 'theatre_mode'
            reason = f'Network lookup error: {str(e)}'
            trailer_type = 'YouTube (Unreachable)'
            embed_status = 'FALLBACK (Network Error)'
    else:
        strategy = 'title_card'
        reason = 'No trailer video available in TMDB catalog'
        trailer_type = 'None'
        embed_status = 'N/A (Title Card Only)'

    readiness.append({
        'id': m_id,
        'title': title,
        'tmdb_id': tmdb_id,
        'is_tmdb': bool(is_tmdb),
        'trailer_type': trailer_type,
        'youtube_id': yt_id,
        'trailer_url': trailer_url,
        'trailer_embeddable': bool(trailer_embed),
        'strategy': strategy,
        'embed_status': embed_status,
        'reason': reason
    })

os.makedirs('evidence/real-screen-trailers', exist_ok=True)
with open('evidence/real-screen-trailers/movie_readiness_table.json', 'w') as f:
    json.dump(readiness, f, indent=2)

# Summaries
total = len(readiness)
real_movies = [m for m in readiness if m['is_tmdb']]
real_on_screen = [m for m in real_movies if m['strategy'] == 'youtube_css3d']
real_theatre_fallback = [m for m in real_movies if m['strategy'] == 'theatre_mode']
real_title_card = [m for m in real_movies if m['strategy'] == 'title_card']
hosted_movies = [m for m in readiness if m['strategy'] == 'video_texture']

print(f"Total Movies in Catalog: {total}")
print(f"Total Real Movies (TMDB): {len(real_movies)}")
print(f"  -> Real Movies Playing Directly on 3D Screen (youtube_css3d): {len(real_on_screen)}")
print(f"  -> Real Movies Falling Back to Theatre Mode (restricted): {len(real_theatre_fallback)}")
print(f"  -> Real Movies on Title Card (no trailer): {len(real_title_card)}")
print(f"Showcase / Hosted Texture Movies: {len(hosted_movies)}")
