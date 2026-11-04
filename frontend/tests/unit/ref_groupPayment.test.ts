import test from "node:test";
import assert from "node:assert/strict";
import { createGroup, reduce, checkInvariants, type GroupState, type GroupEvent, type Effect, type Policy } from "../../lib/groupPayment.ts";
import { splitEqual } from "../../lib/money.ts";

const mk = (policy: Policy = "refund_all", amounts = [21234, 21233, 21233]) => createGroup("host", amounts.map((a, i) => ({ memberId: i === 0 ? "host" : `m${i}`, amount: a })), policy);
function run(s: GroupState, events: GroupEvent[]) {
  const all: Effect[] = [];
  for (const e of events) { const r = reduce(s, e); s = r.state; all.push(...r.effects); assert.deepEqual(checkInvariants(s, all), [], `after ${e.type} ${e.id}`); }
  return { s, all };
}
const pay = (id: string, memberId: string, amount: number, paymentId = `pay_${id}`): GroupEvent => ({ id, type: "PAYMENT_CAPTURED", memberId, paymentId, amount });
const count = (fx: Effect[], k: string) => fx.filter((x) => x.kind === k).length;

test("happy path: everyone pays exact share -> CONFIRMED once, seats booked, nothing refunded", () => {
  const { s, all } = run(mk(), [pay("1", "host", 21234), pay("2", "m1", 21233), pay("3", "m2", 21233)]);
  assert.equal(s.phase, "CONFIRMED"); assert.equal(count(all, "confirmBooking"), 1); assert.ok(s.seatsBooked && !s.seatsHeld); assert.equal(s.refundRequested, 0);
});
test("partial payments keep PARTIALLY_PAID and never confirm", () => {
  const { s, all } = run(mk(), [pay("1", "host", 21234), pay("2", "m1", 21233)]);
  assert.equal(s.phase, "PARTIALLY_PAID"); assert.equal(count(all, "confirmBooking"), 0); assert.ok(s.seatsHeld);
});
test("refund_all: hold expires with partial payments -> EXPIRED, seats released, every paid share refunded", () => {
  const { s, all } = run(mk("refund_all"), [pay("1", "host", 21234), pay("2", "m1", 21233), { id: "x", type: "HOLD_EXPIRED" }]);
  assert.equal(s.phase, "EXPIRED"); assert.equal(count(all, "releaseSeats"), 1); assert.equal(count(all, "refund"), 2);
  assert.equal(s.refundRequested, 21234 + 21233); assert.equal(s.capturedTotal - s.refundRequested, 0);
});
test("expiry with nobody paid -> EXPIRED, seats released, no refunds", () => {
  const { s, all } = run(mk(), [{ id: "x", type: "HOLD_EXPIRED" }]); assert.equal(s.phase, "EXPIRED"); assert.equal(count(all, "refund"), 0); assert.equal(count(all, "releaseSeats"), 1);
});
test("host_covers: expiry charges the host exactly the unpaid remainder and keeps seats; success -> CONFIRMED with kept == total", () => {
  const { s, all } = run(mk("host_covers"), [pay("1", "host", 21234), pay("2", "m1", 21233), { id: "x", type: "HOLD_EXPIRED" }]);
  assert.equal(s.phase, "HOST_COVER_PENDING"); assert.deepEqual(all.filter((e) => e.kind === "chargeHost"), [{ kind: "chargeHost", amount: 21233 }]);
  assert.equal(count(all, "releaseSeats"), 0); assert.ok(s.seatsHeld);
  const r = run(s, [{ id: "hc", type: "HOST_COVER_CAPTURED", paymentId: "pay_cover", amount: 21233 }]);
  assert.equal(r.s.phase, "CONFIRMED"); assert.equal(r.s.capturedTotal - r.s.refundRequested, r.s.total); assert.equal(count(r.all, "confirmBooking"), 1);
});
test("host_covers: host charge fails -> EXPIRED, everything refunded, seats released", () => {
  const a = run(mk("host_covers"), [pay("1", "host", 21234), { id: "x", type: "HOLD_EXPIRED" }]);
  const b = run(a.s, [{ id: "f", type: "HOST_COVER_FAILED" }]);
  assert.equal(b.s.phase, "EXPIRED"); assert.equal(b.s.capturedTotal - b.s.refundRequested, 0); assert.equal(count(b.all, "releaseSeats"), 1);
});
test("host_covers: wrong host-cover amount is refunded and does not confirm", () => {
  const a = run(mk("host_covers"), [pay("1", "host", 21234), { id: "x", type: "HOLD_EXPIRED" }]);
  const b = run(a.s, [{ id: "hc", type: "HOST_COVER_CAPTURED", paymentId: "pc", amount: 100 }]);
  assert.equal(b.s.phase, "HOST_COVER_PENDING"); assert.equal(count(b.all, "refund"), 1);
});
test("late payment after expiry is refunded, never confirms", () => {
  const { s, all } = run(mk(), [{ id: "x", type: "HOLD_EXPIRED" }, pay("1", "host", 21234)]);
  assert.equal(s.phase, "EXPIRED"); assert.deepEqual(all.filter((e) => e.kind === "refund").map((e: any) => e.reason), ["late payment"]); assert.equal(count(all, "confirmBooking"), 0);
});
test("wrong amount is refunded and the share stays UNPAID so the member can retry correctly", () => {
  const { s, all } = run(mk(), [pay("1", "m1", 100), pay("2", "m1", 21233)]);
  assert.equal(s.shares.m1.status, "PAID"); assert.equal(count(all, "refund"), 1); assert.equal(s.refundRequested, 100);
});
test("unknown member and double payment for one share are refunded", () => {
  const { s, all } = run(mk(), [pay("1", "ghost", 21233), pay("2", "m1", 21233), pay("3", "m1", 21233)]);
  assert.equal(count(all, "refund"), 2); assert.equal(s.shares.m1.status, "PAID"); assert.equal(s.refundRequested, 21233 * 2);
});
test("idempotency: same event id twice, and same payment id under a new event id, are no-ops", () => {
  const a = run(mk(), [pay("1", "host", 21234)]);
  const dupId = reduce(a.s, pay("1", "host", 21234)); assert.deepEqual(dupId.effects, []); assert.deepEqual(dupId.state, a.s);
  const dupPay = reduce(a.s, pay("1b", "host", 21234, "pay_1")); assert.deepEqual(dupPay.effects, []); assert.equal(dupPay.state.capturedTotal, a.s.capturedTotal);
});
test("after CONFIRMED: payments are refunded, expiry and cancel do nothing, confirm is never repeated", () => {
  const a = run(mk(), [pay("1", "host", 21234), pay("2", "m1", 21233), pay("3", "m2", 21233)]);
  const b = run(a.s, [{ id: "x", type: "HOLD_EXPIRED" }, { id: "c", type: "CANCEL", byMemberId: "host" }, pay("4", "m1", 21233)]);
  assert.equal(b.s.phase, "CONFIRMED"); assert.equal(count(b.all, "refund"), 1); assert.equal(count(b.all, "releaseSeats"), 0); assert.equal(count(b.all, "confirmBooking"), 0);
});
test("only the host can cancel; cancel refunds paid shares and releases seats", () => {
  const a = run(mk(), [pay("1", "m1", 21233), { id: "c1", type: "CANCEL", byMemberId: "m2" }]); assert.equal(a.s.phase, "PARTIALLY_PAID");
  const b = run(a.s, [{ id: "c2", type: "CANCEL", byMemberId: "host" }]); assert.equal(b.s.phase, "CANCELLED"); assert.equal(count(b.all, "refund"), 1); assert.equal(count(b.all, "releaseSeats"), 1);
});
test("REFUND_COMPLETED marks the share REFUNDED", () => {
  const a = run(mk(), [pay("1", "m1", 21233), { id: "x", type: "HOLD_EXPIRED" }]);
  const b = run(a.s, [{ id: "r", type: "REFUND_COMPLETED", paymentId: "pay_1" }]); assert.equal(b.s.shares.m1.status, "REFUNDED");
});
test("createGroup validation", () => {
  assert.throws(() => createGroup("h", [{ memberId: "a", amount: 1 }], "refund_all")); // host has no share
  assert.throws(() => createGroup("a", [{ memberId: "a", amount: 1 }, { memberId: "a", amount: 1 }], "refund_all"));
  assert.throws(() => createGroup("a", [{ memberId: "a", amount: 0.5 }], "refund_all")); assert.throws(() => createGroup("a", [{ memberId: "a", amount: 0 }], "refund_all"));
});

