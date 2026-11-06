import pytest
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import AsyncSessionLocal
from app.models.cinema import City, Cinema
from app.models.auth import User, RoleEnum
from app.services.geo_service import haversine_distance_km, generate_directions_url

CITY_BOUNDS = {
    "Bengaluru": {"min_lat": 12.83, "max_lat": 13.15, "min_lng": 77.45, "max_lng": 77.75},
    "Mumbai": {"min_lat": 18.89, "max_lat": 19.30, "min_lng": 72.77, "max_lng": 73.02},
    "Delhi NCR": {"min_lat": 28.40, "max_lat": 28.88, "min_lng": 76.90, "max_lng": 77.45},
    "Hyderabad": {"min_lat": 17.20, "max_lat": 17.60, "min_lng": 78.25, "max_lng": 78.65},
    "Chennai": {"min_lat": 12.85, "max_lat": 13.25, "min_lng": 80.10, "max_lng": 80.35},
    "Pune": {"min_lat": 18.40, "max_lat": 18.70, "min_lng": 73.70, "max_lng": 74.05},
    "Kolkata": {"min_lat": 22.40, "max_lat": 22.75, "min_lng": 88.25, "max_lng": 88.50},
}


def test_haversine_distance_calculation():
    """Verify distance between identical points is 0 and known cities match within realistic bounds."""
    # Same point
    assert haversine_distance_km(12.9716, 77.5946, 12.9716, 77.5946) == 0.0

    # Bengaluru (12.9716, 77.5946) to Mumbai (19.0760, 72.8777) ~ 840 km
    dist = haversine_distance_km(12.9716, 77.5946, 19.0760, 72.8777)
    assert 830.0 <= dist <= 855.0, f"Expected ~840 km between BLR and BOM, got {dist}"

    # Delhi (28.6139, 77.2090) to Kolkata (22.5726, 88.3639) ~ 1305 km
    dist_del_ccu = haversine_distance_km(28.6139, 77.2090, 22.5726, 88.3639)
    assert 1290.0 <= dist_del_ccu <= 1325.0, f"Expected ~1305 km, got {dist_del_ccu}"


def test_generate_directions_url():
    """Verify standard universal Google Maps directions link format without API keys."""
    url = generate_directions_url(12.9345, 77.6101)
    assert url == "https://www.google.com/maps/dir/?api=1&destination=12.9345,77.6101"
    assert "key=" not in url
    assert "api_key=" not in url


@pytest.mark.asyncio
async def test_cinema_coordinates_inside_city_bounding_boxes():
    """Verify all 35 cinemas across all 7 cities have valid coordinates inside bounding boxes and rich transit metadata."""
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Cinema).options(selectinload(Cinema.city)))
        cinemas = res.scalars().all()

        assert len(cinemas) >= 28, f"Expected at least 28 cinemas, found {len(cinemas)}"

        valid_parking_types = {"valet", "covered", "open", "none"}

        for cinema in cinemas:
            city_name = cinema.city.name
            assert city_name in CITY_BOUNDS, f"Unknown city {city_name}"
            bounds = CITY_BOUNDS[city_name]

            assert cinema.latitude is not None, f"Cinema {cinema.name} missing latitude"
            assert cinema.longitude is not None, f"Cinema {cinema.name} missing longitude"

            assert bounds["min_lat"] <= cinema.latitude <= bounds["max_lat"], (
                f"Cinema {cinema.name} lat {cinema.latitude} outside {city_name} bounds {bounds}"
            )
            assert bounds["min_lng"] <= cinema.longitude <= bounds["max_lng"], (
                f"Cinema {cinema.name} lng {cinema.longitude} outside {city_name} bounds {bounds}"
            )

            # Metadata checks
            assert cinema.pincode is not None and len(cinema.pincode) == 6 and cinema.pincode.isdigit(), (
                f"Cinema {cinema.name} invalid PIN code: {cinema.pincode}"
            )
            assert cinema.parking is not None and cinema.parking.lower() in valid_parking_types, (
                f"Cinema {cinema.name} invalid parking '{cinema.parking}'"
            )
            assert cinema.transit_stop is not None and len(cinema.transit_stop) > 3, (
                f"Cinema {cinema.name} missing transit_stop"
            )
            assert cinema.phone is not None and len(cinema.phone) >= 10, (
                f"Cinema {cinema.name} missing phone"
            )


@pytest.mark.asyncio
async def test_cinemas_api_distance_sorting_and_filtering(client):
    """Verify GET /api/v1/cinemas/ sorts by distance and respects max_distance_km."""
    # Bengaluru coordinates
    user_lat, user_lng = 12.97, 77.59

    # 1. Test distance sorting
    resp = await client.get(f"/api/v1/cinemas/?city_id=1&user_lat={user_lat}&user_lng={user_lng}&sort_by=distance")
    assert resp.status_code == 200
    cinemas = resp.json()
    assert len(cinemas) >= 4

    distances = []
    for c in cinemas:
        assert c["distance_km"] is not None
        assert c["directions_url"] is not None
        assert "destination=" in c["directions_url"]
        distances.append(c["distance_km"])

    assert distances == sorted(distances), f"Cinemas not sorted by distance: {distances}"

    # 2. Test max_distance_km filter
    max_d = 12.0
    resp_filtered = await client.get(
        f"/api/v1/cinemas/?city_id=1&user_lat={user_lat}&user_lng={user_lng}&max_distance_km={max_d}"
    )
    assert resp_filtered.status_code == 200
    filtered_cinemas = resp_filtered.json()

    for c in filtered_cinemas:
        assert c["distance_km"] <= max_d


