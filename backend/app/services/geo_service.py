import math
from typing import Optional


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Compute great-circle distance between two points on Earth in kilometers
    using the Haversine formula.
    """
    R = 6371.0  # Earth mean radius in kilometers
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(R * c, 2)


def generate_directions_url(lat: Optional[float], lng: Optional[float]) -> Optional[str]:
    """
    Generate Google Maps universal URL scheme directions link without runtime geocoding
    or API key leakage.
    Format: https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>
    """
    if lat is None or lng is None:
        return None
    return f"https://www.google.com/maps/dir/?api=1&destination={lat},{lng}"
