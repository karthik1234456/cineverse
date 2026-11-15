# backend/app/models/import_batch.py
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, JSON
from app.database import Base


class ImportBatch(Base):
    """
    Tracks CSV imports for real cinema data (cinemas, halls with layouts, shows and prices).
    Allows full validation audit and transactional undo of imported records.
    """
    __tablename__ = "import_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(64), unique=True, index=True, nullable=False)
    entity_type = Column(String(50), nullable=False)  # CINEMAS, HALLS, SHOWTIMES, UNIFIED
    filename = Column(String(255), nullable=False)
    total_rows = Column(Integer, default=0, nullable=False)
    valid_rows = Column(Integer, default=0, nullable=False)
    invalid_rows = Column(Integer, default=0, nullable=False)
    
    created_by_user_id = Column(Integer, nullable=True)
    status = Column(String(20), default="APPLIED", nullable=False)  # APPLIED, UNDONE
    
    # Store IDs of records created for undo:
    # {"cinema_ids": [...], "auditorium_ids": [...], "showtime_ids": [...]}
    created_ids = Column(JSON, default=dict)
    
    # Store error report per row:
    # [{"row": 1, "column": "start_time", "value": "...", "error": "..."}]
    error_report = Column(JSON, default=list)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    undone_at = Column(DateTime, nullable=True)
