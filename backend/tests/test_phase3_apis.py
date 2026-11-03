import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_cities_api(client: AsyncClient):
    resp = await client.get("/api/v1/cities/")
    assert resp.status_code == 200
    cities = resp.json()
    assert len(cities) >= 7
    slugs = [c["slug"] for c in cities]
    assert "mumbai" in slugs
    assert "bengaluru" in slugs
    assert "delhi-ncr" in slugs


@pytest.mark.asyncio
async def test_movies_filters_and_sorting(client: AsyncClient):
    # 1. Base list
    resp = await client.get("/api/v1/movies/")
    assert resp.status_code == 200
    all_movies = resp.json()
    assert len(all_movies) >= 12
    assert "X-Total-Count" in resp.headers

    # 2. Filter by status: now_showing vs coming_soon
    now_resp = await client.get("/api/v1/movies/?status=now_showing")
    assert now_resp.status_code == 200
    now_movies = now_resp.json()
    for m in now_movies:
        assert m["is_now_showing"] is True

    soon_resp = await client.get("/api/v1/movies/?status=coming_soon")
    assert soon_resp.status_code == 200
    soon_movies = soon_resp.json()
    for m in soon_movies:
        assert m["is_coming_soon"] is True

    # 3. Filter by language
    lang_resp = await client.get("/api/v1/movies/?language=English")
    assert lang_resp.status_code == 200
    for m in lang_resp.json():
        assert "English" in m["languages"]

    # 4. Filter by genre
    genre_resp = await client.get("/api/v1/movies/?genre=Action")
    assert genre_resp.status_code == 200
    for m in genre_resp.json():
        assert "Action" in m["genres"]

    # 5. Filter by format
    fmt_resp = await client.get("/api/v1/movies/?format=IMAX 3D")
    assert fmt_resp.status_code == 200
    for m in fmt_resp.json():
        assert "IMAX 3D" in m["formats"]

    # 6. Sorting: title ASC
    title_sort_resp = await client.get("/api/v1/movies/?sort=title")
    assert title_sort_resp.status_code == 200
    titles = [m["title"] for m in title_sort_resp.json()]
    assert titles == sorted(titles)

    # 7. Pagination
    p1 = await client.get("/api/v1/movies/?page=1&page_size=4")
    assert p1.status_code == 200
    assert len(p1.json()) == 4
    assert p1.headers.get("X-Page") == "1"
    assert p1.headers.get("X-Page-Size") == "4"


@pytest.mark.asyncio
async def test_movie_detail_api(client: AsyncClient):
    movies_resp = await client.get("/api/v1/movies/")
    movie = movies_resp.json()[0]
    movie_id = movie["id"]

    detail_resp = await client.get(f"/api/v1/movies/{movie_id}")
    assert detail_resp.status_code == 200
    data = detail_resp.json()
    assert data["id"] == movie_id
    assert "cast_members" in data
    assert "reviews" in data
    assert "trailer_url" in data
    assert "certificate" in data


@pytest.mark.asyncio
async def test_cinema_and_showtimes_api(client: AsyncClient):
    # 1. Cinema list
    cinemas_resp = await client.get("/api/v1/cinemas/")
    assert cinemas_resp.status_code == 200
    cinemas = cinemas_resp.json()
    assert len(cinemas) >= 7
    cinema_id = cinemas[0]["id"]

    # 2. Cinema detail
    detail_resp = await client.get(f"/api/v1/cinemas/{cinema_id}")
    assert detail_resp.status_code == 200
    cin_data = detail_resp.json()
    assert cin_data["id"] == cinema_id
    assert "auditoriums" in cin_data

    # 3. Cinema showtimes
    st_resp = await client.get(f"/api/v1/cinemas/{cinema_id}/showtimes")
    assert st_resp.status_code == 200
    grouped = st_resp.json()
    assert isinstance(grouped, list)
    if len(grouped) > 0:
        first_movie = grouped[0]
        assert "movie_id" in first_movie
        assert "showtimes" in first_movie
        if len(first_movie["showtimes"]) > 0:
            st = first_movie["showtimes"][0]
            assert "availability_status" in st
            assert "has_3d_preview" in st
            assert "lowest_price" in st


@pytest.mark.asyncio
async def test_movie_showtimes_api(client: AsyncClient):
    movies_resp = await client.get("/api/v1/movies/")
    movie_id = movies_resp.json()[0]["id"]

    st_resp = await client.get(f"/api/v1/movies/{movie_id}/showtimes")
    assert st_resp.status_code == 200
    groups = st_resp.json()
    assert isinstance(groups, list)
    if len(groups) > 0:
        g = groups[0]
        assert "cinema_id" in g
        assert "showtimes" in g
        for s in g["showtimes"]:
            assert s["availability_status"] in ["AVAILABLE", "FAST_FILLING", "ALMOST_FULL", "SOLD_OUT"]
            assert isinstance(s["has_3d_preview"], bool)


@pytest.mark.asyncio
async def test_global_search_api(client: AsyncClient):
    # 1. Search for movie
    resp = await client.get("/api/v1/search/?q=Quantum")
    assert resp.status_code == 200
    data = resp.json()
    assert data["query"] == "Quantum"
    assert "movies" in data
    assert "cinemas" in data
    assert len(data["movies"]) >= 1
    assert any("Quantum Odyssey" in m["title"] for m in data["movies"])

    # 2. Search for cinema / city
    cin_resp = await client.get("/api/v1/search/?q=Koramangala")
    assert cin_resp.status_code == 200
    cin_data = cin_resp.json()
    assert len(cin_data["cinemas"]) >= 1
    assert "Koramangala" in cin_data["cinemas"][0]["name"]

    # 3. Search for actor
    actor_resp = await client.get("/api/v1/search/?q=Marcus")
    assert actor_resp.status_code == 200
    assert len(actor_resp.json()["movies"]) >= 1
