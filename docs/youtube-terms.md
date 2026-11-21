# YouTube Player Terms of Service & API Implementation Compliance

**Document Version:** 1.0.0  
**Target Environment:** CineVerse Production & Development Applications  
**Review Status:** Pending Pre-Launch Audit  

---

## 1. Architectural Overview & Technical Implementation

CineVerse integrates promotional trailers strictly through authorized channels: trailers are either embedded through the official player or hosted from files with documented rights. No third-party video downloaders, rippers, or stream extraction tools (e.g., `yt-dlp`, `youtube-dl`, `ytdl-core`, `pytube`) are used or permitted within the codebase.

### Key Technical Safeguards:
1. **Official IFrame API:** All trailer playback utilizes the official YouTube IFrame Player API (`https://www.youtube.com/iframe_api`). No reverse-engineered streams, private APIs, or raw media stream extraction (`.m3u8`, `.mpd`, or `.mp4` URLs) are utilized.
2. **Privacy-Enhanced Domain:** All embeds are served from `https://www.youtube-nocookie.com/embed/{video_id}`, preventing YouTube from setting tracking cookies until the user initiates playback.
3. **Zero Downloading or Local Caching:** Video and audio streams are decoded live by the browser's native media engine directly from YouTube CDN endpoints. CineVerse stores zero audiovisual chunks, cached files, or offline copies on its servers or client devices. Trailers are either embedded through the official player or hosted from files with documented rights.
4. **Unmodified Native Player Chrome & Controls:** The player renders with `controls=1`. Native player controls (play/pause, time scrubber, volume/mute, captions, quality, full-screen, and official YouTube logo) remain visible, unobstructed, and interactable.
5. **Exact Attribution & Watch-on-YouTube Link:** The embedded player retains YouTube's clickable video title and watermark linking directly to the canonical video page on `https://www.youtube.com`.

---

## 2. Display Modes, Layering & Interaction Architecture

CineVerse utilizes a dual-mode presentation architecture designed to respect content owner distribution settings:

### Mode 1: 3D On-Screen Spatial Projection (Behind-Canvas CSS3D Layering)
- **Depth-Correct Z-Ordering:** The WebGL rendering canvas (`z-index: 1`) is positioned in front of the CSS3D YouTube player container (`z-index: 0`). The 3D virtual screen mesh renders with a transparent cutout shader (custom blending `ZeroFactor` destination alpha), punching an exact window through the WebGL scene.
- **Physical Occlusion:** Foregrounds objects—including auditorium seats, handrails, walls, pillars, and moving avatars—are drawn on top of the WebGL canvas and naturally occlude the video player behind them, guaranteeing optical depth accuracy.
- **Non-Clickable IFrame:** Because the WebGL canvas sits in front of the CSS3D player, pointer events outside the viewport do not penetrate to the inner iframe, and users cannot click directly inside the YouTube player during 3D auditorium navigation.
- **Official API Controls:** CineVerse provides full playback control through its custom HUD and bottom bar controls communicating directly with the official YouTube IFrame Player API:
  - **Play / Pause:** `player.playVideo()` / `player.pauseVideo()`
  - **Mute / Unmute:** `player.mute()` / `player.unMute()`
  - **Volume:** `player.setVolume(val)`
  - **Restart / Seek:** `player.seekTo(0, true)`
  - **Closed Captions Toggle:** `player.loadModule('captions')` / `player.unloadModule('captions')`
- **Transparent Attribution:** The YouTube watermark and canonical video title are rendered within the player boundary.

### Mode 2: Theatre Mode
- **User-Initiated Only:** Theatre Mode is activated solely upon explicit user action (clicking the "Theatre Mode" button or "Watch in Theatre Mode" on error cards). CineVerse contains zero automatic watchdogs or forced mode switches.
- **Direct Interaction:** In Theatre Mode, the player is presented as an expansive modal (85% viewport width) where the user can directly interact with the full YouTube player chrome.
- **Error Handling:** If a content owner restricts embedding (`Error 101`, `Error 150`, `Error 153`), the 3D screen displays a clean title card with a plain message and an optional "Watch in Theatre Mode" button. If playback is choppy, a non-intrusive hint is offered, but playback never automatically switches mode.

---

## 3. YouTube API Services Terms of Service (ToS) Compliance Checklist

