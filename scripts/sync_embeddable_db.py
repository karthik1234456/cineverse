import sqlite3

def run():
    con = sqlite3.connect('D:/projects/CineVerse/cineverse.db')
    cur = con.cursor()
    cur.execute("UPDATE movies SET trailer_embeddable = 1 WHERE trailer_url LIKE '%.mp4' OR trailer_url LIKE '%.webm'")
    cur.execute("UPDATE movies SET trailer_embeddable = 1 WHERE youtube_trailer_id IS NOT NULL AND youtube_trailer_id != ''")
    con.commit()

    cur.execute("SELECT COUNT(id), trailer_embeddable FROM movies GROUP BY trailer_embeddable")
    print('Summary by trailer_embeddable:', cur.fetchall())
    con.close()

if __name__ == '__main__':
    run()
