/**
 * Group split-payment state machine (Phase 10). Pure reducer: (state, event) -> {state, effects}.
 * The server executes `effects` (confirm booking, release seats, refunds, charge host) AFTER committing the new state.
 * Rules enforced here: a booking is never confirmed unless the exact total has been captured; duplicate events
 * (by event id AND payment id) are no-ops; payments that arrive too late / wrong amount / unknown member are refunded;
 * every captured paisa is either kept for the confirmed booking or refund-requested (conservation).
 */
import type { Paise } from "./money.ts";
export type Phase = "HELD" | "PARTIALLY_PAID" | "HOST_COVER_PENDING" | "CONFIRMED" | "EXPIRED" | "CANCELLED";
export type Policy = "host_covers" | "refund_all";
export interface Share { memberId: string; amount: Paise; status: "UNPAID" | "PAID" | "REFUND_PENDING" | "REFUNDED"; paymentId?: string }
export interface GroupState {
  phase: Phase; total: Paise; policy: Policy; hostId: string; shares: Record<string, Share>;
  seatsHeld: boolean; seatsBooked: boolean; hostCoverDue: Paise; hostCoverAmount: Paise; hostCoverPaymentId?: string;
  capturedTotal: Paise; refundRequested: Paise; processedEvents: string[]; seenPayments: string[]; confirmEmitted: boolean;
}
export type GroupEvent =
  | { id: string; type: "PAYMENT_CAPTURED"; memberId: string; paymentId: string; amount: Paise }
  | { id: string; type: "PAYMENT_FAILED"; memberId: string }
  | { id: string; type: "HOLD_EXPIRED" }
  | { id: string; type: "HOST_COVER_CAPTURED"; paymentId: string; amount: Paise }
  | { id: string; type: "HOST_COVER_FAILED" }
  | { id: string; type: "CANCEL"; byMemberId: string }
  | { id: string; type: "REFUND_COMPLETED"; paymentId: string };
export type Effect =
  | { kind: "confirmBooking" } | { kind: "releaseSeats" } | { kind: "extendHold"; seconds: number }
  | { kind: "refund"; paymentId: string; amount: Paise; reason: string }
  | { kind: "chargeHost"; amount: Paise } | { kind: "notify"; what: string };

export function createGroup(hostId: string, shares: { memberId: string; amount: Paise }[], policy: Policy): GroupState {
  if (!shares.some((s) => s.memberId === hostId)) throw new Error("host must hold a share");
  if (new Set(shares.map((s) => s.memberId)).size !== shares.length) throw new Error("duplicate member");
  shares.forEach((s) => { if (!Number.isSafeInteger(s.amount) || s.amount <= 0) throw new Error("share must be a positive integer"); });
  const total = shares.reduce((a, s) => a + s.amount, 0);
  return { phase: "HELD", total, policy, hostId, seatsHeld: true, seatsBooked: false, hostCoverDue: 0, hostCoverAmount: 0, capturedTotal: 0,
    refundRequested: 0, processedEvents: [], seenPayments: [], confirmEmitted: false,
    shares: Object.fromEntries(shares.map((s) => [s.memberId, { memberId: s.memberId, amount: s.amount, status: "UNPAID" as const }])) };
}
const terminal = (p: Phase) => p === "CONFIRMED" || p === "EXPIRED" || p === "CANCELLED";
const _unpaidAmount = (s: GroupState) => Object.values(s.shares).filter((x) => x.status !== "PAID").reduce((a, x) => a + x.amount, 0);

function refundAllPaid(s: GroupState, fx: Effect[], reason: string) {
  for (const sh of Object.values(s.shares)) if (sh.status === "PAID" && sh.paymentId) {
    sh.status = "REFUND_PENDING"; s.refundRequested += sh.amount; fx.push({ kind: "refund", paymentId: sh.paymentId, amount: sh.amount, reason });
  }
  if (s.hostCoverPaymentId && s.hostCoverAmount > 0) { s.refundRequested += s.hostCoverAmount; fx.push({ kind: "refund", paymentId: s.hostCoverPaymentId, amount: s.hostCoverAmount, reason }); s.hostCoverAmount = 0; }
}
function endBad(s: GroupState, phase: "EXPIRED" | "CANCELLED", fx: Effect[], reason: string) {
  refundAllPaid(s, fx, reason); s.phase = phase;
  if (s.seatsHeld) { s.seatsHeld = false; fx.push({ kind: "releaseSeats" }); }
  fx.push({ kind: "notify", what: phase.toLowerCase() });
}
function tryConfirm(s: GroupState, fx: Effect[]) {
  if (s.confirmEmitted || s.phase === "CONFIRMED") return;
  const all = Object.values(s.shares), paid = all.filter((x) => x.status === "PAID").reduce((a, x) => a + x.amount, 0);
  if (all.every((x) => x.status === "PAID") && paid === s.total) {
    s.phase = "CONFIRMED"; s.seatsBooked = true; s.seatsHeld = false; s.confirmEmitted = true;
    fx.push({ kind: "confirmBooking" }, { kind: "notify", what: "confirmed" });
  }
}
const unpaidAmountAtCover = (s: GroupState) => s.total - Object.values(s.shares).filter((x) => x.status === "PAID").reduce((a, x) => a + x.amount, 0);

