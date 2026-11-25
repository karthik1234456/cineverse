import sqlite3
import os

for path in ["cineverse.db", "backend/cineverse.db"]:
    if os.path.exists(path):
        con = sqlite3.connect(path)
        cur = con.cursor()
        cols = [r[1] for r in cur.execute("PRAGMA table_info(movies)").fetchall()]
        if "is_showcase" not in cols:
            cur.execute("ALTER TABLE movies ADD COLUMN is_showcase BOOLEAN DEFAULT 0")
            print(f"Added is_showcase to {path}")
        if "source" not in cols:
            cur.execute("ALTER TABLE movies ADD COLUMN source VARCHAR(50) DEFAULT 'tmdb'")
            print(f"Added source to {path}")
        cur.execute("UPDATE movies SET is_showcase = 1, source = 'showcase', is_tmdb = 0 WHERE is_tmdb = 0 OR is_tmdb IS NULL")
        con.commit()
        print(f"Migrated {path}")
        con.close()
