"""
generate_glimpses_and_colors.py
--------------------------------
Batch script to:
  1. Extract dominant colour from every movie's poster (chroma-aware).
  2. Cut a 12-second, silent, seamless-loop glimpse from every movie's trailer
     at 480p MP4, 480p WebM, and 720p MP4.
  3. Update the movies table with dominant_color, glimpse_url,
     glimpse_webm_url, glimpse_720p_url.

Run from the backend/ directory:
  python -m app.seed.generate_glimpses_and_colors

Requirements: ffmpeg on PATH, Pillow, asyncpg / aiosqlite (via app.database).
"""
import asyncio
import colorsys
import os
import subprocess
import sys
from pathlib import Path

from PIL import Image
from sqlalchemy import text

# ── Project paths ─────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parents[3]           # d:/projects/CineVerse
POSTERS_DIR = ROOT / "frontend" / "public" / "posters"
TRAILERS_DIR = ROOT / "frontend" / "public" / "trailers"
GLIMPSES_DIR = ROOT / "frontend" / "public" / "trailers" / "glimpses"
GLIMPSES_DIR.mkdir(parents=True, exist_ok=True)

# ── Dominant-colour extraction ────────────────────────────────────────────────

def dominant_color(poster_path: Path) -> str:
    """Return #rrggbb of the most chromatic, mid-lightness colour in the poster."""
    try:
        img = Image.open(poster_path).convert("RGB").resize((120, 120))
        q = img.quantize(colors=16)
        palette = q.getpalette()
        counts = sorted(q.getcolors(), reverse=True, key=lambda x: x[0])
        candidates = []
        for count, idx in counts:
            r, g, b = palette[idx * 3: idx * 3 + 3]
            h, l, s = colorsys.rgb_to_hls(r / 255.0, g / 255.0, b / 255.0)
            if 0.12 <= l <= 0.88 and s >= 0.10:
                score = count * (s + 0.2)
                candidates.append((score, r, g, b))
        if candidates:
            candidates.sort(key=lambda x: x[0], reverse=True)
            _, r, g, b = candidates[0]
            return f"#{r:02x}{g:02x}{b:02x}"
        idx = counts[0][1]
        r, g, b = palette[idx * 3: idx * 3 + 3]
        return f"#{r:02x}{g:02x}{b:02x}"
    except Exception as e:
        print(f"  [warn] dominant_color failed for {poster_path}: {e}")
        return "#c8102e"


# ── Glimpse generation ────────────────────────────────────────────────────────

GLIMPSE_SS = 2       # seek offset in trailer (seconds)
GLIMPSE_T = 13       # source segment length (13 s → 12 s output after xfade trim)
FADE_DUR = 1         # crossfade duration (seconds)
FADE_OFFSET = 11     # xfade starts 11 s in, fades 1 s → seamless 12 s loop


def _xfade_filter(scale: str) -> str:
    """Build the ffmpeg filtergraph for a seamlessly-looping, scaled glimpse."""
    return (
        f"[0:v]scale={scale},split[v1][v2];"
        f"[v1]trim=1:{GLIMPSE_T},setpts=PTS-STARTPTS[v1t];"
        f"[v2]trim=0:1,setpts=PTS-STARTPTS[v2t];"
        f"[v1t][v2t]xfade=transition=fade:duration={FADE_DUR}:offset={FADE_OFFSET},format=yuv420p[outv]"
    )


def run_ff(cmd: list[str], label: str) -> bool:
    """Run an ffmpeg command; return True on success."""
    result = subprocess.run(
        cmd,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )
    if result.returncode != 0:
        print(f"  [error] {label}: {result.stderr[-400:].decode(errors='replace')}")
        return False
    return True