@pytest.mark.asyncio
async def test_movies_showtimes_distance_enrichment(client):
    """Verify GET /api/v1/movies/{id}/showtimes attaches distance_km and directions_url."""
    user_lat, user_lng = 12.97, 77.59
    resp = await client.get(f"/api/v1/movies/1/showtimes?city_id=1&user_lat={user_lat}&user_lng={user_lng}")
    assert resp.status_code == 200
    groups = resp.json()
    assert len(groups) > 0

    for g in groups:
        assert "distance_km" in g
        assert g["distance_km"] is not None
        assert "directions_url" in g
        assert g["directions_url"].startswith("https://www.google.com/maps/dir/?api=1&destination=")


@pytest.mark.asyncio
async def test_admin_cinema_coordinates_patch(client):
    """Verify admin can update cinema coordinates and metadata, while unauthorized calls are rejected."""
    # 1. Unauthenticated -> 401
    patch_payload = {
        "latitude": 12.9750,
        "longitude": 77.5980,
        "landmark": "Near Central Post Office",
        "parking": "valet",
        "transit_stop": "Cubbon Park Metro",
        "pincode": "560001",
        "phone": "+91 80 4455 6677"
    }
    unauth_resp = await client.patch("/api/v1/admin/cinemas/1/coordinates", json=patch_payload)
    assert unauth_resp.status_code in (401, 403)

    # 2. Customer login -> 403 Forbidden
    login_resp = await client.post("/api/v1/auth/login", json={"email": "patron@example.com", "password": "Patron@123"})
    assert login_resp.status_code == 200
    patron_token = login_resp.json()["access_token"]

    forbidden_resp = await client.patch(
        "/api/v1/admin/cinemas/1/coordinates",
        json=patch_payload,
        headers={"Authorization": f"Bearer {patron_token}"}
    )
    assert forbidden_resp.status_code == 403

    # 3. Admin login -> 200 OK
    admin_login = await client.post("/api/v1/auth/login", json={"email": "admin@cineverse.com", "password": "Admin@123"})
    assert admin_login.status_code == 200
    admin_token = admin_login.json()["access_token"]

    success_resp = await client.patch(
        "/api/v1/admin/cinemas/1/coordinates",
        json=patch_payload,
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert success_resp.status_code == 200
    updated_cinema = success_resp.json()
    assert abs(updated_cinema["latitude"] - 12.9750) < 0.0001
    assert abs(updated_cinema["longitude"] - 77.5980) < 0.0001
    assert updated_cinema["landmark"] == "Near Central Post Office"
    assert updated_cinema["parking"] == "valet"
    assert updated_cinema["transit_stop"] == "Cubbon Park Metro"


@pytest.mark.asyncio
async def test_printed_ticket_and_booking_location_details(client):
    """Verify printed HTML ticket and booking response include cinema address, parking note, and directions link."""
    from app.models.booking import Booking, BookingSeat, Ticket, BookingStatusEnum
    from app.models.showtime import Showtime
    from app.services.ticket_service import generate_qr_data, generate_ticket_signature, generate_qr_code_base64

    # Login as patron
    login_resp = await client.post("/api/v1/auth/login", json={"email": "patron@example.com", "password": "Patron@123"})
    assert login_resp.status_code == 200
    patron_token = login_resp.json()["access_token"]
    patron_user_id = login_resp.json()["user_id"]

    async with AsyncSessionLocal() as db:
        st_res = await db.execute(select(Showtime).where(Showtime.id == 1))
        st = st_res.scalars().first()
        assert st is not None

        booking = Booking(
            booking_code="CV-MAPTEST-999",
            user_id=patron_user_id,
            showtime_id=1,
            status=BookingStatusEnum.CONFIRMED,
            total_ticket_amount=400.0,
            convenience_fee=40.0,
            gst_amount=7.2,
            addons_amount=0.0,
            discount_amount=0.0,
            final_total_amount=447.2,
            contact_email="patron@example.com",
            contact_phone="+919876543210"
        )
        db.add(booking)
        await db.flush()

        b_seat = BookingSeat(
            booking_id=booking.id,
            showtime_id=1,
            seat_id="B01",
            category="Premium",
            price=400.0
        )
        db.add(b_seat)

        sig = generate_ticket_signature(booking.booking_code, 1, ["B01"])
        qr_data = generate_qr_data(booking.booking_code, 1, ["B01"], sig)
        qr_url = generate_qr_code_base64(qr_data)
        ticket = Ticket(
            booking_id=booking.id,
            ticket_number="TKT-MAPTEST-01",
            qr_data=qr_data,
            qr_code_url=qr_url,
            hmac_signature=sig
        )
        db.add(ticket)
        await db.commit()
        booking_id = booking.id
        booking_code = booking.booking_code

    # 1. Test GET /api/v1/tickets/{code}/print
    print_resp = await client.get(f"/api/v1/tickets/{booking_code}/print")
    assert print_resp.status_code == 200
    html = print_resp.text
    assert "Cinema Location & Transit" in html or "Cinema Location &amp; Transit" in html
    assert "Open Directions on Google Maps" in html
    assert "https://www.google.com/maps/dir/?api=1&destination=" in html
    assert "parking" in html.lower()

    # 2. Test GET /api/v1/bookings/{id}
    b_resp = await client.get(f"/api/v1/bookings/{booking_id}", headers={"Authorization": f"Bearer {patron_token}"})
    assert b_resp.status_code == 200
    b_data = b_resp.json()
    assert b_data["cinema_address"] is not None and len(b_data["cinema_address"]) > 5
    assert b_data["cinema_latitude"] is not None
    assert b_data["cinema_longitude"] is not None
    assert b_data["directions_url"] is not None
    assert b_data["directions_url"].startswith("https://www.google.com/maps/dir/?api=1&destination=")

