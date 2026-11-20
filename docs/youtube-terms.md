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

## 2. Display Modes & Graceful Fallback Engine

CineVerse utilizes a dual-mode presentation architecture designed to respect content owner distribution settings:

### Mode 1: 3D On-Screen Spatial Projection (CSS3D)
- Rendered using Three.js CSS3D transform matrices directly aligned with the virtual cinema auditorium screen geometry.
- Used exclusively for titles where the content owner has permitted third-party domain embedding (verified via YouTube's official oEmbed endpoint returning HTTP 200).
- Transparent pointer routing allows natural interaction with the 3D world before playback, switching to native player interactivity once active.

### Mode 2: Theatre Mode Modal Fallback
- Activated automatically when:
  1. A content owner restricts embedding on external websites (`Error 101`, `Error 150`, `Error 153`).
  2. The video is age-restricted or region-locked by the studio.
  3. Video buffering or playback does not start within the 3-second watchdog window.
- The player expands to a high-visibility, framed cinema canvas overlay over the auditorium.
- The 3D screen transitions to the high-resolution movie poster with the message *"Playing in Theatre Mode"*—preventing black screens or visual degradation.

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

Prior to public launch, the engineering and legal teams must complete the following mandatory reviews:

1. **Google Cloud Console Project Registration:**
   - Verify that the production project is registered with a dedicated Google Cloud Console project and API key under the CineVerse enterprise account.
   - Request API quota increases if daily active user traffic is projected to exceed default YouTube Data API v3 quota limits (10,000 units/day).
2. **Content Security Policy (CSP) & Referrer Directives:**
   - Production web servers must deploy headers permitting YouTube assets:
     - `frame-src https://www.youtube.com https://www.youtube-nocookie.com;`
     - `script-src https://www.youtube.com https://s.ytimg.com;`
     - `referrer-policy: no-referrer-when-downgrade;` or `origin-when-cross-origin;`
3. **Privacy Notice & Cookie Banner:**
   - Update the public Privacy Policy and Cookie Consent Manager to disclose the use of YouTube's privacy-enhanced mode (`youtube-nocookie.com`).
   - Disclose that initiating video playback may establish connections to Google/YouTube infrastructure.
4. **Trademark & Branding Review:**
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