// ---------- seeded fuzz: random hostile event streams, invariants checked after EVERY event ----------
function rng(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function genEvents(r: () => number, group: GroupState, n: number): GroupEvent[] {
  const members = Object.keys(group.shares), ev: GroupEvent[] = [];
  for (let i = 0; i < n; i++) {
    const k = Math.floor(r() * 12), m = members[Math.floor(r() * members.length)], id = `e${i}`;
    if (k <= 3) ev.push({ id, type: "PAYMENT_CAPTURED", memberId: m, paymentId: `p${i}`, amount: group.shares[m].amount });
    else if (k === 4) ev.push({ id, type: "PAYMENT_CAPTURED", memberId: m, paymentId: `p${i}`, amount: Math.floor(r() * 50000) + 1 });
    else if (k === 5) ev.push({ id, type: "PAYMENT_CAPTURED", memberId: "ghost", paymentId: `p${i}`, amount: 1000 });
    else if (k === 6) ev.push({ id, type: "HOLD_EXPIRED" });
    else if (k === 7) ev.push({ id, type: "HOST_COVER_CAPTURED", paymentId: `hc${i}`, amount: r() < 0.6 ? Math.floor(r() * 60000) + 1 : group.total });
    else if (k === 8) ev.push({ id, type: "HOST_COVER_FAILED" });
    else if (k === 9) ev.push({ id, type: "CANCEL", byMemberId: r() < 0.5 ? "host" : m });
    else if (k === 10) ev.push({ id, type: "REFUND_COMPLETED", paymentId: `p${Math.floor(r() * n)}` });
    else ev.push({ id, type: "PAYMENT_FAILED", memberId: m });
    if (r() < 0.25) ev.push({ ...ev[ev.length - 1] });                                       // webhook redelivery: identical event again
    if (r() < 0.1 && ev.length > 2) ev.push({ ...ev[Math.floor(r() * (ev.length - 1))] });    // out-of-order late redelivery
  }
  return ev;
}
test("fuzz: 4000 random hostile event streams never violate money/seat invariants", () => {
  const r = rng(2026);
  for (let t = 0; t < 4000; t++) {
    const members = 2 + Math.floor(r() * 4), total = 5000 + Math.floor(r() * 400000), sh = splitEqual(total, members), policy: Policy = r() < 0.5 ? "refund_all" : "host_covers";
    let s = createGroup("host", sh.map((a, i) => ({ memberId: i === 0 ? "host" : `m${i}`, amount: a })), policy); const all: Effect[] = [];
    for (const e of genEvents(r, s, 14)) { const res = reduce(s, e); s = res.state; all.push(...res.effects); const bad = checkInvariants(s, all); assert.deepEqual(bad, [], `seed-run ${t}, event ${e.type}/${e.id}, policy ${policy}`); }
  }
});
test("fuzz: delivering every event twice in a row yields the identical final state and effects (idempotent)", () => {
  const r = rng(77);
  for (let t = 0; t < 1500; t++) {
    const sh = splitEqual(100000, 3), g0 = createGroup("host", sh.map((a, i) => ({ memberId: i === 0 ? "host" : `m${i}`, amount: a })), r() < 0.5 ? "refund_all" : "host_covers");
    const evs = genEvents(r, g0, 12); let a = g0, b = g0; const fa: Effect[] = [], fb: Effect[] = [];
    for (const e of evs) { const x = reduce(a, e); a = x.state; fa.push(...x.effects); const y1 = reduce(b, e), y2 = reduce(y1.state, e); b = y2.state; fb.push(...y1.effects, ...y2.effects); }
    assert.deepEqual(b, a); assert.deepEqual(fb, fa);
  }
});
