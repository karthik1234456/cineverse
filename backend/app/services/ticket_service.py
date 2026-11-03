import json
import base64
import io
import qrcode
from typing import Dict, List, Optional, Tuple
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.hazmat.primitives import serialization
from cryptography.exceptions import InvalidSignature
from app.config import settings

# Active Key ID and Ed25519 Keyring (support key rotation via kid)
CURRENT_KID = "cv-ed25519-2026-v1"

# Base64-encoded raw 32-byte Ed25519 seeds/keys
KEYRING_PRIVATE: Dict[str, str] = {
    "cv-ed25519-2026-v1": "2L9jTUs4PdYPH81uwmtaORNo7fluvvLwT06LnWWbQ00=",
    "cv-ed25519-2026-v2": "dGVzdF9rZXlfc2VlZF9mb3Jfcm90YXRpb25fcTFfMjAyNg==",  # 32 bytes sample rotation key
}

KEYRING_PUBLIC: Dict[str, str] = {
    "cv-ed25519-2026-v1": "Ll+hGX1uEqOUWgXwxsBsjNb6O9rqJm90uKDBwLR3dUA=",
    "cv-ed25519-2026-v2": "dGVzdF9wdWJsaWNfa2V5X2Zvcl9yb3RhdGlvbl9xMV8yMDI2",
}


def get_public_keys() -> List[Dict[str, str]]:
    """
    Returns public keys and their key IDs (`kid`) for offline scanning devices.
    Never ships private keys to scanners. Scanners download these public keys to verify
    ticket QR codes offline cryptographically using asymmetric Ed25519.
    """
    return [
        {"kid": kid, "alg": "Ed25519", "public_key_b64": pub_b64}
        for kid, pub_b64 in KEYRING_PUBLIC.items()
    ]


def sign_ticket_ed25519(payload_bytes: bytes, kid: str = CURRENT_KID) -> Tuple[str, str]:
    """
    Signs raw payload bytes with Ed25519 private key identified by `kid`.
    Returns (signature_b64, kid).
    """
    priv_b64 = KEYRING_PRIVATE.get(kid)
    if not priv_b64:
        raise ValueError(f"Unknown private key identifier: {kid}")

    raw_seed = base64.b64decode(priv_b64)
    # Ensure 32 bytes seed
    if len(raw_seed) < 32:
        raw_seed = raw_seed.ljust(32, b"\x00")
    elif len(raw_seed) > 32:
        raw_seed = raw_seed[:32]

    private_key = ed25519.Ed25519PrivateKey.from_private_bytes(raw_seed)
    signature = private_key.sign(payload_bytes)
    return base64.b64encode(signature).decode("ascii"), kid


def verify_ed25519_signature(payload_bytes: bytes, signature_b64: str, kid: str) -> bool:
    """
    Verifies Ed25519 signature against the public key corresponding to `kid`.
    """
    pub_b64 = KEYRING_PUBLIC.get(kid)
    if not pub_b64:
        return False
    try:
        raw_pub = base64.b64decode(pub_b64)
        if len(raw_pub) < 32:
            raw_pub = raw_pub.ljust(32, b"\x00")
        elif len(raw_pub) > 32:
            raw_pub = raw_pub[:32]

        public_key = ed25519.Ed25519PublicKey.from_public_bytes(raw_pub)
        signature = base64.b64decode(signature_b64)
        public_key.verify(signature, payload_bytes)
        return True
    except (InvalidSignature, Exception):
        return False


def generate_ticket_signature(booking_code: str, showtime_id: int, seat_codes: list, kid: str = CURRENT_KID) -> str:
    """Generates an Ed25519 cryptographic signature for ticket parameters."""
    canonical_msg = f"{booking_code}:{showtime_id}:{','.join(sorted(seat_codes))}".encode("utf-8")
    sig_b64, _ = sign_ticket_ed25519(canonical_msg, kid=kid)
    return sig_b64


def generate_qr_data(booking_code: str, showtime_id: int, seat_codes: list, signature: Optional[str] = None, kid: str = CURRENT_KID) -> str:
    """
    Generates standard QR ticket data structure with Ed25519 signature and key ID (`kid`).
    """
    canonical_msg = f"{booking_code}:{showtime_id}:{','.join(sorted(seat_codes))}".encode("utf-8")
    if not signature:
        signature, _ = sign_ticket_ed25519(canonical_msg, kid=kid)

    payload = {
        "issuer": "CineVerse India",
        "booking_code": booking_code,
        "showtime_id": showtime_id,
        "seats": sorted(seat_codes),
        "kid": kid,
        "sig": signature
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
    """
    Verifies the cryptographic signature on a scanned ticket QR token.
    Uses asymmetric Ed25519 with key ID (`kid`) rotation support.
    Falls back gracefully to legacy HMAC for backwards compatibility.
    """
    try:
        if qr_string.startswith("{"):
            data = json.loads(qr_string)
            bkg = data.get("booking_code")
            st = int(data.get("showtime_id", 0))
            seats = data.get("seats", [])
            sig = data.get("sig", "")
            kid = data.get("kid", CURRENT_KID)
            if not (bkg and st and seats and sig):
                return False

            canonical_msg = f"{bkg}:{st}:{','.join(sorted(seats))}".encode("utf-8")

            # Try asymmetric Ed25519 verification first
            if verify_ed25519_signature(canonical_msg, sig, kid):
                return True

            # Fallback legacy HMAC
            import hmac
            import hashlib
            expected_hmac = hmac.new(
                settings.TICKET_SIGNING_SECRET.encode("utf-8"),
                canonical_msg,
                hashlib.sha256
            ).hexdigest()
            return hmac.compare_digest(expected_hmac[:16], sig) or hmac.compare_digest(expected_hmac, sig)

        parts = qr_string.split("|")
        if len(parts) >= 4:
            code, st_str, seats_str, sig = parts[0], parts[1], parts[2], parts[3]
            st = int(st_str)
            seats = [s.strip() for s in seats_str.split(",") if s.strip()]
            canonical_msg = f"{code}:{st}:{','.join(sorted(seats))}".encode("utf-8")

            kid = parts[4] if len(parts) >= 5 else CURRENT_KID
            if verify_ed25519_signature(canonical_msg, sig, kid):
                return True

            # Fallback legacy HMAC
            import hmac
            import hashlib
            expected_hmac = hmac.new(
                settings.TICKET_SIGNING_SECRET.encode("utf-8"),
                canonical_msg,
                hashlib.sha256
            ).hexdigest()
            return hmac.compare_digest(expected_hmac[:16], sig) or hmac.compare_digest(expected_hmac, sig)

        return False
    except Exception:
        return False
