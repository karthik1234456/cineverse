from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.orm import relationship
from app.database import Base


class ScreenFormat(Base):
    __tablename__ = "screen_formats"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False)
    description = Column(String(255), nullable=True)
    requires_glasses = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    auditoriums = relationship("Auditorium", back_populates="screen_format")


class SoundSystem(Base):
    __tablename__ = "sound_systems"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False)
    description = Column(String(255), nullable=True)
    channels = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    auditoriums = relationship("Auditorium", back_populates="sound_system")


class ProjectionType(Base):
    __tablename__ = "projection_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False)
    description = Column(String(255), nullable=True)
    resolution = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    auditoriums = relationship("Auditorium", back_populates="projection_type")
