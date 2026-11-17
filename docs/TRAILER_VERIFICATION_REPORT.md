# CineVerse 3D Screen Trailer Verification Report (v2)

**Branch:** `feature/trailer-honest-verification-real-screen`  
**Execution Environment:** Headed Google Chrome (ANGLE WebGL Hardware Acceleration, real network access, real user click gesture)  
**Pass Criteria:**
1. **Screen Size Integrity:** Test cameras and orientation tests derive positions dynamically from each auditorium's real screen position and scene size; reported dimensions strictly match the auditorium side panel and geometry.
2. **Wall-Clock Based Playback Speed Verification:** High-resolution wall-clock timestamps (`performance.now()`) recorded concurrently with media time. The playback rate ratio $\Delta t_{\text{media}} / \Delta t_{\text{wall}}$ must satisfy $0.80 \le \text{Ratio} \le 1.20$ (nominal $1.000\times$).
3. **Player State:** State === `1` (`YT.PlayerState.PLAYING`) / HTML5 `<video>` unpaused.
4. **Visual Motion Verification:** Independent screen region pixel difference $\Delta P > 0$ between samples.
5. **Orientation & Unmirrored Text:** Test card orientation verified: Cyan `[LEFT]` on the left screen half, Yellow `[RIGHT]` on the right screen half across 3 dynamically derived camera views (Center, Left, Right).
6. **Fallback Honesty & Runtime Safety:** Theatre Mode and Title Cards are active runtime fallbacks. Verified transition when YouTube reports error 101, 150, 153 or when the 3-second watchdog expires.

---

## 1. Executive Summary

| Verification Objective | Target | Measured Result | Status |
|:---|:---|:---|:---:|
| **Hall & Screen Layout Coverage** | 6 standard + 4DX + Motion-Seat (8 total) | **8 of 8 halls passed** across all screen types | **PASS** |
| **Real Screen Dimensions Matching** | Side panel == Scene geometry ($0.5\text{m/unit}$) | **100% match** across all 8 auditoriums | **PASS** |
| **Dynamic Test Cameras** | Derived from screen position & size | **Zero hardcoded camera constants** | **PASS** |
| **Wall-Clock Playback Ratio** | $\Delta t_{\text{media}} / \Delta t_{\text{wall}} \in [0.80, 1.20]$ | **$1.000\times - 1.006\times$** (Physical real-time playback) | **PASS** |
| **Player State** | `YT.PlayerState.PLAYING` (`1`) | **State `1`** on all 8 tested halls | **PASS** |
| **Visual Motion Verification** | Pixel Difference $\Delta P > 0$ | **Mean diff: $1.64 - 28.16$, Max diff: $239 - 255$** | **PASS** |
| **Orientation & Mirroring** | Unmirrored across dynamic camera angles | **Cyan $[L]$ on Left, Yellow $[R]$ on Right (8/8 halls)** | **PASS** |
| **Runtime Fallback Safety** | Errors 101/150/153, 3s watchdog, Title Card | **Graceful modal opening; 0 black screens** | **PASS** |
| **Catalog Readiness on Screen** | Truthful metrics on `/dev/readiness` | **77.8% (70/90) on-screen, 22.2% (20/90) Title Card** | **PASS** |

---

## 2. Screen Dimensions & Dynamic Camera Rig

### Scene Units vs. Metric Dimensions
Three.js procedural auditoriums define screen geometry in scene units ($W_s, H_s$). The real-world metric dimensions displayed in the auditorium side panel (`AuditoriumInfoPanel.tsx`) and stored in `proceduralResult.real_world_dimensions` use the scale factor:
$$\text{Width (meters)} = W_s \times 0.5 \quad\text{and}\quad \text{Height (meters)} = H_s \times 0.5$$

For example, in the **Original 100-Seat Reference Hall** (Auditorium 1):
- **Scene Dimensions:** $15.6\text{u} \times 7.25\text{u}$
- **Calculated Metric Dimensions:** $15.6 \times 0.5 = 7.8\text{m}$, $7.25 \times 0.5 = 3.625\text{m} \approx 3.6\text{m}$
- **Side Panel String:** `"2.152:1 Aspect (7.8m × 3.6m)"`

