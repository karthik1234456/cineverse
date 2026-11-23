import sqlite3
import shutil
import os

conn = sqlite3.connect('cineverse.db')
cur = conn.cursor()

# Check if Sample Showcase already exists
cur.execute('SELECT id, title, trailer_url, hosted_trailer_url FROM movies WHERE title = ?', ('Sample Showcase',))
row = cur.fetchone()
if not row:
    cur.execute("""
        INSERT INTO movies (
            title, slug, synopsis, poster_url, banner_url,
            trailer_url, hosted_trailer_url, hosted_trailer_webm_url,
            duration_minutes, certificate, release_date, is_now_showing,
            is_coming_soon, rating_avg, rating_count, interested_count,
            languages, genres, formats, is_tmdb, is_showcase, source,
            trailer_embeddable, trailer_reason, trailer_rights_holder, trailer_license_note,
            trailer_source_type
        ) VALUES (
            'Sample Showcase', 'sample-showcase', 'A verified sample open-licence hosted showcase trailer for testing cinema audio-visual playback.',
            '/posters/quantum-odyssey.jpg', '/banners/quantum-odyssey.jpg',
            '/trailers/sample-showcase.mp4', '/trailers/sample-showcase.mp4', '/trailers/sample-showcase.mp4',
            120, 'U', '2026-01-01', 1,
            0, 5.0, 100, 50,
            '["English"]', '["Demo", "Sci-Fi"]', '["2D", "3D"]', 0, 1, 'showcase',
            1, 'Known-good open licence hosted MP4 video', 'CineVerse Open Media', 'CC-BY-4.0 Open License',
            'hosted'
        )
    """)
    movie_id = cur.lastrowid
    print(f'Inserted Sample Showcase movie with id {movie_id}')
else:
    movie_id = row[0]
    cur.execute("""
        UPDATE movies
        SET trailer_url = '/trailers/sample-showcase.mp4',
            hosted_trailer_url = '/trailers/sample-showcase.mp4',
            hosted_trailer_webm_url = '/trailers/sample-showcase.mp4',
            trailer_embeddable = 1,
            trailer_reason = 'Known-good open licence hosted MP4 video',
            trailer_source_type = 'hosted'
        WHERE id = ?
    """, (movie_id,))
    print(f'Updated Sample Showcase movie id {movie_id}')

# Ensure showtime exists: Cinema 1, Auditorium 1, showtime id 9999
cur.execute('SELECT id FROM showtimes WHERE id = 9999')
if not cur.fetchone():
    cur.execute("""
        INSERT INTO showtimes (
            id, movie_id, auditorium_id, cinema_id, start_time, end_time, format, language, status
        ) VALUES (
            9999, ?, 1, 1, '2026-11-25 18:00:00', '2026-11-25 20:00:00', '2D', 'English', 'SCHEDULED'
        )
    """, (movie_id,))
    print('Inserted showtime 9999 for Sample Showcase')
else:
    cur.execute('UPDATE showtimes SET movie_id = ? WHERE id = 9999', (movie_id,))
    print(f'Updated showtime 9999 with movie_id {movie_id}')

conn.commit()
conn.close()
