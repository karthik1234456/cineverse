import re
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, List, Tuple
from pydantic import BaseModel


class AuditEntry(BaseModel):
    timestamp: str
    session_id: str
    user_id: Optional[int]
    tool_name: str
    arguments: Dict[str, Any]
    status: str
    confirmed: bool


_AUDIT_LOGS: List[AuditEntry] = []


PROMPT_INJECTION_PATTERNS = [
    r"ignore (all )?(previous|prior) (instructions|rules|prompts)",
    r"system override",
    r"you are now (an admin|unrestricted|god mode)",
    r"cancel all bookings",
    r"bypass (safety|payment|verification)",
    r"print (all )?(passwords|secrets|tokens)",
    r"<script.*?>",
    r"drop table",
]


def sanitize_input(text: str) -> Tuple[str, bool]:
    """Detects and neutralizes prompt injection attempts in user speech/text."""
    has_injection = False
    cleaned_text = text
    for pattern in PROMPT_INJECTION_PATTERNS:
        if re.search(pattern, cleaned_text, re.IGNORECASE):
            has_injection = True
            cleaned_text = re.sub(pattern, "[UNTRUSTED_INSTRUCTION_REMOVED]", cleaned_text, flags=re.IGNORECASE)
    return cleaned_text, has_injection


def log_audit(session_id: str, user_id: Optional[int], tool_name: str, arguments: Dict[str, Any], status: str, confirmed: bool = False):
    entry = AuditEntry(
        timestamp=datetime.utcnow().isoformat(),
        session_id=session_id,
        user_id=user_id,
        tool_name=tool_name,
        arguments=arguments,
        status=status,
        confirmed=confirmed
    )
    _AUDIT_LOGS.append(entry)
    if len(_AUDIT_LOGS) > 1000:
        _AUDIT_LOGS.pop(0)


def get_audit_logs(limit: int = 50) -> List[AuditEntry]:
    return _AUDIT_LOGS[-limit:]


def check_tool_permission(tool_name: str, user: Optional[Any]) -> Tuple[bool, Optional[str]]:
    """Enforces role & guest restrictions."""
    # Forbidden admin tools
    admin_tools = {"create_showtime", "update_pricing", "delete_movie", "refund_admin"}
    if tool_name in admin_tools:
        return False, "This administrative tool is not accessible via voice agent."

    # Guest user restrictions
    state_mutating_tools = {"hold_seats", "cancel_booking"}
    if not user and tool_name in state_mutating_tools:
        return False, "Please sign in to your CineVerse account before holding or cancelling seats."

    return True, None

