# Phase 10: Group Booking & Split Payment Architecture & Invariant Specification

## 1. Overview & Objective
Phase 10 enables friends to choose seats together in real-time on both the 2D Seat Map and 3D Auditorium, with each member paying their own share through an individual Razorpay order. The system guarantees that **no seat or money is lost if someone doesn't pay**, and a booking is **never confirmed unless the exact total has been captured**.

---

## 2. Formal State Machine Design

The group split-payment lifecycle is modeled as a **pure state transition function**:
$$\text{reduce}: (\text{GroupState}, \text{GroupEvent}) \longrightarrow (\text{GroupState}', [\text{Effect}])$$

The server executes effects (confirm booking, release seats, trigger refunds, charge host, broadcast notifications) **only after** committing the updated state to PostgreSQL.

### State Phases (`Phase`):
- `HELD`: Group has locked seats for a showtime with an active hold window (default 10 minutes).
- `PARTIALLY_PAID`: At least one member has successfully paid their allocated share, but unpaid shares remain.
- `HOST_COVER_PENDING`: Hold window expired under the `HOST_COVERS` policy with partial payments. An automatic attempt is made to charge the host for the remaining balance.
- `CONFIRMED`: Terminal success state. The exact total amount has been captured. Seats are marked as booked, and individual tickets are issued.
- `EXPIRED`: Terminal failure state. Hold window elapsed under `AUTO_REFUND` (or host cover failed). All captured funds are queued for refund; seats are released back to inventory.
- `CANCELLED`: Terminal failure state. The host explicitly cancelled the group booking before confirmation. All captured funds are queued for refund; seats are released.

### Event Types (`GroupEvent`):
- `PAYMENT_CAPTURED`: A member paid their assigned share amount via Razorpay.
- `PAYMENT_FAILED`: A payment attempt failed. Share remains `UNPAID` and retryable.
- `HOLD_EXPIRED`: The countdown timer for the group hold elapsed.
- `HOST_COVER_CAPTURED`: The host successfully covered the unpaid balance.
- `HOST_COVER_FAILED`: The host cover payment failed.
- `CANCEL`: Host cancelled the group session.
- `REFUND_COMPLETED`: Gateway confirmed refund processing for a specific payment ID.

### Effects (`Effect`):
- `{ kind: "confirmBooking" }`: Convert held seats to confirmed booking in `bookings` table.
- `{ kind: "releaseSeats" }`: Delete seat holds, returning inventory to available.
- `{ kind: "extendHold", seconds: number }`: Add extra grace period (e.g. 120s for host cover).
- `{ kind: "refund", paymentId: string, amount: Paise, reason: string }`: Issue gateway refund.
- `{ kind: "chargeHost", amount: Paise }`: Attempt off-session/card charge or host payment prompt.
- `{ kind: "notify", what: string }`: Send WebSocket/email notification to group members.

---

## 3. Strict System Invariants

The state machine verifies the following **6 invariants after every single transition**, both in automated test suites and as runtime assertions:

1. **Exact Total Confirmation**:
   $$\text{phase} = \text{CONFIRMED} \iff \text{capturedTotal} - \text{refundRequested} = \text{total}$$
   A booking is confirmed only when the captured balance exactly equals the server-locked quote total, and `confirmBooking` is emitted **exactly once**.

2. **Money Conservation**:
   $$\text{capturedTotal} = \text{keptAmount} + \text{refundRequested}$$
   In `EXPIRED` or `CANCELLED` phases, $\text{keptAmount} \equiv 0$ (all captured money is queued for refund). In `CONFIRMED` phase, $\text{keptAmount} \equiv \text{total}$.

3. **Strict Idempotency**:
   - Duplicate event IDs are strict no-ops ($\Delta \text{State} = \emptyset, \text{Effects} = []$).
   - Duplicate payment IDs (even under distinct event IDs) are strict no-ops.

4. **Zero Bad Money Retention**:
   Payments that arrive late (after `CONFIRMED`, `EXPIRED`, or `CANCELLED`), with wrong amounts, for unknown members, or duplicate payments for an already paid share are **immediately refunded**.

5. **Seat State Invariant**:
   - Seats are never released after `CONFIRMED`.
   - Seats are never booked without `CONFIRMED`.
   - Seats are unconditionally released in `EXPIRED` and `CANCELLED`.

6. **Role & Share Permissions**:
   - Only the designated host (`host_user_id`) can cancel the group booking or trigger finalization.
   - Members can only view and pay for their own allocated share.

---

## 4. Integer Paise Arithmetic & Remainder Distribution
All monetary calculations strictly use integer **paise** ($1\text{ INR} = 100\text{ paise}$).
When splitting a total $T$ among $N$ members:
$$\text{base} = \lfloor T / N \rfloor, \quad \text{rem} = T \pmod N$$
The remainder $\text{rem}$ paise are distributed deterministically by adding 1 paisa to the first $\text{rem}$ members (starting with the host).
$$\sum_{i=1}^N \text{share}_i \equiv T \quad \text{guaranteed with zero rounding error}.$$

---

## 5. Security & Anti-Abuse Controls
1. **Opaque Expiring Invite Tokens**: Generated using `secrets.token_urlsafe(32)`. Single-purpose, revokable by host, expiring after 24 hours or showtime.
2. **Anti-Hoarding Rate Limits**: Maximum 2 active unconfirmed group bookings per user at any time.
3. **IDOR Prevention**: All member queries strictly check `user_id == current_user.id` or `host_user_id == current_user.id`.
4. **WebSocket Authentication**: Tickets and seat updates over WebSocket require authenticated user JWTs with origin verification.
