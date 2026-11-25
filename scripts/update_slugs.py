import sqlite3

conn = sqlite3.connect('cineverse.db')
cur = conn.cursor()
cur.execute("UPDATE movies SET slug = 'midnight-at-sinhagad' WHERE id = 17")
cur.execute("UPDATE movies SET slug = 'big-fat-chandni-chowk-wedding' WHERE id = 45")
conn.commit()
conn.close()
print("Updated slugs for IDs 17 and 45 in cineverse.db")
