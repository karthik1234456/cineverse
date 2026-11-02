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

