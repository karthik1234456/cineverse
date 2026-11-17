import sqlite3

con = sqlite3.connect('D:/projects/CineVerse/cineverse.db')
cur = con.cursor()

movie_ids = [55, 51, 53, 54, 56, 70, 89]

for mid in movie_ids:
    cur.execute('''
    SELECT s.id, s.movie_id, m.title, m.youtube_trailer_id, m.trailer_url, s.auditorium_id, a.name, a.cinema_id, c.name, sf.name
    FROM showtimes s
    JOIN movies m ON s.movie_id = m.id
    JOIN auditoriums a ON s.auditorium_id = a.id
    JOIN cinemas c ON a.cinema_id = c.id
    LEFT JOIN screen_formats sf ON a.screen_format_id = sf.id
    WHERE s.movie_id = ?
    LIMIT 3
    ''', (mid,))
    rows = cur.fetchall()
    print(f'=== Movie {mid}: {rows[0][2] if rows else "No showtimes"} ===')
    for r in rows:
        st_id, m_id, title, yt_id, tr_url, aud_id, aud_name, cin_id, cin_name, fmt = r
        print(f'  Showtime {st_id} | Aud {aud_id} ({aud_name}) | Cinema {cin_id} ({cin_name}) | Format: {fmt} | YT: {yt_id}')

con.close()
