import hmac
import hashlib
import json
import base64
import io
import qrcode
from app.config import settings


def generate_ticket_signature(booking_code: str, showtime_id: int, seat_codes: list) -> str:
    message = f"{booking_code}:{showtime_id}:{','.join(sorted(seat_codes))}"
    signature = hmac.new(
        settings.TICKET_SIGNING_SECRET.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()
    return signature


def generate_qr_data(booking_code: str, showtime_id: int, seat_codes: list, signature: str) -> str:
    payload = {
        "issuer": "CineVerse India",
        "booking_code": booking_code,
        "showtime_id": showtime_id,
        "seats": seat_codes,
        "sig": signature[:16]
    }
    return json.dumps(payload, separators=(',', ':'))


def generate_qr_code_base64(qr_data: str) -> str:
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=2,
    )
    qr.add_data(qr_data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#E50914", back_color="#0F1014")

    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode()
    return f"data:image/png;base64,{img_str}"


def verify_ticket_signature(qr_string: str) -> bool:
    """Verifies the HMAC cryptographic signature on a scanned ticket QR token."""
    try:
        if qr_string.startswith("{"):
            data = json.loads(qr_string)
            bkg = data.get("booking_code")
            st = int(data.get("showtime_id", 0))
            seats = data.get("seats", [])
            sig = data.get("sig", "")
            if not (bkg and st and seats and sig):
                return False
            expected = generate_ticket_signature(bkg, st, seats)
            return hmac.compare_digest(expected[:16], sig) or hmac.compare_digest(expected, sig)

        parts = qr_string.split("|")
        if len(parts) >= 4:
            code, st_str, seats_str, sig = parts[0], parts[1], parts[2], parts[3]
            st = int(st_str)
            seats = [s.strip() for s in seats_str.split(",") if s.strip()]
            expected = generate_ticket_signature(code, st, seats)
            return hmac.compare_digest(expected[:16], sig) or hmac.compare_digest(expected, sig)

        return False
    except Exception:
        return False


