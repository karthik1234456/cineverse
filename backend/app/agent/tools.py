import json
import uuid
import math
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from sqlalchemy.orm import selectinload

from app.models.movie import Movie, Review
from app.models.cinema import Cinema, Auditorium, Seat
from app.models.showtime import Showtime, SeatInventory, SeatStatusEnum
from app.models.booking import Booking, BookingSeat, Ticket, BookingStatusEnum
from app.models.promotion import Coupon
from app.models.auth import User
from app.services.hold_service import hold_seats as db_hold_seats
from app.services.booking_service import validate_coupon
from app.services.payment_service import cancel_booking as db_cancel_booking
from app.services.ticket_service import generate_ticket_signature, generate_qr_data, generate_qr_code_base64
from app.agent.safety import log_audit, check_tool_permission


# Central Tool Definitions for Schema Inspection
TOOL_DEFINITIONS = [
    {
        "name": "search_movies",
        "description": "Search for movies playing or coming soon by title, genre, language, or actor.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search keyword (e.g. 'sci-fi', 'quantum', 'action')"},
                "language": {"type": "string", "description": "Language filter ('English', 'Hindi', 'Kannada')"},
                "genre": {"type": "string", "description": "Genre filter (e.g. 'Action', 'Sci-Fi')"}
            }
        }
    },
    {
        "name": "get_movie",
        "description": "Fetch detailed information, synopsis, rating, cast, and trailer for a specific movie.",
        "parameters": {
            "type": "object",
            "properties": {
                "movie_id": {"type": "integer", "description": "Movie ID"}
            },
            "required": ["movie_id"]
        }
    },
    {
        "name": "get_showtimes",
        "description": "Get available showtimes, screen formats (IMAX 3D, Dolby Atmos), and cinemas for a movie.",
        "parameters": {
            "type": "object",
            "properties": {
                "movie_id": {"type": "integer", "description": "Movie ID"},
                "date": {"type": "string", "description": "Date in YYYY-MM-DD (optional, defaults to today)"}
            },
            "required": ["movie_id"]
        }
    },
    {
        "name": "suggest_seats",
        "description": "Suggest the best available seats based on optimal sightline distance and visual angle. Follows 3D honesty rules (never guarantees unobstructed).",
        "parameters": {
            "type": "object",
            "properties": {
                "showtime_id": {"type": "integer", "description": "Showtime ID"},
                "count": {"type": "integer", "description": "Number of seats desired (default 2)"},
                "category": {"type": "string", "description": "Preferred tier: 'Premier', 'Prime', 'Front'"}
            },
            "required": ["showtime_id"]
        }
    },
    {
        "name": "preview_seat_3d",
        "description": "Command the 3D theatre viewer to change camera POV to a specific seat.",
        "parameters": {
            "type": "object",
            "properties": {
                "seat_id": {"type": "string", "description": "Seat identifier (e.g. 'E05', 'J10', 'A05')"},
                "showtime_id": {"type": "integer", "description": "Showtime ID"}
            },
            "required": ["seat_id"]
        }
    },
    {
        "name": "compare_seats_3d",
        "description": "Trigger the 3D side-by-side or split sightline comparison between two seats.",
        "parameters": {
            "type": "object",
            "properties": {
                "seat_a": {"type": "string", "description": "First seat ID (e.g. 'E05')"},
                "seat_b": {"type": "string", "description": "Second seat ID (e.g. 'F05')"},
                "showtime_id": {"type": "integer", "description": "Showtime ID"}
            },
            "required": ["seat_a", "seat_b"]
        }
    },
    {
        "name": "navigate_3d",
        "description": "Perform virtual walking or camera movement within the 3D auditorium (walk to row, sit down, stand up, look at screen).",
        "parameters": {
            "type": "object",
            "properties": {
                "action": {"type": "string", "enum": ["walkToSeat", "sitAt", "standUp", "teleportToRow", "lookAtScreen"]},
                "target": {"type": "string", "description": "Row letter (e.g. 'F') or seat ID (e.g. 'E05')"}
            },
            "required": ["action"]
        }
    },
    {
        "name": "prepare_seat_hold",
        "description": "Prepares a seat hold for user confirmation. Non-negotiable safety rule: Requires user to tap confirmation card.",
        "parameters": {
            "type": "object",
            "properties": {
                "showtime_id": {"type": "integer", "description": "Showtime ID"},
                "seat_ids": {"type": "array", "items": {"type": "string"}, "description": "List of seat IDs to hold"}
            },
            "required": ["showtime_id", "seat_ids"]
        }
    },
    {
        "name": "apply_coupon",
        "description": "Apply a promotional coupon code to the booking.",
        "parameters": {
            "type": "object",
            "properties": {
                "code": {"type": "string", "description": "Coupon code (e.g. 'FIRSTSHOW', 'CINEVERSE50')"}
            },
            "required": ["code"]
        }
    },
    {
        "name": "prepare_booking_cancellation",
        "description": "Prepares booking cancellation and calculates 75% refund. Non-negotiable safety rule: Cancellation always requires a tap, never voice alone.",
        "parameters": {
            "type": "object",
            "properties": {
                "booking_id": {"type": "integer", "description": "Booking ID to cancel"}
            },
            "required": ["booking_id"]
        }
    },
    {
        "name": "get_ticket",
        "description": "Retrieve QR admission token and status for a confirmed booking.",
        "parameters": {
            "type": "object",
            "properties": {
                "booking_id": {"type": "integer", "description": "Booking ID"}
            },
            "required": ["booking_id"]
        }
    },
    {
        "name": "faq_lookup",
        "description": "Answer user questions regarding cinema policies, 3D glasses, F&B, cancellation rules, parking, or accessibility.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Question keyword"}
            },
            "required": ["query"]
        }
    }
]