def generate_glimpse(slug: str, trailer_path: Path) -> dict:
    """Generate three glimpse files for *slug*. Returns URL dict (or None on failure)."""
    mp4_480 = GLIMPSES_DIR / f"{slug}-480p.mp4"
    webm_480 = GLIMPSES_DIR / f"{slug}-480p.webm"
    mp4_720 = GLIMPSES_DIR / f"{slug}-720p.mp4"

    all_ok = True

    # 480p MP4
    if not mp4_480.exists():
        ok = run_ff([
            "ffmpeg", "-y", "-ss", str(GLIMPSE_SS), "-i", str(trailer_path),
            "-t", str(GLIMPSE_T),
            "-filter_complex", _xfade_filter("-2:480"),
            "-map", "[outv]", "-an",
            "-c:v", "libx264", "-crf", "26", "-preset", "fast",
            str(mp4_480),
        ], f"{slug} 480p MP4")
        all_ok = all_ok and ok
    else:
        print(f"  [skip] {mp4_480.name} already exists")

    # 480p WebM
    if not webm_480.exists():
        ok = run_ff([
            "ffmpeg", "-y", "-ss", str(GLIMPSE_SS), "-i", str(trailer_path),
            "-t", str(GLIMPSE_T),
            "-filter_complex", _xfade_filter("-2:480"),
            "-map", "[outv]", "-an",
            "-c:v", "libvpx-vp9", "-b:v", "200k", "-crf", "36",
            str(webm_480),
        ], f"{slug} 480p WebM")
        all_ok = all_ok and ok
    else:
        print(f"  [skip] {webm_480.name} already exists")

    # 720p MP4
    if not mp4_720.exists():
        ok = run_ff([
            "ffmpeg", "-y", "-ss", str(GLIMPSE_SS), "-i", str(trailer_path),
            "-t", str(GLIMPSE_T),
            "-filter_complex", _xfade_filter("-2:720"),
            "-map", "[outv]", "-an",
            "-c:v", "libx264", "-crf", "26", "-preset", "fast",
            str(mp4_720),
        ], f"{slug} 720p MP4")
        all_ok = all_ok and ok
    else:
        print(f"  [skip] {mp4_720.name} already exists")

    if not all_ok:
        return {}

    # Return URL paths relative to public/
    return {
        "glimpse_url": f"/trailers/glimpses/{slug}-480p.mp4",
        "glimpse_webm_url": f"/trailers/glimpses/{slug}-480p.webm",
        "glimpse_720p_url": f"/trailers/glimpses/{slug}-720p.mp4",
    }


# ── Database update ───────────────────────────────────────────────────────────

async def update_all():
    # Import here so PYTHONPATH only needs backend/ on sys.path
    from app.database import AsyncSessionLocal, init_db
    from app.models.movie import Movie
    from sqlalchemy import select

    await init_db()

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Movie.id, Movie.slug, Movie.poster_url, Movie.trailer_url)
        )
        movies = result.all()

    print(f"Found {len(movies)} movies. Processing…\n")

    updates = []
    for movie_id, slug, poster_url, trailer_url in movies:
        print(f"[{movie_id:>3}] {slug}")
        poster_path = POSTERS_DIR / f"{slug}.webp"
        trailer_path = TRAILERS_DIR / f"{slug}.mp4"

        # Dominant colour
        if poster_path.exists():
            color = dominant_color(poster_path)
            print(f"       dominant_color = {color}")
        else:
            color = "#c8102e"
            print(f"       [warn] poster missing, using fallback {color}")

        # Glimpse files
        if trailer_path.exists():
            urls = generate_glimpse(slug, trailer_path)
            if urls:
                for key, path in urls.items():
                    size_kb = (GLIMPSES_DIR / Path(path).name).stat().st_size // 1024
                    print(f"       {key} → {path} ({size_kb} KiB)")
            else:
                urls = {}
        else:
            print(f"       [warn] trailer missing: {trailer_path}")
            urls = {}

        updates.append({
            "movie_id": movie_id,
            "dominant_color": color,
            **urls,
        })
        print()

    # Batch update DB
    async with AsyncSessionLocal() as session:
        for u in updates:
            await session.execute(
                text("""
                    UPDATE movies
                    SET dominant_color   = :dominant_color,
                        glimpse_url      = :glimpse_url,
                        glimpse_webm_url = :glimpse_webm_url,
                        glimpse_720p_url = :glimpse_720p_url
                    WHERE id = :movie_id
                """),
                {
                    "dominant_color": u.get("dominant_color"),
                    "glimpse_url": u.get("glimpse_url"),
                    "glimpse_webm_url": u.get("glimpse_webm_url"),
                    "glimpse_720p_url": u.get("glimpse_720p_url"),
                    "movie_id": u["movie_id"],
                },
            )
        await session.commit()
    print(f"✅  Updated {len(updates)} movies in the database.")


if __name__ == "__main__":
    asyncio.run(update_all())