export function reduce(prev: GroupState, e: GroupEvent): { state: GroupState; effects: Effect[] } {
  const s: GroupState = structuredClone(prev), fx: Effect[] = [];
  if (s.processedEvents.includes(e.id)) return { state: prev, effects: [] };           // idempotent by event id
  s.processedEvents.push(e.id);
  switch (e.type) {
    case "PAYMENT_CAPTURED": {
      if (s.seenPayments.includes(e.paymentId)) return { state: s, effects: [] };            // idempotent by payment id (same payment, new event id)
      s.seenPayments.push(e.paymentId); s.capturedTotal += e.amount;
      const sh = s.shares[e.memberId];
      const refund = (reason: string) => { s.refundRequested += e.amount; fx.push({ kind: "refund", paymentId: e.paymentId, amount: e.amount, reason }); };
      if (terminal(s.phase) || s.phase === "HOST_COVER_PENDING") refund("late payment");
      else if (!sh) refund("unknown member");
      else if (sh.status !== "UNPAID") refund("duplicate share payment");
      else if (e.amount !== sh.amount) refund("amount mismatch");
      else { sh.status = "PAID"; sh.paymentId = e.paymentId; s.phase = "PARTIALLY_PAID"; tryConfirm(s, fx); }
      break;
    }
    case "PAYMENT_FAILED": fx.push({ kind: "notify", what: "payment_failed" }); break;   // share stays UNPAID (retryable)
    case "HOLD_EXPIRED": {
      if (terminal(s.phase) || s.phase === "HOST_COVER_PENDING") break;
      if (s.policy === "host_covers" && Object.values(s.shares).some((x) => x.status === "PAID")) {
        s.phase = "HOST_COVER_PENDING"; const due = unpaidAmountAtCover(s);
        fx.push({ kind: "extendHold", seconds: 120 }, { kind: "chargeHost", amount: due });
        s.hostCoverAmount = 0; s.hostCoverDue = due;
      } else endBad(s, "EXPIRED", fx, "group hold expired");
      break;
    }
    case "HOST_COVER_CAPTURED": {
      if (s.seenPayments.includes(e.paymentId)) return { state: s, effects: [] };
      s.seenPayments.push(e.paymentId); s.capturedTotal += e.amount;
      const due = s.hostCoverDue;
      if (s.phase !== "HOST_COVER_PENDING" || due <= 0 || e.amount !== due) { s.refundRequested += e.amount; fx.push({ kind: "refund", paymentId: e.paymentId, amount: e.amount, reason: "unexpected host cover" }); break; }
      s.hostCoverAmount = e.amount; s.hostCoverPaymentId = e.paymentId;
      s.phase = "CONFIRMED"; s.seatsBooked = true; s.seatsHeld = false; s.confirmEmitted = true;
      fx.push({ kind: "confirmBooking" }, { kind: "notify", what: "confirmed" }); break;
    }
    case "HOST_COVER_FAILED": if (s.phase === "HOST_COVER_PENDING") endBad(s, "EXPIRED", fx, "host cover failed"); break;
    case "CANCEL": if (e.byMemberId === s.hostId && !terminal(s.phase)) endBad(s, "CANCELLED", fx, "cancelled by host"); break;
    case "REFUND_COMPLETED": for (const sh of Object.values(s.shares)) if (sh.paymentId === e.paymentId && sh.status === "REFUND_PENDING") sh.status = "REFUNDED"; break;
  }
  return { state: s, effects: fx };
}
/** Returns a list of violated invariants (empty = healthy). Call after every transition in tests and in production assertions. */
export function checkInvariants(s: GroupState, allEffects: Effect[]): string[] {
  const bad: string[] = [], confirms = allEffects.filter((x) => x.kind === "confirmBooking").length;
  const paid = Object.values(s.shares).filter((x) => x.status === "PAID").reduce((a, x) => a + x.amount, 0);
  if (confirms > 1) bad.push("confirmBooking emitted more than once");
  if (s.phase === "CONFIRMED" && paid + s.hostCoverAmount !== s.total) bad.push("confirmed without exact total");
  if (s.phase === "CONFIRMED" && confirms !== 1) bad.push("confirmed without exactly one confirm effect");
  if (s.phase !== "CONFIRMED" && confirms > 0) bad.push("confirm effect emitted but not confirmed");
  if (s.refundRequested > s.capturedTotal) bad.push("refunds exceed captured money");
  const kept = s.capturedTotal - s.refundRequested;
  if (s.phase === "CONFIRMED" && kept !== s.total) bad.push(`kept ${kept} != total ${s.total}`);
  if ((s.phase === "EXPIRED" || s.phase === "CANCELLED") && kept !== 0) bad.push("terminal-bad state still holds money");
  if (!terminal(s.phase) && s.phase !== "HOST_COVER_PENDING" && !s.seatsHeld) bad.push("seats released while still active");
  if ((s.phase === "EXPIRED" || s.phase === "CANCELLED") && (s.seatsHeld || s.seatsBooked)) bad.push("bad terminal state keeps seats");
  if (s.phase === "CONFIRMED" && !s.seatsBooked) bad.push("confirmed but seats not booked");
  if (allEffects.some((x) => x.kind === "releaseSeats") && s.phase === "CONFIRMED") bad.push("seats released and confirmed");
  return bad;
}
