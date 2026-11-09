# CineVerse Catalogue & Content Licensing Architecture

## 1. Executive Summary & Legal Guardrails
CineVerse integrates a dual-mode **`CatalogProvider`** architecture that can source movie titles, metadata, artwork, and media previews from either:
1. **Local Seed Catalogue (`local`)**: Showcase movies stored locally with pre-rendered assets.
2. **TMDB Real Indian Release Catalogue (`tmdb`)**: Real-time now-playing and upcoming theatrical releases across 9 Indian languages (`kn`, `hi`, `ta`, `te`, `ml`, `bn`, `mr`, `pa`, `en`) fetched via The Movie Database (TMDB) API.

> [!WARNING]
> **Non-Commercial Development & Demo Notice**  
> The TMDB free API tier is strictly permitted for non-commercial, evaluation, and demonstration purposes. Any public, enterprise, or commercial production launch of CineVerse requires formal enterprise licensing agreements with The Movie Database (or Gracenote / IMDb Pro) and direct digital asset distribution agreements with theatrical film distributors.

---

## 2. TMDB Attribution & Compliance
Under TMDB's Terms of Use, the following requirements are strictly fulfilled:
- **Attribution Statement**:
  > *"This product uses the TMDB API but is not endorsed or certified by TMDB."*
- **Placement**: Prominently displayed in the universal web footer (`frontend/components/TmdbAttribution.tsx`) and the official About Page (`/about`).
- **Logo Usage**: Official TMDB logo mark rendered alongside the attribution statement.
- **Image CDN & Resolution Rules**:
  - Posters: Served directly from TMDB's official CDN `https://image.tmdb.org/t/p/w500` with responsive `srcset` (`w342`, `w500`, `w780`).
  - Backdrops: Served from `https://image.tmdb.org/t/p/original`.
  - Fallbacks: Branded vector fallback card with title and certificate displayed when artwork is unavailable; images never disappear or break layout.

---

## 3. Security & Secret Protection
- **Server-Side API Key Only**: `TMDB_API_KEY` is loaded strictly on the FastAPI backend (`backend/app/config.py`) via environment variables.
- **Zero Client Bundling**: Neither Next.js client-side code, public environment variables (`NEXT_PUBLIC_*`), nor browser HTTP requests ever communicate directly with TMDB.
- **Rate-Limiting & Caching**: The backend sync engine uses a 24-hour cache TTL and rate-limited async batching to respect TMDB's fair-use constraints.

---

## 4. YouTube Trailer Privacy & Sandboxing
To comply with copyright and distributor terms:
- **Zero Video Re-hosting**: CineVerse never scrapes, downloads, modifies, or re-hosts copyrighted studio trailers.
- **Privacy-Enhanced Embeds**: The trailer player embeds official trailers using YouTube's privacy-enhanced embed domain (`https://www.youtube-nocookie.com/embed/{id}`).
- **Sandboxed Execution**: Embed frames use `sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"` with no cross-origin token leaks.
- **No Background Video Misuse**: YouTube videos are strictly played within visible modal dialogs upon explicit user interaction ("Watch Trailer" button); third-party YouTube videos are **never** utilized as hidden canvas backgrounds or Three.js 3D screen textures.

---

## 5. Demonstration Schedule Notice
Theatrical showtimes, auditoriums, seating layouts, and ticket prices in CineVerse are synthetic demonstration schedules for testing 3D seat preview algorithms. A prominent notice banner informs users:
> *"Sample showtimes for demonstration"*