### Dynamic Camera Formulation
All test cameras are derived dynamically per hall based on each screen's real center $[x_c, y_c, z_c]$ and scene width $W_s$:
- **Center Camera:** $[x_c, y_c \times 0.95, z_c - W_s \times 1.25]$
- **Left Camera:** $[x_c - W_s \times 0.45, y_c \times 0.95, z_c - W_s \times 1.10]$
- **Right Camera:** $[x_c + W_s \times 0.45, y_c \times 0.95, z_c - W_s \times 1.10]$
- **Target Point:** $[x_c, y_c, z_c]$

No fixed camera constants or hardcoded scene dimensions are used.

---

## 3. Comprehensive 8-Hall Benchmark Results

Benchmark executed with real network access in headed Google Chrome. Measurements captured via simultaneous browser `performance.now()` wall-clock timestamps and player `getCurrentTime()`.

| # | Hall ID & Name | Registry Screen Type | Scene Size ($W_s \times H_s$) | Metric Size & Side Panel Text | Dynamic Center Cam & Target | Wall Time $\Delta t_w$ | Media Time $\Delta t_m$ | Playback Ratio | Pixel Diff | Orientation Card | Verdict |
|:---:|:---|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 1 | **compact** (Aud 1, 100 seats, ST 3) | `standard_flat` | $15.6\text{u} \times 7.25\text{u}$ | $7.8\text{m} \times 3.6\text{m}$<br>`2.152:1 (7.8m × 3.6m)` | Cam: $[0.0, 5.3, -20.8]$<br>Tgt: $[0.0, 5.5, -1.3]$ | $2.514\text{s}$ | $2.515\text{s}$ | **$1.000\times$** | Mean: $28.16$<br>Max: $255$ | Cyan: $233.0$<br>Yellow: $781.0$ | **PASS** |
| 2 | **standard** (Aud 12, 234 seats, ST 56) | `standard_flat` | $28.0\text{u} \times 13.0\text{u}$ | $14.0\text{m} \times 6.5\text{m}$<br>`2.154:1 (14m × 6.5m)` | Cam: $[0.0, 7.3, -36.3]$<br>Tgt: $[0.0, 7.7, -1.3]$ | $2.974\text{s}$ | $2.974\text{s}$ | **$1.000\times$** | Mean: $9.92$<br>Max: $254$ | Cyan: $307.0$<br>Yellow: $988.5$ | **PASS** |
| 3 | **large_curved** (Aud 2, 216 seats, ST 8) | `large_curved` | $26.0\text{u} \times 12.0\text{u}$ | $13.0\text{m} \times 6.0\text{m}$<br>`2.167:1 (13m × 6m)` | Cam: $[0.0, 6.7, -33.8]$<br>Tgt: $[0.0, 7.1, -1.3]$ | $2.774\text{s}$ | $2.774\text{s}$ | **$1.000\times$** | Mean: $24.16$<br>Max: $255$ | Cyan: $311.2$<br>Yellow: $628.5$ | **PASS** |
| 4 | **premium_direct_view** (Aud 20, 240 seats, ST 99) | `premium_direct_view` | $28.0\text{u} \times 13.0\text{u}$ | $14.0\text{m} \times 6.5\text{m}$<br>`2.154:1 (14m × 6.5m)` | Cam: $[0.0, 7.3, -36.3]$<br>Tgt: $[0.0, 7.7, -1.3]$ | $3.097\text{s}$ | $3.096\text{s}$ | **$1.000\times$** | Mean: $1.64$<br>Max: $239$ | Cyan: $332.7$<br>Yellow: $713.4$ | **PASS** |
| 5 | **boutique** (Aud 13, 240 seats, ST 65) | `boutique_small_flat` | $28.0\text{u} \times 13.0\text{u}$ | $14.0\text{m} \times 6.5\text{m}$<br>`2.154:1 (14m × 6.5m)` | Cam: $[0.0, 7.3, -36.3]$<br>Tgt: $[0.0, 7.7, -1.3]$ | $2.923\text{s}$ | $2.924\text{s}$ | **$1.000\times$** | Mean: $19.46$<br>Max: $250$ | Cyan: $305.7$<br>Yellow: $830.2$ | **PASS** |
| 6 | **panoramic_wrap** (Aud 5, 280 seats, ST 21) | `panoramic_wrap` | $28.0\text{u} \times 13.0\text{u}$ + wings | $14.0\text{m} \times 6.5\text{m}$<br>`2.154:1 (14m × 6.5m)` | Cam: $[0.0, 7.3, -36.3]$<br>Tgt: $[0.0, 7.7, -1.3]$ | $2.983\text{s}$ | $2.984\text{s}$ | **$1.000\times$** | Mean: $18.02$<br>Max: $250$ | Cyan: $342.3$<br>Yellow: $987.1$ | **PASS** |
| 7 | **4dx** (Aud 3, 240 seats, ST 15) | `panoramic_wrap` | $32.0\text{u} \times 15.0\text{u}$ | $16.0\text{m} \times 7.5\text{m}$<br>`2.133:1 (16m × 7.5m)` | Cam: $[0.0, 8.4, -41.3]$<br>Tgt: $[0.0, 8.9, -1.3]$ | $2.999\text{s}$ | $3.000\text{s}$ | **$1.000\times$** | Mean: $18.06$<br>Max: $254$ | Cyan: $588.0$<br>Yellow: $1230.4$ | **PASS** |
| 8 | **motion_seat** (Aud 19, 240 seats, ST 91) | `panoramic_wrap` | $32.0\text{u} \times 15.0\text{u}$ | $16.0\text{m} \times 7.5\text{m}$<br>`2.133:1 (16m × 7.5m)` | Cam: $[0.0, 8.4, -41.3]$<br>Tgt: $[0.0, 8.9, -1.3]$ | $2.911\text{s}$ | $2.930\text{s}$ | **$1.006\times$** | Mean: $17.89$<br>Max: $255$ | Cyan: $583.0$<br>Yellow: $1230.5$ | **PASS** |

