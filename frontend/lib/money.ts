/**
 * Money maths in integer paise. NEVER use floats for money. Pure TypeScript, zero dependencies.
 * Rates (GST, fees) are CONFIGURABLE INPUTS, not tax advice: confirm current rules with an accountant.
 */
export type Paise = number;
export function assertPaise(n: number, label = "amount"): void {
  if (!Number.isSafeInteger(n) || n < 0) throw new Error(`${label} must be a non-negative integer number of paise, got ${n}`);
}
/** amount * bps / 10000, rounded half up, integer result. */
export function percentOf(amount: Paise, bps: number): Paise {
  assertPaise(amount); if (!Number.isSafeInteger(bps) || bps < 0) throw new Error("bps must be a non-negative integer");
  return Math.floor((amount * bps + 5000) / 10000);
}
/** Split total into `parts` shares that sum EXACTLY to total (remainder paise go to the first shares). */
export function splitEqual(total: Paise, parts: number): Paise[] {
  assertPaise(total, "total"); if (!Number.isSafeInteger(parts) || parts < 1) throw new Error("parts must be >= 1");
  const base = Math.floor(total / parts), rem = total - base * parts;
  return Array.from({ length: parts }, (_, i) => base + (i < rem ? 1 : 0));
}
/** Largest-remainder split by integer weights; shares sum EXACTLY to total. */
export function splitWeighted(total: Paise, weights: number[]): Paise[] {
  assertPaise(total, "total");
  if (!weights.length || weights.some((w) => !Number.isSafeInteger(w) || w < 0)) throw new Error("weights must be non-negative integers");
  const sum = weights.reduce((a, b) => a + b, 0); if (sum === 0) throw new Error("weights sum to zero");
  const exact = weights.map((w) => (total * w) / sum), base = exact.map(Math.floor);
  let left = total - base.reduce((a, b) => a + b, 0);
  const order = exact.map((e, i) => ({ i, frac: e - Math.floor(e) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) { if (left <= 0) break; base[i]++; left--; }
  return base;
}
export interface PriceInput {
  ticketPrices: Paise[]; addons?: Paise; discount?: Paise;
  convenienceFeePerTicket?: Paise; gstOnTicketsBps?: number; gstOnFeeBps?: number;
}
export interface PriceBreakdown { tickets: Paise; addons: Paise; discount: Paise; fee: Paise; gstTickets: Paise; gstFee: Paise; total: Paise }
/** Discount is capped at tickets+addons and applied before tax on tickets (configurable policy, documented). */
export function priceBreakdown(i: PriceInput): PriceBreakdown {
  i.ticketPrices.forEach((p) => assertPaise(p, "ticket price"));
  const tickets = i.ticketPrices.reduce((a, b) => a + b, 0), addons = i.addons ?? 0; assertPaise(addons, "addons");
  const discount = Math.min(i.discount ?? 0, tickets + addons); assertPaise(discount, "discount");
  const discountOnTickets = Math.min(discount, tickets), taxableTickets = tickets - discountOnTickets;
  const fee = (i.convenienceFeePerTicket ?? 0) * i.ticketPrices.length; assertPaise(fee, "fee");
  const gstTickets = percentOf(taxableTickets, i.gstOnTicketsBps ?? 0), gstFee = percentOf(fee, i.gstOnFeeBps ?? 0);
  return { tickets, addons, discount, fee, gstTickets, gstFee, total: tickets + addons - discount + fee + gstTickets + gstFee };
}
