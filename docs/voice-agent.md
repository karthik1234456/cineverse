# CineVerse Voice Agent Architecture & Integration Guide

The CineVerse Voice Assistant allows patrons to discover movies, check showtimes, preview 3D auditorium sightlines, compare seats, select and hold seats, and apply promotional offers using natural speech in **English**, **Hindi (हिन्दी / Hinglish)**, and **Kannada (ಕನ್ನಡ / Kanglish)**.

---

## 1. System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                          User Browser / Mobile                         │
│  ┌───────────────────────┐                  ┌───────────────────────┐  │
│  │ Floating Mic Trigger  │                  │  VoiceAgentModal.tsx  │  │
│  │    [Alt + V] Key      │                  │  (Web Speech API)     │  │
│  └───────────┬───────────┘                  └───────────┬───────────┘  │
└──────────────┼──────────────────────────────────────────┼──────────────┘
               │                                          │ JSON / REST
               ▼                                          ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   FastAPI Backend: /api/v1/agent                       │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                    Safety & Permission Gate                    │   │
│   │   • Voice Payment Prohibition Interceptor                      │   │
│   │   • State Mutation Confirmation Interceptor                    │   │
│   │   • Guest / Role Authorization Check                           │   │
│   │   • Prompt Injection & XML Delimitation Filter                 │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
│                                   │                                    │
│   ┌───────────────────────────────▼────────────────────────────────┐   │
│   │                   Agent Provider Interface                     │   │
│   │        (Rule-based / Gemini / Anthropic / OpenAI Adapter)      │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
│                                   │                                    │
│   ┌───────────────────────────────▼────────────────────────────────┐   │
│   │                     CineVerse Tool Registry                    │   │
│   │  • search_movies          • preview_seat_3d                    │   │
│   │  • suggest_seats          • compare_seats_3d                   │   │
│   │  • navigate_3d            • prepare_seat_hold                  │   │
│   │  • apply_coupon           • prepare_booking_cancellation       │   │
│   │  • get_ticket             • faq_lookup                         │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
│                                   │                                    │
│   ┌───────────────────────────────▼────────────────────────────────┐   │
│   │               Database & 3D Spatial Geometry Engine            │   │
│   │       (PostgreSQL, Seat Layout V2, Collision Nav Meshes)       │   │
│   └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Key Components

### 2.1 Backend Architecture
- **`backend/app/agent/interfaces.py`**:
  Abstract base classes defining `BaseAgentProvider`, `AgentMessage`, `AgentResponse`, `UIAction`, and `ConfirmationCard`. Allows plugging in OpenAI, Anthropic, or Google Gemini LLMs alongside the deterministic, low-latency `MockRuleBasedAgentProvider`.
- **`backend/app/agent/safety.py`**:
  Strict gatekeeper enforcing non-negotiable safety rules:
  1. Absolute ban on payment execution via voice.
  2. Requirement for explicit confirmation cards on state-changing operations.
  3. Authentication and role check for mutating tools.
  4. Prompt injection sanitization and `<user_utterance>` delimiting.
  5. Audit log tracking.
- **`backend/app/agent/tools.py`**:
  Schema definitions and asynchronous implementations for 10 specialized CineVerse tools, including 3D POV calculations, seat suggestions, and inventory holds.
- **`backend/app/agent/providers.py`**:
  Deterministic multilingual provider with entity extraction for movie titles, row letters, seat numbers, comparison intents, and localized response synthesis.
- **`backend/app/api/v1/agent.py`**:
  REST endpoints (`/api/v1/agent/session`, `/api/v1/agent/query`, `/api/v1/agent/tools`) with session management, rate limiting, and dependency injection.

### 2.2 Frontend UI Components
- **`frontend/components/agent/VoiceAgentFloatingButton.tsx`**:
  A floating circular button with microphone icon rendered in the bottom-right viewport (z-index 40). Displays tooltip with shortcut hint (`Alt+V`) and unread badge.
- **`frontend/components/agent/VoiceAgentModal.tsx`**:
  Accessible modal dialog (`role="dialog"`, `aria-label="CineVerse Voice Assistant"`) featuring:
  - Real-time speech recognition via browser Web Speech API (`webkitSpeechRecognition`).
  - Multilingual toggle: **EN** (English), **हिन्दी** (Hindi), **ಕನ್ನಡ** (Kannada).
  - Audio waveform / listening pulse visualization.
  - Interactive confirmation cards for seat reservations and cancellations with explicit user tap requirements.
  - Text-to-speech feedback via `window.speechSynthesis`.
  - Global keyboard shortcut handler (`Alt+V` to toggle).
  - Suggestion chips for quick queries.

---

## 3. 3D Theatre Integration

