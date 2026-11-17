import sqlite3

con = sqlite3.connect('backend/cineverse.db')
cur = con.cursor()
print('Auditoriums:')
for row in cur.execute('SELECT id, cinema_id, name, total_seats, screen_type FROM auditoriums WHERE id IN (35, 36, 39)'):
    print(row)

print('\nShowtimes for 1875, 737, 732:')
for row in cur.execute('SELECT id, auditorium_id, cinema_id, movie_id, start_time, format FROM showtimes WHERE id IN (1875, 737, 732)'):
    print(row)
