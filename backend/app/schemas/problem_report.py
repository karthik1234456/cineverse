from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class ProblemReportCreate(BaseModel):
    user_description: str = Field(..., min_length=3, description="User description of the observed bug or problem")
    expected_behavior: Optional[str] = Field(None, description="What the user expected to happen")
    screenshot_base64: Optional[str] = Field(None, description="Base64 encoded JPEG/PNG screenshot")

    url: str
    route: str
    query_params: Optional[Dict[str, Any]] = None
    build_stamp: Optional[str] = None

    auditorium_id: Optional[str] = None
    showtime_id: Optional[int] = None
    cinema_id: Optional[int] = None
    mode: Optional[str] = None  # overview, walk, seated
    selected_seats: Optional[List[str]] = None

    console_logs: Optional[List[Dict[str, Any]]] = None  # up to 50
    network_requests: Optional[List[Dict[str, Any]]] = None  # up to 20 failed/slow
    browser_info: Optional[Dict[str, Any]] = None
    render_metrics: Optional[Dict[str, Any]] = None


class ProblemReportUpdate(BaseModel):
    status: Optional[str] = None  # open, in_progress, resolved, archived
    admin_notes: Optional[str] = None


class ProblemReportResponse(BaseModel):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    status: str
    user_description: str
    expected_behavior: Optional[str] = None

    screenshot_url: Optional[str] = None

    url: str
    route: str
    query_params: Optional[Dict[str, Any]] = None
    build_stamp: Optional[str] = None

    auditorium_id: Optional[str] = None
    showtime_id: Optional[int] = None
    cinema_id: Optional[int] = None
    mode: Optional[str] = None
    selected_seats: Optional[List[str]] = None

    console_logs: Optional[List[Dict[str, Any]]] = None
    network_requests: Optional[List[Dict[str, Any]]] = None
    browser_info: Optional[Dict[str, Any]] = None
    render_metrics: Optional[Dict[str, Any]] = None

    reporter_ip: Optional[str] = None
    admin_notes: Optional[str] = None
    antigravity_prompt: Optional[str] = None

    class Config:
        from_attributes = True


def generate_antigravity_prompt(report: Any) -> str:
    """
    Generate a ready-to-paste markdown prompt formatted specifically for Antigravity AI assistant.
    Includes likely affected components deduced from route and mode.
    """
    route = getattr(report, "route", "") or ""
    mode = getattr(report, "mode", "") or ""
    url = getattr(report, "url", "") or ""
    desc = getattr(report, "user_description", "") or "No description provided"
    expected = getattr(report, "expected_behavior", "") or "Expected page to function without errors"
    build = getattr(report, "build_stamp", "") or "unknown"
    seats = getattr(report, "selected_seats", []) or []
    audi_id = getattr(report, "auditorium_id", "") or "N/A"
    showtime_id = getattr(report, "showtime_id", "") or "N/A"
    cinema_id = getattr(report, "cinema_id", "") or "N/A"
    browser = getattr(report, "browser_info", {}) or {}
    metrics = getattr(report, "render_metrics", {}) or {}
    logs = getattr(report, "console_logs", []) or []
    requests = getattr(report, "network_requests", []) or []

    # Map likely affected components
    components = []
    if "auditorium" in route or "3d" in url or mode:
        components.append("frontend/components/3d/CinemaWorld.tsx")
        components.append("frontend/components/3d/ProceduralAuditorium.tsx")
        components.append("frontend/store/useCinemaStore.ts")
        components.append("frontend/lib/proceduralAuditorium.ts")
        if mode == "walk":
            components.append("frontend/components/3d/WalkController.tsx")
            components.append("frontend/lib/walkCollision.ts")
        elif mode in ("overview", "orbit", "look around"):
            components.append("frontend/components/3d/CameraController.tsx")
        elif mode in ("seated", "pov", "sit"):
            components.append("frontend/components/3d/CameraController.tsx")
            components.append("frontend/lib/seatView.ts")
            components.append("frontend/components/3d/MotionEffectsOverlay.tsx")
        components.append("backend/app/api/v1/showtimes.py")
        components.append("backend/app/services/theatre_type_registry.py")
    elif "checkout" in route or "booking" in route:
        components.append("frontend/app/checkout/page.tsx")
        components.append("frontend/components/checkout/PaymentGatewayModal.tsx")
        components.append("backend/app/api/v1/bookings.py")
        components.append("backend/app/api/v1/payments.py")
    elif "movies" in route:
        components.append("frontend/app/movies/[id]/page.tsx")
        components.append("frontend/components/TrailerPlayer.tsx")
        components.append("backend/app/api/v1/movies.py")
    elif "cinemas" in route:
        components.append("frontend/app/cinemas/[cinemaId]/page.tsx")
        components.append("frontend/components/map/CinemaMap.tsx")
        components.append("backend/app/api/v1/cinemas.py")
    elif "admin" in route:
        components.append("frontend/app/admin/page.tsx")
        components.append("backend/app/api/v1/admin.py")
    else:
        components.append("frontend/app/layout.tsx")
        components.append("frontend/components/Navbar.tsx")

    # Format console log snippet
    log_lines = []
    for l in (logs or [])[-20:]:  # last 20
        lvl = (l.get("level") or "LOG").upper()
        msg = l.get("message") or ""
        log_lines.append(f"[{lvl}] {msg}")
    logs_str = "\n".join(log_lines) if log_lines else "No console messages recorded."

    # Format network requests
    req_lines = []
    for r in (requests or [])[-10:]:
        st = r.get("status", "ERR")
        dur = r.get("durationMs", 0)
        mth = r.get("method", "GET")
        u = r.get("url", "")
        req_lines.append(f"- `{mth} {u}` -> HTTP {st} ({dur}ms)")
    reqs_str = "\n".join(req_lines) if req_lines else "No failed or slow network requests recorded."

    prompt = f"""# Bug Report: {desc[:60]}

## 1. Context & Environment
- **URL**: `{url}`
- **Route**: `{route}`
- **Build Stamp**: `{build}`
- **Cinema ID**: `{cinema_id}` | **Auditorium**: `{audi_id}` | **Showtime**: `{showtime_id}`
- **Mode**: `{mode or 'Standard 2D'}`
- **Selected Seats**: {', '.join(seats) if seats else 'None'}
- **Viewport**: {browser.get('viewportWidth', 'N/A')}x{browser.get('viewportHeight', 'N/A')} (DPR: {browser.get('devicePixelRatio', 1)})
- **Render Stats**: {metrics.get('fps', 'N/A')} FPS | Frame Time: {metrics.get('frameTimeMs', 'N/A')}ms | Quality: {metrics.get('qualityTier', 'N/A')}

## 2. Issue Description
**Observed Behavior**:
{desc}

**Expected Behavior**:
{expected}

## 3. Likely Affected Components & Files
{chr(10).join(f'- `{c}`' for c in components)}

## 4. Diagnostics & Telemetry
### Network Activity (Slow or Failed Requests)
{reqs_str}

### Recent Console Output
```text
{logs_str}
```

## 5. Instructions for Antigravity
1. Investigate the failure scenario described above.
2. Inspect the likely components and review the captured console/network telemetry.
3. Apply the fix and verify in test mode.
"""
    return prompt.strip()