*All screenshots and analysis data saved in `evidence/hall-coverage-v2/`.*

---

## 4. Technical Analysis: Resolving the Timing Discrepancy

### The Observation
In earlier runs, a nominal 2.5s window (`await page.waitForTimeout(2500)`) reported media time advancing between $2.84\text{s}$ and $3.02\text{s}$.

### Root Cause
1. **Playwright CDP Latency:** When the automation script calls `page.evaluate()` from Node.js over the Chrome DevTools Protocol (CDP) WebSocket, round-trip serialization and IPC dispatch on Windows introduces $150\text{ms} - 250\text{ms}$ of latency per call.
2. **Actual Elapsed Wall Clock:** In the previous test, the wall-clock time was not measured inside the browser; only the script sleep was timed. Because Sample 1 was evaluated, followed by a 2.50s delay, followed by Sample 2 evaluation, the actual wall-clock time elapsed inside the browser between the execution of Sample 1 and Sample 2 was:
$$t_{\text{elapsed}} = 2500\text{ms} + \Delta t_{\text{CDP1}} + \Delta t_{\text{CDP2}} \approx 2850\text{ms} - 3050\text{ms}$$
3. **Resolution & Proof:** By capturing `performance.now()` in the browser simultaneously with `getCurrentTime()` during both samples, the true ratio was isolated:
$$\text{Playback Ratio} = \frac{\Delta t_{\text{media}}}{\Delta t_{\text{wall}}} = \frac{2.974\text{s}}{2.974\text{s}} = 1.000\times$$
This confirms that the video plays at normal $1.000\times$ physical speed without fast-forwarding or skipping.

---

## 5. Fallback Honesty & Runtime Testing

CineVerse does **not** claim that real movies never fall back. Fallback to Theatre Mode and Title Cards are essential features that guarantee patrons never experience a broken UI or black screen.

### Verified Runtime Fallback Behaviors
Tested via `scripts/verify_runtime_fallbacks.cjs`:
1. **YouTube Error 150 (Owner Disabled Embedding):**
   - When an unlisted or studio video refuses embedding via error 150, `onPlayerError` immediately flags the video.
   - **Result:** Theatre Mode modal opens within $1398\text{ms}$ (`isTheatreMode: true`). The 3D screen displays the high-resolution poster with *"Playing in Theatre Mode"*.
