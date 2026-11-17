import sys
sys.path.insert(0, 'backend')
from app.database import SessionLocal
from app.models import Movie, Showtime

db = SessionLocal()
movies = db.query(Movie).filter(Movie.is_showcase == True).all()
print("SHOWCASE MOVIES:")
for m in movies[:5]:
    print(f"ID={m.id}, Title={m.title}, Trailer={m.trailer_url}")
    sts = db.query(Showtime).filter(Showtime.movie_id == m.id).limit(3).all()
    for s in sts:
        print(f"   Showtime {s.id} in Cinema {s.cinema_id}, Audi {s.auditorium_id}")
