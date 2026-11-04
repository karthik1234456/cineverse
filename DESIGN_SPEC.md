# CineVerse — Design & layout specification

Authoritative for every screen. If a prompt and this file disagree on layout or interaction design, this file wins. Original visual identity: do not copy BookMyShow, PVR INOX or any other brand's look, copy or assets.

## 1. Principles
1. **Booking is a calm, linear flow** (showtime → seats → add-ons → pay). The standard seat map comes first and always works. **3D is an enhancement behind a clear button**, never a requirement.
2. **Light, rich-colour and simple**: poster-led, generous white space, vivid colour bands, large readable text, one primary action per screen. Fewer things on screen is always the better choice.
3. Real states everywhere: loading skeletons, empty, error, offline, sold out, expired hold.
4. Mobile-first; thumb-reachable primary actions; no hover-only features.
5. Accessible (WCAG 2.2 AA), fast (non-3D pages LCP under 2.5 s on a mid-range phone), honest (estimates are labelled).

## 2. Tokens (LIGHT theme, Tailwind theme + CSS variables) — supersedes the earlier dark palette
- Surfaces: `--bg #FFF8F1` (warm ivory page), `--surface #FFFFFF` (cards), `--tint-peach #FDEBD8`, `--tint-sky #EAF1FF`, `--tint-mint #E6F6F0`, `--border #E6DCD2`.
- Rich colour bands (heroes, banners, step headers; always with white text, contrast checked): burgundy-magenta `linear-gradient(135deg,#7A0F2E,#C2185B)`, indigo-violet `linear-gradient(135deg,#2B1B6B,#5B3FD0)`, teal-emerald `linear-gradient(135deg,#0B6E6A,#12A594)`.
- Text: `--text #1B1320` (about 15:1 on ivory), `--text-muted #4A4056` (at least 7:1), never lighter than 4.5:1 on its surface.
- Accent: primary crimson `#C8102E` (hover `#A60D26`, pressed `#8B0A20`), gold `#F2A900` for ratings/premium, teal `#0E8F8A` for success/available accents, info blue `#2563EB`, warning amber `#D97706`, danger `#C62828`.
- Seat states on light backgrounds (each also has a symbol): available = white seat with category-coloured border; yours/selected = solid crimson with tick; held by others = amber with clock; taken = grey with cross; accessible = blue with wheelchair icon. Category colours: Front amber-brown, Prime royal blue, Premier ruby.
- Type: **body 18 px / line-height 1.6; nothing smaller than 14 px anywhere**; buttons and inputs 18 px; H1 40–48, H2 30–34, H3 22–24; prices bold and tabular. Friendly sans (Inter or Plus Jakarta Sans), self-hosted; optional display face for hero titles only. Use rem units; must work at 200% zoom.
- Touch targets at least 48×48 px; buttons at least 48 px high; spacing 4-pt grid; radii 12 / 16 / 24; soft shadows (`0 8px 24px rgba(27,19,32,.08)`), no heavy borders.
- Motion: 150–250 ms ease-out; hero transitions 400–600 ms; honour `prefers-reduced-motion`; no auto-playing sound; no looping decorative animation.
- Breakpoints: 360, 640, 768, 1024, 1280, 1536. Content max width 1280.
- **Simplicity budget:** one primary button per screen; at most 6 header items; 3 booking steps (Choose show, Choose seats, Pay); extras (snacks, coupon, details) collapsed by default; technical numbers hidden behind a "details" link.

## 3. Global shell
```
┌───────────────────────────────────────────────────────────────┐
│ ▣ CineVerse   [ 🔍 Search movies, cinemas, cast ]  📍Bengaluru ▾  EN ▾  🎤  Sign in │
├───────────────────────────────────────────────────────────────┤
│  Movies  Cinemas  Offers  3D Theatres  Help                      │
└───────────────────────────────────────────────────────────────┘
```
Sticky, white with a soft shadow. Only Movies, Cinemas, My Tickets, city, search and Sign in are visible; everything else lives in a profile menu or the footer. Mobile: top bar (logo, city, search icon, mic, profile) + bottom tab bar (Home, Movies, Cinemas, Tickets, Profile). City picker as a sheet. Footer with policies, language, social, app-store placeholders.

## 4. Key screens

### 4.1 Home
Hero carousel (backdrop, title, language/format chips, **Book tickets** + **Watch trailer**), then rows: Now showing, Coming soon, Trending in city, Recommended, Top cinemas, Offers strip, "Preview your seat in 3D" showcase (short looping video of the 3D theatre, not a live canvas), footer. Cards: poster 2:3, title, genre·language, ★ rating, duration, certificate, "Book" button on hover (always visible on touch).

