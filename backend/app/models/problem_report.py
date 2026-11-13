from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, JSON
from app.database import Base


class ProblemReport(Base):
    __tablename__ = "problem_reports"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    status = Column(String(50), default="open", index=True)  # open, in_progress, resolved, archived
    user_description = Column(Text, nullable=False)
    expected_behavior = Column(Text, nullable=True)

    screenshot_filename = Column(String(255), nullable=True)

    url = Column(String(500), nullable=False)
    route = Column(String(200), nullable=False, index=True)
    query_params = Column(JSON, default=dict)
    build_stamp = Column(String(100), nullable=True)

    auditorium_id = Column(String(50), nullable=True)
    showtime_id = Column(Integer, nullable=True)
    cinema_id = Column(Integer, nullable=True)
    mode = Column(String(50), nullable=True)  # overview (Look around), walk, seated (Sit)
    selected_seats = Column(JSON, default=list)

    console_logs = Column(JSON, default=list)  # last 50 messages, scrubbed
    network_requests = Column(JSON, default=list)  # last 20 failed/slow requests, scrubbed
    browser_info = Column(JSON, default=dict)
    render_metrics = Column(JSON, default=dict)

    reporter_ip = Column(String(100), nullable=True)
    admin_notes = Column(Text, nullable=True)