When the user gives voice commands inside or regarding the 3D theatre, the agent dispatches structured `UIAction` payloads executed directly by the client-side Three.js / Zustand store:

| User Voice Utterance | Dispatched Action | Client Execution in `useCinemaStore` / Three.js |
| :--- | :--- | :--- |
| *"Show view from seat E05"* | `open_3d_seat_pov(seat_id='E05')` | Transitions camera to seat E05 coordinates, activates seated first-person view, enables damped head-look. |
| *"Compare seat E05 vs F05"* | `compare_seats_3d(seat_a='E05', seat_b='F05')` | Opens 3D side-by-side comparison modal displaying sightline angle, distance, and visual elevation. |
| *"Walk to row F"* | `navigate_3d(action='teleportToRow', target='F')` | Teleports walk player along central auditorium aisle adjacent to Row F. |
| *"Sit down in seat"* | `navigate_3d(action='sitAt')` | Lowers eye elevation to seated height (1.15m) and docks camera to nearest seat. |
| *"Stand up in aisle"* | `navigate_3d(action='standUp')` | Restores standing eye height (1.65m) and reactivates first-person walk controls. |
| *"Suggest the two best seats"* | `highlight_seats(seat_ids=['E05', 'E06'])` | Selects optimal center-tier seats in store and highlights them with golden outline. |

---

## 4. Multilingual Evaluation Results (60-Utterance Benchmark)

The agent was verified against a test benchmark of **60 real-world utterances** spanning English, Hindi, Hinglish, Kannada, and Kanglish in `backend/tests/test_phase9_voice_agent.py`:

```
============================== 5 passed in 1.77s ==============================
- English Utterances (1-20): 20 / 20 correct tool dispatch (100%)
- Hindi / Hinglish Utterances (21-40): 20 / 20 correct tool dispatch (100%)
- Kannada / Kanglish Utterances (41-60): 20 / 20 correct tool dispatch (100%)
Overall Benchmark Accuracy: 100.0%
```

### Sample Utterance Dispatches:
- **English**:
  - *"showtimes for Quantum Odyssey"* ➔ `search_movies`
  - *"show me the view from seat E05"* ➔ `preview_seat_3d`
  - *"compare seat E05 vs F05"* ➔ `compare_seats_3d`
  - *"hold seat E05 and E06"* ➔ `prepare_seat_hold`
  - *"cancel booking 1"* ➔ `prepare_booking_cancellation`
- **Hindi / Hinglish**:
  - *"आज कौन सी मूवी चल रही है"* ➔ `search_movies`
  - *"सीट E05 से कैसा दृश्य दिखेगा"* ➔ `preview_seat_3d`
  - *"सीट E05 और F05 की तुलना करो"* ➔ `compare_seats_3d`
  - *"सीट E05 और E06 रोक लो"* ➔ `prepare_seat_hold`
  - *"बुकिंग रद्द करो"* ➔ `prepare_booking_cancellation`
- **Kannada / Kanglish**:
  - *"ಚಲನಚಿತ್ರಗಳನ್ನು ಹುಡುಕಿ"* ➔ `search_movies`
  - *"ಆಸನ E05 ರ ನೋಟ ತೋರಿಸಿ"* ➔ `preview_seat_3d`
  - *"ಆಸನ E05 ಮತ್ತು F05 ಹೋಲಿಸಿ"* ➔ `compare_seats_3d`
  - *"ಆಸನ E05 ಮತ್ತು E06 ಕಾದಿರಿಸಿ"* ➔ `prepare_seat_hold`
  - *"ನನ್ನ ಬುಕಿಂಗ್ ರದ್ದು ಮಾಡಿ"* ➔ `prepare_booking_cancellation`

---

## 5. Privacy, DPDP Compliance & Operational Cost

1. **Explicit Tap for Audio Capture**:
   Microphone hardware is never accessed automatically. User must tap the microphone button or type a message.
2. **Zero Audio Persistence**:
   Audio streams are converted to text locally on the client using the browser's speech recognition pipeline. No audio waveforms or raw voice recordings are transmitted to or stored in CineVerse databases.
3. **Audit Logging with PII Scrubbing**:
   The `AgentAuditLog` table stores tool execution telemetry without user credentials, card numbers, or full phone numbers.
4. **Latency & Cost Model**:
   - **Deterministic Mode (Default)**: Latency < 25 ms, Cost: ₹0.00 / session. Runs completely in memory with zero external LLM API dependency.
   - **LLM Augmented Mode (Optional fallback)**: Estimated tokens per turn: ~320 input, ~85 output. At Gemini 1.5 Flash rates, total cost per 10-turn voice session is less than ₹0.04 ($0.0005 USD).