### 4.2 Movie detail
```
┌ backdrop (blurred, darkened) ───────────────────────────────┐
│ [poster] Title (certificate)  ★ 8.4  12k interested          │
│          2h 18m · Action, Thriller · Hindi, English · 2D 3D  │
│          [ Book tickets ]  [ ▶ Trailer ]  [ ♡ Interested ]    │
└─────────────────────────────────────────────────────────────┘
 About | Cast & crew | Reviews | Trailers & clips
 Showtimes (date strip: next 7 days)     Filters: Language · Format · Price · Time of day
 ┌ Cinema A  ♿ 🅿  Cancellation available ───────────────────┐
 │ [10:30 AM 2D ₹150] [1:15 PM 2D ₹250] [7:00 PM IMAX ₹350 ▮▮▯ Fast filling] │
 └─────────────────────────────────────────────────────────┘
```
Availability colour on chips (green, amber "Fast filling", red "Almost full", grey "Sold out") computed from real inventory with a legend. Chip tooltip: price range and screen. Trailer opens the **trailer modal** (see §6).

### 4.3 Booking step 1: seat selection (STANDARD MAP, DEFAULT)
Desktop (12 cols): main 8 cols, sticky summary 4 cols.
```
┌ Stepper: ① Seats ─ ② Add-ons ─ ③ Review & pay ────────  Hold ⏱ 04:32 ┐
│ Movie · Cinema · Screen 1 · Today 7:00 PM        [ Change showtime ]   │
├────────────────────────────────────────────┬────────────────────────────┤
│        ▔▔▔▔▔▔▔▔▔ SCREEN THIS WAY ▔▔▔▔▔▔▔▔▔     │ Poster  Title               │
│  Premier  J  1 2 3 4 5   6 7 8 9 10        │ Cinema · Screen · Time      │
│           I  …                              │ Selected: E5, E6            │
│  Prime    G  …                              │ Tickets  2 × ₹250  ₹500     │
│           D  …                              │ Convenience fee      ₹40    │
│  Front    C  …                              │ GST                  ₹97    │
│           A  …                              │ ─────────────────────────   │
│ Legend: available · selected · held · booked│ Total              ₹637     │
│ [ 🧊 Explore in 3D ]  (primary outlined)    │ [ Continue ]                │
│ ▶ Mini trailer (collapsible, muted)         │                             │
└────────────────────────────────────────────┴────────────────────────────┘
```
- The map is drawn from the real layout data (columns from x, rows from z, aisle gap in the centre, rows A→J front to back, seat 01 on the audience's left), live state through WebSocket, same seat IDs as the 3D scene.
- Category bands with prices; tap a seat to select; ticket count preselected (default 2) with a stepper; "Best available" button picks adjacent seats by the geometric view score and category; accessible seat lane highlighted.
- **"Explore in 3D" button** opens the 3D theatre route/overlay for the same showtime. The selection, hold and countdown are shared and update both ways. Closing 3D returns to this map. If WebGL or the 3D asset is missing the button is hidden and replaced by "3D not available for this screen".
- Mobile: map fullscreen with pinch-zoom and pan, sticky bottom bar (selected seats, total, Continue), summary as a bottom sheet, "3D" as a floating pill beside the legend.
- A seat's quick info (row, number, category, price, "≈ 9 m from screen, centre view") appears in a popover; viewing-quality text is geometric and labelled approximate.

### 4.4 Booking step 1b: 3D theatre (opened from the "See it in 3D" button) — keep it minimal
Full-bleed canvas; thin top bar (back to map, showtime, hold timer, mode switch Overview/Walk/Seated, house lights, settings); left panel collapses to icon rail after first use; right seat panel; bottom bar with selected seats, total and **Continue**; control hints; **trailer plays on the cinema screen** (see §5). Mobile uses bottom sheets. Details in `ANTIGRAVITY_PROMPT.md`.

### 4.5 Step 2: add-ons, Step 3: review and pay
Add-ons: tabs (Combos, Popcorn, Drinks, Snacks) with images, quantity steppers, running total, "Skip". Review: summary card, coupon field with inline validation and applied-offer chip, contact details, T&C, hold timer sticky at top, order total sticky bottom on mobile, **Pay ₹637** opens Razorpay checkout; payment-pending and failure states are full-screen with clear next actions (retry, change method, release seats).

### 4.6 Confirmation / ticket
Success animation (brief), ticket card with large QR (high contrast, brightness hint on mobile), booking ID, seats, cinema, screen, time, "Add to calendar", "Download PDF", "Share", "Directions", offline-available. Email/SMS sent notice.

### 4.7 Profile, Admin
Profile: tabs for Bookings (Upcoming / Past / Cancelled), Watchlist, Preferences, Wallet/points, Security (sessions, MFA), Privacy (export/delete). Admin: separate shell with a left nav, dense tables with filters, forms with validation, audit trail; never mixed with customer navigation.

## 5. Trailer on the 3D screen
- The `Screen` overlay plane sits just in front of `cinema_screen_surface` (aspect 2.15). The trailer is a **licensed, directly playable video file or HLS stream** (MP4/H.264 or WebM, or HLS via hls.js) served from our CDN/object storage with CORS enabled, used as `THREE.VideoTexture` (sRGB colour space, `playsInline`, `crossOrigin="anonymous"`, muted autoplay allowed; unmute only after a user gesture).
- **YouTube/Vimeo embeds cannot be used as a WebGL texture.** If a movie only has an embed URL: the 3D screen shows the poster/backdrop with a "Watch trailer" control that opens the normal trailer modal; do not scrape or download third-party videos.
- Fit: default `contain` (letterbox 16:9 inside the 2.15 screen with black bars; scope/2.39:1 trailers fill), optional `cover` toggle. Poster fades to video on first frame; seamless loop or "Now showing" slate at end.
- Cost control: video texture updates only while playing and the screen is in the frustum; pause on hidden tab, when leaving the 3D view, and on low quality tier (fallback to poster); mobile and low tier use a 480–720p rendition; one video element only; dispose on unmount.
- Realism: screen light spill colour follows the average video colour (downsampled sample every ~250 ms, never per frame at full res); optional positional audio from the screen with a volume slider, muted by default.
- Controls near the screen and in the HUD: play/pause, mute/volume, captions, restart; works in Overview, Walk and Seated modes; keyboard `K` play/pause, `M` mute. Seated POV shows the trailer at its correct perceived size, which is part of the experience.
- Honesty: it is a preview of the trailer, not a simulation of the cinema's real projection or sound.

## 6. Trailer player in the booking section (the standard player)
One reusable `TrailerPlayer` component used on cards, movie detail (modal and inline), the seat selection page (collapsible mini player), and the 3D screen (texture source).
- Poster-first with a lightweight play button; the video only loads on interaction or when visible (IntersectionObserver); `Save-Data` and slow-network aware (no autoplay, lower rendition).
- Adaptive streaming (HLS) with quality selector and captions/subtitles (WebVTT, language choice), audio language track if available; playback speed; keyboard controls (Space/K, J/L ±10 s, M, F, C, arrows for volume), accessible labels and focus management, `aria-live` status.
- **Picture-in-picture and persistent mini player:** the trailer keeps playing in a small docked mini player while the user changes showtime or selects seats; pausing on step changes is optional via setting; only one media element plays at a time (starting another pauses the first).
- Hover preview on desktop cards (muted 5–8 s preview clip, disabled on touch and Save-Data).
- Remembers volume, mute, caption language and resume position per movie (local storage, no PII).
- Error and fallback states: retry, alternative source, poster with "Trailer unavailable", YouTube-embed fallback inside a sandboxed, privacy-enhanced iframe on non-3D pages only.
- Analytics events (play, 25/50/75/100 %, quality change, error) with consent.
- Media pipeline (admin): upload video → virus scan → transcode to HLS renditions (e.g. 240p/480p/720p/1080p) and a poster + short hover preview + VTT captions → store in object storage → **signed, expiring URLs** → CDN. File type, size and duration limits; only trailers supplied by the rights holder.

## 7. Components to build once
`AppShell`, `CitySheet`, `SearchBox`, `MovieCard`, `MovieRow`, `HeroCarousel`, `DateStrip`, `FilterBar`, `ShowtimeChip`, `CinemaShowtimeRow`, `Stepper`, `SeatMap2D` (virtualised, zoomable), `SeatLegend`, `SeatPopover`, `BestAvailableButton`, `Explore3DButton`, `PriceSummary`, `HoldTimer`, `CouponField`, `QuantityStepper`, `TrailerPlayer`, `MiniPlayerDock`, `TicketCard`, `Toast`, `Sheet`, `EmptyState`, `ErrorState`, `Skeleton`. Storybook (or equivalent) with all states for each.

## 8. Quality gates for design
No visible text under 14 px (automated scan); Lighthouse (mobile) ≥ 90 performance/accessibility/best-practices/SEO on home, movie detail and the standard seat map; axe with zero serious violations; visual regression screenshots at 360, 768, 1280; keyboard-only run of the full booking journey; reduced-motion run; 200% zoom and 320 px reflow; colour-blind simulation check of seat states.
