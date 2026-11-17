import sqlite3, json

con = sqlite3.connect('D:/projects/CineVerse/cineverse.db')
cur = con.cursor()
cur.execute('''
SELECT a.id, a.name, a.cinema_id, c.name, sf.name, a.layout_data
FROM auditoriums a
JOIN cinemas c ON a.cinema_id = c.id
LEFT JOIN screen_formats sf ON a.screen_format_id = sf.id
''')
rows = cur.fetchall()

categories = {
    'standard_flat': [],
    'large_curved': [],
    'premium_direct_view': [],
    'motion_panoramic_wrap': [],
    'boutique': [],
    'original_100_seat': []
}

for r in rows:
    aud_id, aud_name, cin_id, cin_name, fmt_name, layout_json = r
    layout = json.loads(layout_json) if layout_json else {}
    screen = layout.get('screen', {}) if layout else {}
    theatre_type = layout.get('theatre_type', '')
    screen_type = screen.get('screen_type_id', '')
    is_curved = screen.get('curved') or screen.get('is_curved') or screen_type == 'large_curved'
    has_wrap = bool(screen.get('panoramic_wrap')) or screen_type == 'panoramic_wrap'
    is_direct = bool(screen.get('is_direct_led')) or screen_type == 'premium_direct_view' or (fmt_name and 'Direct' in fmt_name)
    total_seats = layout.get('total_seats') or (len(layout.get('rows', [])) * layout.get('seats_per_row', 10))

    cur.execute('SELECT id, movie_id FROM showtimes WHERE auditorium_id = ? LIMIT 3', (aud_id,))
    sts = cur.fetchall()

    item = {
        'aud_id': aud_id,
        'aud_name': aud_name,
        'cin_id': cin_id,
        'cin_name': cin_name,
        'format': fmt_name,
        'screen_type': screen_type,
        'theatre_type': theatre_type,
        'is_curved': is_curved,
        'has_wrap': has_wrap,
        'is_direct': is_direct,
        'total_seats': total_seats,
        'showtimes': sts
    }

    if has_wrap:
        categories['motion_panoramic_wrap'].append(item)
    elif is_direct:
        categories['premium_direct_view'].append(item)
    elif is_curved:
        categories['large_curved'].append(item)
    elif theatre_type == 'boutique' or 'Boutique' in (fmt_name or '') or 'Boutique' in aud_name:
        categories['boutique'].append(item)
    elif total_seats == 100 or '100' in aud_name or (total_seats >= 90 and total_seats <= 110):
        categories['original_100_seat'].append(item)
    else:
        categories['standard_flat'].append(item)

print('Summary of identified halls:')
for cat, items in categories.items():
    print(f'=== Category: {cat} (found {len(items)}) ===')
    for it in items[:3]:
        print(f"  Aud {it['aud_id']} ({it['aud_name']}) in Cinema {it['cin_id']} ({it['cin_name']}): Format={it['format']}, ScreenType={it['screen_type']}, Seats={it['total_seats']}, Showtimes={it['showtimes']}")

con.close()
