import sqlite3
import json

conn = sqlite3.connect('d:/projects/CineVerse/cineverse.db')
c = conn.cursor()

c.execute('''
    SELECT a.id, a.cinema_id, a.name, a.screen_type, a.screen_format_id, a.total_seats, a.layout_data,
           s.id as showtime_id, m.title, m.youtube_trailer_id, m.trailer_embeddable
    FROM auditoriums a
    LEFT JOIN showtimes s ON s.auditorium_id = a.id
    LEFT JOIN movies m ON s.movie_id = m.id
    WHERE m.trailer_embeddable = 1 AND m.youtube_trailer_id IS NOT NULL
    ORDER BY a.id, s.id
''')

rows = c.fetchall()

seen_auds = set()
unique_rows = []
for r in rows:
    aid = r[0]
    if aid not in seen_auds:
        seen_auds.add(aid)
        unique_rows.append(r)

print(f"Total auds with embeddable showtime: {len(unique_rows)}")
for r in unique_rows:
    aid, cid, name, stype, sfmt, seats, ld_raw, sid, title, yt_id, embed = r
    ld = json.loads(ld_raw) if ld_raw else {}
    scr = ld.get('screen', {})
    ttype = ld.get('theatre_type')
    eq = ld.get('equipment_profile', {})
    print(f"Aud {aid:2d} (Cinema {cid}): {name:32s} | Type: {str(stype):15s} | Fmt: {str(sfmt):10s} | TType: {str(ttype):12s} | Seats: {seats:3d} | ST: {sid:3d} ({title})")