| Section | Policy Requirement | CineVerse Implementation Status |
|:---|:---|:---:|
| **III.A.1** | Do not modify, replace, or block YouTube player chrome, branding, or controls | **COMPLIANT** — Full native controls (`controls=1`) are rendered without overlay or CSS masking. |
| **III.A.2** | Do not separate, isolate, or modify audio from video | **COMPLIANT** — Video and audio are synchronously streamed together through the IFrame element. |
| **III.A.3** | Do not facilitate downloading, recording, or offline access | **COMPLIANT** — Zero offline storage or download capabilities exist. |
| **III.B.1** | Respect content owner embedding preferences | **COMPLIANT** — oEmbed status is checked prior to catalog display; errors 101/150/153 are gracefully handled without bypassing restrictions. |
| **III.D.1** | Do not display YouTube content in background tabs or while hidden | **COMPLIANT** — Playback pauses when navigating away or unmounting. |
| **III.E.1** | Transmit authentic referrers and origin parameters | **COMPLIANT** — Embed parameters explicitly include `origin` and `widget_referrer` matching canonical website origin. |

---

## 4. Pre-Launch Legal & Technical Review Requirements

Prior to public launch, the engineering, product, and legal teams must complete and sign off on the following mandatory launch review checklist:

1. **Google Cloud Console Project Registration & Quota Audit:**
   - Verify production project registration with a dedicated Google Cloud Console project and API key under the CineVerse enterprise organization.
   - Request YouTube Data API v3 quota increase (default: 10,000 units/day) to accommodate anticipated launch traffic.
2. **Official YouTube API Compliance Audit:**
   - Submit the YouTube API Services Compliance Audit Form and verify adherence to the Developer Policies.
   - Certify Zero Ad Overlay: confirm that no CineVerse advertising, banners, or interactive modals overlap the active video picture area during playback.
   - Confirm that the user is informed that the video player is embedded via YouTube, and provide a direct "Watch on YouTube" attribution link.
3. **Content Security Policy (CSP) & Referrer Directives:**
   - Production web servers must deploy headers permitting YouTube assets:
     - `frame-src https://www.youtube.com https://www.youtube-nocookie.com;`
     - `script-src https://www.youtube.com https://s.ytimg.com;`
     - `referrer-policy: no-referrer-when-downgrade;` or `origin-when-cross-origin;`
4. **Browser Autoplay & Audio Policy Compliance:**
   - Verify unmuted playback requires explicit user gesture across Chrome, Safari, Edge, and Firefox.
   - Ensure the "Tap for Sound" / unmute prompt reliably triggers audio context unmute via official API `unMute()`.
5. **Accessibility & Captioning Verification:**
   - Verify that closed captions can be toggled via CineVerse controls (`loadModule('captions')` / `unloadModule('captions')`) and that font sizing respects user preferences.
   - Keyboard navigation audit: ensure Tab and Enter keys can reach play/pause, mute, restart, and Theatre Mode buttons.
6. **Privacy Notice & Cookie Banner:**
   - Update the public Privacy Policy and Cookie Consent Manager to disclose the use of YouTube's privacy-enhanced mode (`youtube-nocookie.com`).
   - Disclose that initiating video playback connects to YouTube/Google CDN.
7. **Trademark & Branding Review:**
   - Confirm adherence to [YouTube Brand Guidelines](https://www.youtube.com/howyoutubeworks/resources/brand-resources/), ensuring CineVerse does not imply official endorsement, sponsorship, or partnership with YouTube or Google LLC.

---

## 5. Hosted Trailer Pipeline with Rights Verification & Compliance Guard (§ Part B.2, B.3)

To ensure uncompromised performance and legal rigor, CineVerse maintains a dual video presentation architecture:
1. **Official YouTube Embeds:** Used for titles licensed via YouTube standard streaming under the official IFrame Player API.
2. **Hosted Trailer Pipeline:** Used for cinema titles with direct exhibition rights or open-access creative licenses (e.g. Creative Commons Attribution).
   - **Mandatory Licensing Documentation:** Any hosted trailer attached via the administrator interface requires verified metadata: `rights_holder`, `license_note`, and `expiry_date`.
   - **Automated Verification:** Incoming assets are inspected for file format, file size limits (<150 MB), duration (10–300s), and clean virus scan signatures prior to ingestion.
   - **Optimized Transcoding:** Media is packaged into 720p H.264 MP4 with fast start (`+faststart` moov atom repositioning) and WebM containers, accompanied by synchronous audio preservation and poster extraction.
   - **Signed Expiring Access:** Streaming endpoints require HMAC-SHA256 signed tokens with short expiration windows (`/api/v1/trailers/stream/{id}?token=...&expires=...`).
   - **Automated CI Compliance Guard:** A continuous integration check (`scripts/check-compliance.cjs`) strictly verifies that no video downloaders or ripper tools (e.g. `yt-dlp`, `youtube-dl`, `ytdl-core`) exist in the repository dependencies or codebases, enforcing that trailers are either embedded through the official player or hosted from files with documented rights.