# Tool Implementations
async def tool_search_movies(db: AsyncSession, query: Optional[str] = None, language: Optional[str] = None, genre: Optional[str] = None) -> Dict[str, Any]:
    stmt = select(Movie)
    if query:
        stmt = stmt.where(
            or_(
                Movie.title.ilike(f"%{query}%"),
                Movie.synopsis.ilike(f"%{query}%")
            )
        )

    res = await db.execute(stmt)
    movies = res.scalars().all()

    return {
        "count": len(movies),
        "movies": [
            {
                "id": m.id,
                "title": m.title,
                "genre": m.genres[0] if (m.genres and len(m.genres) > 0) else "Sci-Fi",
                "language": m.languages[0] if (m.languages and len(m.languages) > 0) else "English",
                "formats": ", ".join(m.formats) if m.formats else "IMAX 3D",
                "rating": m.rating_avg,
                "duration_minutes": m.duration_minutes
            }
            for m in movies[:5]
        ]
    }


async def tool_get_movie(db: AsyncSession, movie_id: int) -> Dict[str, Any]:
    movie = await db.get(Movie, movie_id)
    if not movie:
        return {"error": "Movie not found"}
    return {
        "id": movie.id,
        "title": movie.title,
        "synopsis": movie.synopsis,
        "genre": movie.genres[0] if (movie.genres and len(movie.genres) > 0) else "Sci-Fi",
        "language": movie.languages[0] if (movie.languages and len(movie.languages) > 0) else "English",
        "formats": ", ".join(movie.formats) if movie.formats else "IMAX 3D",
        "rating": movie.rating_avg,
        "duration_minutes": movie.duration_minutes,
        "trailer_url": movie.trailer_url
    }


async def tool_get_showtimes(db: AsyncSession, movie_id: int, date: Optional[str] = None) -> Dict[str, Any]:
    stmt = (
        select(Showtime)
        .where(Showtime.movie_id == movie_id)
        .options(
            selectinload(Showtime.cinema),
            selectinload(Showtime.auditorium)
        )
        .order_by(Showtime.start_time.asc())
    )
    res = await db.execute(stmt)
    showtimes = res.scalars().all()

    return {
        "movie_id": movie_id,
        "showtimes": [
            {
                "showtime_id": st.id,
                "start_time": st.start_time.strftime("%I:%M %p"),
                "format": st.format,
                "language": st.language,
                "cinema_name": st.cinema.name if st.cinema else "CineVerse",
                "auditorium_name": st.auditorium.name if st.auditorium else "Auditorium 1",
                "has_3d_preview": st.auditorium.has_3d_preview if st.auditorium else True
            }
            for st in showtimes[:6]
        ]
    }


async def tool_suggest_seats(db: AsyncSession, showtime_id: int, count: int = 2, category: Optional[str] = None, preference: Optional[str] = "balanced") -> Dict[str, Any]:
    stmt = select(SeatInventory).where(SeatInventory.showtime_id == showtime_id)
    res = await db.execute(stmt)
    all_inventory = res.scalars().all()

    if not all_inventory:
        return {"error": "No seat inventory found for showtime", "suggested_seats": []}

    from app.services.seat_scoring import get_layout_seats, best_available

    layout_seats = get_layout_seats()
    inventory_status = {
        inv.seat_id: inv.status.value.lower()
        for inv in all_inventory
    }
    avail_map = {inv.seat_id: inv for inv in all_inventory}

    best = best_available(
        seats=layout_seats,
        status=inventory_status,
        n=count,
        preference=preference,
        category=category
    )

    if not best:
        return {
            "showtime_id": showtime_id,
            "suggested_seats": [],
            "message": "No suitable contiguous seats found for the requested count and preferences."
        }

    selected = best["seat_ids"]
    primary_seat = avail_map.get(selected[0]) if selected else None

    # 3D Honesty wording rule
    reasons_str = "; ".join(best["reasons"])
    return {
        "showtime_id": showtime_id,
        "suggested_seats": selected,
        "category": primary_seat.category if primary_seat else (category or "Prime"),
        "price_per_seat": primary_seat.price if primary_seat else 380.0,
        "avg_comfort_score": best["avg_score"],
        "reasons": best["reasons"],
        "view_assessment": f"Geometric estimate: {reasons_str}. Note: No audience members or physical heads modelled."
    }



def tool_faq_lookup(query: str) -> Dict[str, Any]:
    q = query.lower()
    if "glass" in q or "3d" in q:
        return {"answer": "High-clarity polarized RealD 3D glasses are sanitized and handed out at the entrance of Auditorium 1 free of additional charge."}
    if "cancel" in q or "refund" in q:
        return {"answer": "You can cancel confirmed bookings up to 2 hours before showtime for a 75% refund per cinema policy. Cancellations can be confirmed right in this chat."}
    if "snack" in q or "food" in q or "f&b" in q or "popcorn" in q:
        return {"answer": "You can add Caramel Popcorn, Nachos with Salsa, and Beverages to your booking. Food is delivered right to your seat before show start."}
    if "park" in q:
        return {"answer": "Complimentary valet and dedicated basement parking (B1 & B2) is available with cinema ticket validation."}
    return {"answer": "CineVerse features 4K Laser IMAX with 12-channel immersive sound, recliner seating, and 3D sightline seat previews."}
