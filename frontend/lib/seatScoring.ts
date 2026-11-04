/**
 * Viewing-comfort score and best-available seat finder (Phase 11). Pure TypeScript.
 * HONESTY: the thresholds below are CONFIGURABLE general guidance about screen angle comfort, not a cinema
 * standard and not a measurement of any physical room. No obstruction (heads, rails) is modelled.
 */
export interface ScoredSeatInput {
  seat_id: string; row: string; number: number;
  horizontal_offset_deg: number; vertical_angle_deg: number; screen_h_fov_deg: number; position_gltf_y_up: [number, number, number];
}
export interface ScoreOptions {
  comfortableHFov: [number, number];   // degrees the screen should subtend horizontally
  wideFovPenaltyPerDeg: number; narrowFovPenaltyPerDeg: number;
  freeOffsetDeg: number; offsetPenaltyPerDeg: number; maxOffsetPenalty: number;
  freeLookUpDeg: number; lookUpPenaltyPerDeg: number;
  weights: { fov: number; offset: number; vertical: number };
}
export const DEFAULT_SCORE_OPTIONS: ScoreOptions = {
  comfortableHFov: [28, 50], wideFovPenaltyPerDeg: 2.2, narrowFovPenaltyPerDeg: 3,
  freeOffsetDeg: 10, offsetPenaltyPerDeg: 1, maxOffsetPenalty: 35, freeLookUpDeg: 20, lookUpPenaltyPerDeg: 2,
  weights: { fov: 0.6, offset: 0.25, vertical: 0.15 },
};
const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
export function viewScore(s: Pick<ScoredSeatInput, "horizontal_offset_deg" | "vertical_angle_deg" | "screen_h_fov_deg">, o: ScoreOptions = DEFAULT_SCORE_OPTIONS) {
  const reasons: string[] = [], [lo, hi] = o.comfortableHFov, f = s.screen_h_fov_deg;
  let fov = 100;
  if (f > hi) { fov = clamp(100 - (f - hi) * o.wideFovPenaltyPerDeg); reasons.push(f > hi + 20 ? "very close, screen fills your whole view" : "a little close to the screen"); }
  else if (f < lo) { fov = clamp(100 - (lo - f) * o.narrowFovPenaltyPerDeg); reasons.push("far from the screen"); }
  const off = Math.abs(s.horizontal_offset_deg);
  const offPen = clamp((off - o.freeOffsetDeg) * o.offsetPenaltyPerDeg, 0, o.maxOffsetPenalty);
  if (offPen > 5) reasons.push("off to the side of the screen");
  const vPen = clamp((s.vertical_angle_deg - o.freeLookUpDeg) * o.lookUpPenaltyPerDeg, 0, 100);
  if (vPen > 0) reasons.push("you would look up at the screen");
  const score = clamp(fov * o.weights.fov + (100 - offPen) * o.weights.offset + (100 - vPen) * o.weights.vertical);
  return { score: Math.round(score * 10) / 10, reasons: reasons.length ? reasons : ["comfortable viewing angle (geometric estimate)"] };
}
export type SeatStatus = "available" | "booked" | "held" | "selected";
export interface BestResult { seatIds: string[]; avgScore: number; split: boolean; orphanSeats: number; reasons: string[] }
export interface BestOptions { aisleAfterNumbers?: number[]; allowCrossAisle?: boolean; orphanPenalty?: number; score?: ScoreOptions }

/** Contiguous same-row seats (not across an aisle by default) maximising score, penalising orphan single seats. */
export function bestAvailable(seats: ScoredSeatInput[], status: Record<string, SeatStatus>, n: number, opt: BestOptions = {}): BestResult | null {
  if (!Number.isSafeInteger(n) || n < 1) throw new Error("n must be >= 1");
  const aisles = opt.aisleAfterNumbers ?? [], penalty = opt.orphanPenalty ?? 8, so = opt.score ?? DEFAULT_SCORE_OPTIONS;
  const isFree = (s: ScoredSeatInput) => status[s.seat_id] === "available";
  const scored = new Map(seats.map((s) => [s.seat_id, viewScore(s, so).score]));
  const rows = new Map<string, ScoredSeatInput[]>();
  for (const s of seats) (rows.get(s.row) ?? rows.set(s.row, []).get(s.row)!).push(s);
  let best: { ids: string[]; value: number; avg: number; orphans: number; centre: number } | null = null;
  for (const list of rows.values()) {
    const r = [...list].sort((a, b) => a.number - b.number);
    for (let i = 0; i + n <= r.length; i++) {
      const w = r.slice(i, i + n);
      if (!w.every(isFree)) continue;
      if (!opt.allowCrossAisle && w.some((s, k) => k > 0 && aisles.some((a) => w[k - 1].number <= a && s.number > a))) continue;
      // orphan = a free seat left isolated on a side (between the window and a booked seat / row end / aisle)
      let orphans = 0;
      for (const side of [-1, 1]) {
        const nb1 = r[side < 0 ? i - 1 : i + n], nb2 = r[side < 0 ? i - 2 : i + n + 1];
        const crossesAisle = nb1 && aisles.some((a) => (side < 0 ? nb1.number <= a && w[0].number > a : w[n - 1].number <= a && nb1.number > a));
        if (nb1 && !crossesAisle && isFree(nb1) && (!nb2 || !isFree(nb2) || aisles.some((a) => (side < 0 ? nb2.number <= a && nb1.number > a : nb1.number <= a && nb2.number > a)))) orphans++;
      }
      const avg = w.reduce((t, s) => t + scored.get(s.seat_id)!, 0) / n, value = avg - orphans * penalty;
      const centre = w.reduce((t, s) => t + Math.abs(s.position_gltf_y_up[0]), 0) / n;
      if (!best || value > best.value + 1e-9 || (Math.abs(value - best.value) <= 1e-9 && centre < best.centre)) best = { ids: w.map((s) => s.seat_id), value, avg, orphans, centre };
    }
  }
  if (best) return { seatIds: best.ids, avgScore: Math.round(best.avg * 10) / 10, split: false, orphanSeats: best.orphans, reasons: ["together in one row"] };
  const free = seats.filter(isFree).sort((a, b) => scored.get(b.seat_id)! - scored.get(a.seat_id)! || a.seat_id.localeCompare(b.seat_id));
  if (free.length < n) return null;
  const pick = free.slice(0, n);
  return { seatIds: pick.map((s) => s.seat_id), avgScore: Math.round((pick.reduce((t, s) => t + scored.get(s.seat_id)!, 0) / n) * 10) / 10, split: true, orphanSeats: 0, reasons: ["no seats together; best individual seats"] };
}
