from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base


class City(Base):
    __tablename__ = "cities"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False)
    slug = Column(String(100), unique=True, index=True, nullable=False)
    state = Column(String(100), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    cinemas = relationship("Cinema", back_populates="city")


class Cinema(Base):
    __tablename__ = "cinemas"

    id = Column(Integer, primary_key=True, index=True)
    city_id = Column(Integer, ForeignKey("cities.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(200), index=True, nullable=False)
    slug = Column(String(200), index=True, nullable=False)
    address = Column(String(500), nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    cancellation_policy = Column(String(1000), default="Cancellation available up to 2 hours before showtime. 75% refund.")
    facilities = Column(JSON, default=list)  # ["Parking", "Dolby Atmos", "Recliners", "Food Court"]
    images = Column(JSON, default=list)

    city = relationship("City", back_populates="cinemas")
    auditoriums = relationship("Auditorium", back_populates="cinema")
    showtimes = relationship("Showtime", back_populates="cinema")


class Auditorium(Base):
    __tablename__ = "auditoriums"

    id = Column(Integer, primary_key=True, index=True)
    cinema_id = Column(Integer, ForeignKey("cinemas.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)  # "Screen 1 - 3D Experience"
    screen_type = Column(String(50), default="IMAX 3D")  # IMAX 3D, 4DX, Dolby Atmos, Standard
    total_seats = Column(Integer, default=100)
    has_3d_preview = Column(Boolean, default=False)
    layout_data = Column(JSON, nullable=True)

    cinema = relationship("Cinema", back_populates="auditoriums")
    seats = relationship("Seat", back_populates="auditorium")
    theatre_assets = relationship("TheatreAsset", back_populates="auditorium", uselist=False)
    showtimes = relationship("Showtime", back_populates="auditorium")


class TheatreAsset(Base):
    __tablename__ = "theatre_assets"

    id = Column(Integer, primary_key=True, index=True)
    auditorium_id = Column(Integer, ForeignKey("auditoriums.id", ondelete="CASCADE"), unique=True, nullable=False)
    glb_path = Column(String(500), nullable=False)
    layout_path = Column(String(500), nullable=False)
    version = Column(String(20), default="2.0")
    checksum = Column(String(64), nullable=True)
    total_triangles = Column(Integer, default=218000)
    created_at = Column(DateTime, default=datetime.utcnow)

    auditorium = relationship("Auditorium", back_populates="theatre_assets")


class Seat(Base):
    __tablename__ = "seats"

    id = Column(Integer, primary_key=True, index=True)
    auditorium_id = Column(Integer, ForeignKey("auditoriums.id", ondelete="CASCADE"), nullable=False, index=True)
    seat_id = Column(String(10), nullable=False, index=True)  # e.g., "A01"
    row = Column(String(5), nullable=False)                   # e.g., "A"
    number = Column(Integer, nullable=False)                  # e.g., 1
    category = Column(String(50), nullable=False)             # "Front", "Prime", "Premier"
    node_name = Column(String(50), nullable=False)            # "seat_A_01"
    eye_x = Column(Float, default=0.0)
    eye_y = Column(Float, default=1.2)
    eye_z = Column(Float, default=5.0)
    distance_to_screen = Column(Float, default=10.0)
    vertical_angle_deg = Column(Float, default=0.0)
    horizontal_angle_deg = Column(Float, default=0.0)
    is_accessible = Column(Boolean, default=False)

    auditorium = relationship("Auditorium", back_populates="seats")