2. **YouTube Error 101 / 153 (Domain / Embedding Blocked):**
   - Handled identically to error 150.
   - **Result:** Theatre Mode opens in $1048\text{ms}$ (`isTheatreMode: true`).
3. **3-Second Watchdog Timer:**
   - If playback fails to advance by at least $1.0\text{s}$ within $3.0\text{s}$ of pressing play (e.g., due to silent autoplay blocks or slow buffering), the watchdog triggers.
   - **Result:** Automatic fallback to Theatre Mode at $3522\text{ms}$.
4. **Title Card Fallback (Catalog Titles without Video Assets):**
   - When a movie in the database has no hosted trailer and no valid YouTube ID, the 3D screen renders an animated canvas Title Card with cinematic typography and backdrop artwork.

### Catalog Readiness Metrics (`/dev/readiness`)
Live endpoint `/api/v1/dev/test-tmdb` and frontend `/dev/readiness` display truthful catalog capabilities:
- **Playable Directly on 3D Screen:** **77.8%** (70 of 90 titles: 50 hosted WebM/MP4 + 20 embeddable YouTube trailers)
- **Title Card Only:** **22.2%** (20 of 90 titles: e.g., *Mookuthi Amman 2*, *Scene*, *DNK*, *Good Bad Ugly*, *The Gorge*)
- **Theatre Mode Only:** **0%** (Currently 0 titles permanently restricted to Theatre Mode, because non-embeddable videos are filtered during catalog sync).

---

## 6. System Status Audit Table

Status of all six core system items with concrete verifiable evidence:

| Item | Status | Key Metrics & Latency | Verifiable Evidence |
|:---|:---:|:---|:---|
| **1. Seat selection speed & Checkout 500 error** | **DONE** | Hold: $48.3\text{ms}$ (HTTP 200)<br>Quote: $30.3\text{ms}$ (HTTP 200) | Validated via `scripts/verify_system_status.py`. Database locks inventory atomically; quote endpoint returns locked pricing with zero 500 errors. |
| **2. User Sign-in** | **DONE** | Login: $395.7\text{ms}$ (HTTP 200) | `POST /api/v1/auth/login` successfully issues JWT `access_token` and sets HTTP-only session cookie for `patron@example.com`. |
| **3. TMDB Network Banner** | **DONE** | Cached 5-min probe (HTTP 200) | Banner is restricted to `/dev/readiness` and development diagnostics; completely excluded from customer booking routes. Cached for 5 minutes. |
| **4. Brightness in the halls** | **DONE** | 3 house lighting tiers | `TheatreLighting.tsx` & `ProceduralAuditorium.tsx` support 'bright', 'dim', and 'show' modes with cove lighting (0.5 to 3.6 emissive) and step skirtings. |
| **5. Missing-seats in large hall** | **DONE** | 512 / 512 seats rendered | Auditorium 4 (*Luxe Recliner Lounge*) verified: all 512 seats correctly generated via `curved_flagship` arc projection without bounding box clipping. |
| **6. Walk and Look around fixes** | **DONE** | Head-look clamps: $\pm 80^\circ$ yaw, $\pm 35^\circ$ pitch | `CameraController.tsx` clamps seated head-rotation; `WalkHUD.tsx` enforces collision boundary detection preventing camera clipping. |

*Full JSON results recorded in `evidence/system_status_audit.json`.*

---

## 7. YouTube Terms & Launch Compliance

A complete compliance review document has been created at [docs/youtube-terms.md](file:///d:/projects/CineVerse/docs/youtube-terms.md).

**Key Compliance Aspects:**
- **No Stream Rip or Download:** Videos are rendered via YouTube's official iframe player API; no raw media files are intercepted.
- **Privacy-Enhanced Mode:** Embeds use `www.youtube-nocookie.com`.
- **Branding & Native Controls:** Official YouTube watermark and branding remain unobstructed.
- **Pre-Launch Review Checklist:** Covers API quota limits, commercial licensing review, and domain verification.
