import test from "node:test";
import assert from "node:assert/strict";
import { percentOf, splitEqual, splitWeighted, priceBreakdown, assertPaise } from "../../lib/money.ts";
function rng(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

test("assertPaise rejects floats, negatives, NaN, unsafe ints", () => {
  for (const bad of [0.5, -1, NaN, Infinity, 2 ** 60]) assert.throws(() => assertPaise(bad as number));
  assertPaise(0); assertPaise(63700);
});
test("percentOf rounds half up on integers", () => {
  assert.equal(percentOf(25000, 1800), 4500); assert.equal(percentOf(1, 5000), 1); assert.equal(percentOf(1, 4999), 0); assert.equal(percentOf(0, 1800), 0);
});
test("splitEqual always sums exactly and shares differ by at most 1 paisa", () => {
  const r = rng(7);
  for (let k = 0; k < 2000; k++) {
    const total = Math.floor(r() * 5_000_000), parts = 1 + Math.floor(r() * 12), sh = splitEqual(total, parts);
    assert.equal(sh.reduce((a, b) => a + b, 0), total); assert.equal(sh.length, parts);
    assert.ok(Math.max(...sh) - Math.min(...sh) <= 1); sh.forEach((x) => assert.ok(Number.isInteger(x) && x >= 0));
  }
  assert.deepEqual(splitEqual(10, 3), [4, 3, 3]); assert.deepEqual(splitEqual(63700, 3), [21234, 21233, 21233]);
});
test("splitWeighted sums exactly (largest remainder) and respects zero weights", () => {
  const r = rng(11);
  for (let k = 0; k < 2000; k++) {
    const n = 1 + Math.floor(r() * 6), w = Array.from({ length: n }, () => Math.floor(r() * 10)); if (w.every((x) => x === 0)) w[0] = 1;
    const total = Math.floor(r() * 2_000_000), sh = splitWeighted(total, w);
    assert.equal(sh.reduce((a, b) => a + b, 0), total); w.forEach((x, i) => { if (x === 0) assert.equal(sh[i], 0); });
  }
  assert.deepEqual(splitWeighted(100, [1, 1, 1]), [34, 33, 33]);
});
test("priceBreakdown: example 2 x Rs250 + fee + GST, all integers, total is the sum of parts", () => {
  const b = priceBreakdown({ ticketPrices: [25000, 25000], convenienceFeePerTicket: 2000, gstOnTicketsBps: 1800, gstOnFeeBps: 1800 });
  assert.deepEqual(b, { tickets: 50000, addons: 0, discount: 0, fee: 4000, gstTickets: 9000, gstFee: 720, total: 63720 });
});
test("discount is capped, applied before ticket tax, and never produces a negative total", () => {
  const b = priceBreakdown({ ticketPrices: [10000], discount: 999999, gstOnTicketsBps: 1800 });
  assert.equal(b.discount, 10000); assert.equal(b.gstTickets, 0); assert.equal(b.total, 0);
  const c = priceBreakdown({ ticketPrices: [10000, 10000], addons: 5000, discount: 5000, gstOnTicketsBps: 1000 });
  assert.equal(c.gstTickets, 1500); assert.equal(c.total, 25000 - 5000 + 1500);
});
test("fuzz: total always equals sum of parts and is a non-negative integer", () => {
  const r = rng(99);
  for (let k = 0; k < 3000; k++) {
    const n = 1 + Math.floor(r() * 8), t = Array.from({ length: n }, () => Math.floor(r() * 90000)), b = priceBreakdown({ ticketPrices: t, addons: Math.floor(r() * 50000), discount: Math.floor(r() * 120000), convenienceFeePerTicket: Math.floor(r() * 5000), gstOnTicketsBps: Math.floor(r() * 2800), gstOnFeeBps: 1800 });
    assert.equal(b.total, b.tickets + b.addons - b.discount + b.fee + b.gstTickets + b.gstFee); assert.ok(Number.isSafeInteger(b.total) && b.total >= 0);
  }
});
test("rejects float prices (no float money)", () => { assert.throws(() => priceBreakdown({ ticketPrices: [250.5] })); });
