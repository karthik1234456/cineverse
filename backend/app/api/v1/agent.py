import uuid
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.auth import User, RoleEnum
from app.services.auth_service import get_current_user
from app.agent.interfaces import AgentMessage, AgentResponse, UIAction
from app.agent.providers import MultilingualLocalNLPProvider
from app.agent.tools import TOOL_DEFINITIONS
from app.agent.safety import get_audit_logs, log_audit
from app.services.hold_service import hold_seats as db_hold_seats
from app.services.payment_service import cancel_booking as db_cancel_booking


router = APIRouter()


class SessionCreateRequest(BaseModel):
    language: str = "en"
    client_context: Optional[Dict[str, Any]] = None


class SessionResponse(BaseModel):
    session_id: str
    language: str
    welcome_message: str


class MessageRequest(BaseModel):
    session_id: str
    message: str
    language: str = "en"
    client_context: Optional[Dict[str, Any]] = None


class ActionConfirmRequest(BaseModel):
    session_id: str
    action_token: str
    card_type: str
    parameters: Dict[str, Any]


# Session store in memory / Redis fallback
_SESSIONS: Dict[str, Dict[str, Any]] = {}
_ACTION_TOKENS: Dict[str, Dict[str, Any]] = {}


@router.post("/session", response_model=SessionResponse)
async def create_agent_session(
    req: SessionCreateRequest,
    current_user: Optional[User] = Depends(get_current_user)
):
    session_id = f"sess_{uuid.uuid4().hex[:12]}"
    welcome = {
        "en": "Hello! I am CineVerse Voice Assistant. You can ask me to find movies, check showtimes, preview 3D seat views, or suggest the best seats.",
        "hi": "नमस्ते! मैं सिनेवर्स वॉइस असिस्टेंट हूँ। आप मुझसे फिल्में खोजने, शो का समय देखने, या 3D सीट का नज़ारा देखने के लिए कह सकते हैं।",
        "kn": "ನಮಸ್ಕಾರ! ನಾನು ಸಿನೆವರ್ಸ್ ವಾಯ್ಸ್ ಅಸಿಸ್ಟೆಂಟ್. ಚಲನಚಿತ್ರಗಳನ್ನು ಹುಡುಕಲು ಅಥವಾ 3D ಆಸನ ನೋಟವನ್ನು ನೋಡಲು ನೀವು ನನ್ನನ್ನು ಕೇಳಬಹುದು."
    }.get(req.language, "en")

    _SESSIONS[session_id] = {
        "user_id": current_user.id if current_user else None,
        "language": req.language,
        "created_at": str(uuid.uuid4())
    }

    return SessionResponse(
        session_id=session_id,
        language=req.language,
        welcome_message=welcome
    )


@router.post("/message", response_model=AgentResponse)
async def handle_agent_message(
    req: MessageRequest,
    current_user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    session = _SESSIONS.get(req.session_id)
    if not session:
        # Create session on the fly
        _SESSIONS[req.session_id] = {"user_id": current_user.id if current_user else None, "language": req.language}

    provider = MultilingualLocalNLPProvider(db)
    messages = [AgentMessage(role="user", content=req.message)]

    user_context = {
        "session_id": req.session_id,
        "user": current_user,
        "client_context": req.client_context or {}
    }

    response = await provider.generate_reply(
        messages=messages,
        tools=TOOL_DEFINITIONS,
        language=req.language,
        user_context=user_context
    )

    # Store action token if confirmation card was emitted
    if response.confirmation_card:
        _ACTION_TOKENS[response.confirmation_card.action_token] = {
            "session_id": req.session_id,
            "user_id": current_user.id if current_user else None,
            "card_type": response.confirmation_card.card_type,
            "details": response.confirmation_card.details
        }

    return response


@router.post("/confirm-action")
async def confirm_action(
    req: ActionConfirmRequest,
    current_user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stored = _ACTION_TOKENS.get(req.action_token)
    if not stored:
        raise HTTPException(status_code=400, detail="Invalid or expired action confirmation token")

    card_type = stored["card_type"]
    details = stored["details"]

    if card_type == "HOLD_SEATS":
        # Check that user is signed in
        user_id = current_user.id if current_user else stored.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Please sign in to confirm this seat hold")

        showtime_id = details["showtime_id"]
        seats = details["seats"]

        hold_result = await db_hold_seats(
            db=db,
            showtime_id=showtime_id,
            seat_ids=seats,
            user_id=user_id
        )

        log_audit(req.session_id, user_id, "hold_seats", details, "CONFIRMED", confirmed=True)
        del _ACTION_TOKENS[req.action_token]

        return {
            "status": "success",
            "message": f"Seats {', '.join(seats)} held successfully for 5 minutes.",
            "hold_id": hold_result["hold_id"],
            "expires_at": hold_result["expires_at"]
        }

    elif card_type == "CANCEL_BOOKING":
        user_id = current_user.id if current_user else stored.get("user_id")
        booking_id = details["booking_id"]

        cancel_result = await db_cancel_booking(db=db, booking_id=booking_id, user_id=user_id)
        log_audit(req.session_id, user_id, "cancel_booking", details, "CONFIRMED", confirmed=True)
        del _ACTION_TOKENS[req.action_token]

        return {
            "status": "success",
            "message": cancel_result.get("message", "Booking cancelled successfully with refund."),
            "refund_amount": cancel_result.get("refund_amount")
        }

    raise HTTPException(status_code=400, detail=f"Unsupported action card type: {card_type}")


@router.get("/audit-logs")
async def read_agent_audit_logs(
    current_user: User = Depends(get_current_user)
):
    # Only authenticated admin or manager can review agent audit logs
    if not current_user or current_user.role not in (RoleEnum.ADMIN, RoleEnum.CINEMA_MANAGER):
        raise HTTPException(status_code=403, detail="Unauthorized to inspect agent audit logs")
    return get_audit_logs()
