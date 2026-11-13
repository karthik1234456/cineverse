import re
from typing import Any, Dict, List, Union

# Regex patterns for sensitive data
BEARER_REGEX = re.compile(r"Bearer\s+([a-zA-Z0-9_\-\.\+/=]+)", re.IGNORECASE)
JWT_REGEX = re.compile(r"eyJ[a-zA-Z0-9_\-]{10,}\.[a-zA-Z0-9_\-]{10,}\.?[a-zA-Z0-9_\-\+/=]*")
HEX_KEY_REGEX = re.compile(r"\b[0-9a-fA-F]{32}\b")
CARD_REGEX = re.compile(r"\b(?:\d{4}[ -]?){3}\d{4}\b")
EMAIL_REGEX = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b")
PASSWORD_KV_REGEX = re.compile(
    r"""(?i)(["']?(?:password|passwd|secret|token|api_key|authorization|cookie|session_id)["']?\s*[:=]\s*["']?)([^"',\s\}]+)(["']?)"""
)

SENSITIVE_KEYS = {
    "password", "passwd", "secret", "token", "access_token", "refresh_token",
    "api_key", "apikey", "authorization", "cookie", "set-cookie", "session_id",
    "credit_card", "card_number", "cvv", "card"
}


def scrub_string(text: str) -> str:
    """Scrub sensitive credentials, tokens, cards, and keys from a text string."""
    if not isinstance(text, str):
        return str(text)

    # 1. Bearer tokens
    text = BEARER_REGEX.sub("Bearer [REDACTED_TOKEN]", text)

    # 2. JWTs
    text = JWT_REGEX.sub("[REDACTED_JWT]", text)

    # 3. 32-char hex API keys
    text = HEX_KEY_REGEX.sub("[REDACTED_KEY]", text)

    # 4. Key-Value credentials (e.g. "password": "xyz")
    text = PASSWORD_KV_REGEX.sub(r"\1[REDACTED]\3", text)

    # 5. Credit card numbers
    text = CARD_REGEX.sub("[REDACTED_CARD]", text)

    # 6. Emails
    text = EMAIL_REGEX.sub("[REDACTED_EMAIL]", text)

    return text


def scrub_data(obj: Any) -> Any:
    """Recursively scrub sensitive information from dicts, lists, or primitive values."""
    if isinstance(obj, str):
        return scrub_string(obj)
    elif isinstance(obj, dict):
        clean_dict = {}
        for k, v in obj.items():
            key_lower = str(k).lower()
            if any(s in key_lower for s in SENSITIVE_KEYS):
                clean_dict[k] = "[REDACTED]"
            else:
                clean_dict[k] = scrub_data(v)
        return clean_dict
    elif isinstance(obj, (list, tuple, set)):
        return [scrub_data(item) for item in obj]
    return obj

