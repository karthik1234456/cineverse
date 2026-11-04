/**
 * Viewing-comfort score and best-available seat finder (Phase 11). Pure TypeScript.
 * HONESTY: the thresholds below are CONFIGURABLE general guidance about screen angle comfort, not a cinema
 * standard and not a measurement of any physical room. No obstruction (heads, rails) is modelled.
 */
export interface ScoredSeatInput {
  seat_id: string;
  row: string;
  number: number;
  category?: string;
  horizontal_offset_deg: number;
  vertical_angle_deg: number;
  screen_h_fov_deg: number;
  position_gltf_y_up: [number, number, number];
}

export interface ScoreOptions {
  comfortableHFov: [number, number];   // degrees the screen should subtend horizontally
  wideFovPenaltyPerDeg: number;
  narrowFovPenaltyPerDeg: number;
  freeOffsetDeg: number;
  offsetPenaltyPerDeg: number;
  maxOffsetPenalty: number;
  freeLookUpDeg: number;
  lookUpPenaltyPerDeg: number;
  weights: { fov: number; offset: number; vertical: number };
}

export const DEFAULT_SCORE_OPTIONS: ScoreOptions = {
  comfortableHFov: [28, 50],
  wideFovPenaltyPerDeg: 2.2,
  narrowFovPenaltyPerDeg: 3.0,
  freeOffsetDeg: 10,
  offsetPenaltyPerDeg: 1.0,
  maxOffsetPenalty: 35,
  freeLookUpDeg: 20,
  lookUpPenaltyPerDeg: 2.0,
  weights: { fov: 0.6, offset: 0.25, vertical: 0.15 },
};

export type PreferenceType = "balanced" | "centre" | "sit_back" | "no_neck_strain" | "aisle" | "accessible";

export function getScoreOptionsForPreference(pref?: PreferenceType | string): ScoreOptions {
  switch (pref) {
    case "centre":
      return {
        ...DEFAULT_SCORE_OPTIONS,
        freeOffsetDeg: 5,
        offsetPenaltyPerDeg: 2.0,
        maxOffsetPenalty: 50,
        weights: { fov: 0.45, offset: 0.45, vertical: 0.10 },
      };
    case "sit_back":
      return {
        ...DEFAULT_SCORE_OPTIONS,
        comfortableHFov: [22, 38],
        wideFovPenaltyPerDeg: 3.0,
        weights: { fov: 0.65, offset: 0.20, vertical: 0.15 },
      };
    case "no_neck_strain":
      return {
        ...DEFAULT_SCORE_OPTIONS,
        freeLookUpDeg: 12,
        lookUpPenaltyPerDeg: 3.5,
        weights: { fov: 0.40, offset: 0.20, vertical: 0.40 },
      };
    case "aisle":
    case "accessible":
    case "balanced":
    default:
      return DEFAULT_SCORE_OPTIONS;
  }
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

export function viewScore(
  s: Pick<ScoredSeatInput, "horizontal_offset_deg" | "vertical_angle_deg" | "screen_h_fov_deg">,
  o: ScoreOptions = DEFAULT_SCORE_OPTIONS
) {
  const reasons: string[] = [];
  const [lo, hi] = o.comfortableHFov;
  const f = s.screen_h_fov_deg;
  let fov = 100;

  if (f > hi) {
    fov = clamp(100 - (f - hi) * o.wideFovPenaltyPerDeg);
    reasons.push(f > hi + 20 ? "very close, screen fills your whole view" : "a little close to the screen");
  } else if (f < lo) {
    fov = clamp(100 - (lo - f) * o.narrowFovPenaltyPerDeg);
    reasons.push("far from the screen");
  }

  const off = Math.abs(s.horizontal_offset_deg);
  const offPen = clamp((off - o.freeOffsetDeg) * o.offsetPenaltyPerDeg, 0, o.maxOffsetPenalty);
  if (offPen > 5) reasons.push("off to the side of the screen");

  const vPen = clamp((s.vertical_angle_deg - o.freeLookUpDeg) * o.lookUpPenaltyPerDeg, 0, 100);
  if (vPen > 0) reasons.push("you would look up at the screen");

  const score = clamp(fov * o.weights.fov + (100 - offPen) * o.weights.offset + (100 - vPen) * o.weights.vertical);
  return {
    score: Math.round(score * 10) / 10,
    reasons: reasons.length ? reasons : ["comfortable viewing angle (geometric estimate)"],
  };
}

export type SeatStatus = "available" | "booked" | "held" | "selected";

export interface BestResult {
  seatIds: string[];
  avgScore: number;
  split: boolean;
  orphanSeats: number;
  reasons: string[];
}

export interface BestOptions {
  aisleAfterNumbers?: number[];
  allowCrossAisle?: boolean;
  orphanPenalty?: number;
  score?: ScoreOptions;
  preference?: PreferenceType | string;
  category?: string;
}

/** Contiguous same-row seats (not across an aisle by default) maximising score, penalising orphan single seats. */
export function bestAvailable(
  seats: ScoredSeatInput[],
  status: Record<string, SeatStatus>,
  n: number,
  opt: BestOptions = {}
): BestResult | null {
  if (!Number.isSafeInteger(n) || n < 1) throw new Error("n must be >= 1");

  const preference = opt.preference ?? "balanced";
  const so = opt.score ?? getScoreOptionsForPreference(preference);
  const aisles = opt.aisleAfterNumbers ?? [];
  const penalty = opt.orphanPenalty ?? 8;

  // Filter seats by category if specified
  let candidateSeats = seats;
  if (opt.category) {
    const catLower = opt.category.toLowerCase();
    const filtered = seats.filter((s) => s.category && s.category.toLowerCase() === catLower);
    if (filtered.length >= n) {
      candidateSeats = filtered;
    }
  }

  const isFree = (s: ScoredSeatInput) => status[s.seat_id] === "available";
  const scored = new Map(candidateSeats.map((s) => [s.seat_id, viewScore(s, so).score]));

  // Apply preference affinities
  const affinity = (s: ScoredSeatInput): number => {
    let bonus = 0;
    if (preference === "aisle") {
      // Seats at edges or next to aisles
      if (s.number === 1 || s.number === 10 || aisles.includes(s.number) || aisles.includes(s.number - 1)) {
        bonus += 15;
      }
    } else if (preference === "accessible") {
      // Accessible preference prefers front row A
      if (s.row === "A") {
        bonus += 20;
      }
    }
    return bonus;
  };

  const rows = new Map<string, ScoredSeatInput[]>();
  for (const s of candidateSeats) {
    (rows.get(s.row) ?? rows.set(s.row, []).get(s.row)!).push(s);
  }

  let best: { ids: string[]; value: number; avg: number; orphans: number; centre: number } | null = null;

  for (const list of rows.values()) {
    const r = [...list].sort((a, b) => a.number - b.number);
    for (let i = 0; i + n <= r.length; i++) {
      const w = r.slice(i, i + n);
      if (!w.every(isFree)) continue;
      if (!opt.allowCrossAisle && w.some((s, k) => k > 0 && aisles.some((a) => w[k - 1].number <= a && s.number > a))) {
        continue;
      }

      // orphan = a free seat left isolated on a side (between the window and a booked seat / row end / aisle)
      let orphans = 0;
      for (const side of [-1, 1]) {
        const nb1 = r[side < 0 ? i - 1 : i + n];
        const nb2 = r[side < 0 ? i - 2 : i + n + 1];
        const crossesAisle =
          nb1 &&
          aisles.some((a) =>
            side < 0 ? nb1.number <= a && w[0].number > a : w[n - 1].number <= a && nb1.number > a
          );
        if (
          nb1 &&
          !crossesAisle &&
          isFree(nb1) &&
          (!nb2 ||
            !isFree(nb2) ||
            aisles.some((a) =>
              side < 0 ? nb2.number <= a && nb1.number > a : nb1.number <= a && nb2.number > a
            ))
        ) {
          orphans++;
        }
      }

      const baseAvg = w.reduce((t, s) => t + scored.get(s.seat_id)!, 0) / n;
      const affinityBonus = w.reduce((t, s) => t + affinity(s), 0) / n;
      const value = baseAvg + affinityBonus - orphans * penalty;
      const centre = w.reduce((t, s) => t + Math.abs(s.position_gltf_y_up[0]), 0) / n;

      if (
        !best ||
        value > best.value + 1e-9 ||
        (Math.abs(value - best.value) <= 1e-9 && centre < best.centre)
      ) {
        best = { ids: w.map((s) => s.seat_id), value, avg: baseAvg, orphans, centre };
      }
    }
  }

  const preferenceReasons: string[] = [];
  if (preference === "centre") preferenceReasons.push("direct screen centre alignment");
  else if (preference === "sit_back") preferenceReasons.push("relaxed distance with wide room sightline");
  else if (preference === "no_neck_strain") preferenceReasons.push("minimal vertical look-up angle");
  else if (preference === "aisle") preferenceReasons.push("easy aisle access");
  else if (preference === "accessible") preferenceReasons.push("convenient step-free front row access");

  if (best) {
    const reasons = ["together in one row", ...preferenceReasons];
    return {
      seatIds: best.ids,
      avgScore: Math.round(best.avg * 10) / 10,
      split: false,
      orphanSeats: best.orphans,
      reasons,
    };
  }

  const free = candidateSeats
    .filter(isFree)
    .sort(
      (a, b) =>
        scored.get(b.seat_id)! + affinity(b) - (scored.get(a.seat_id)! + affinity(a)) ||
        a.seat_id.localeCompare(b.seat_id)
    );

  if (free.length < n) return null;

  const pick = free.slice(0, n);
  const avg = pick.reduce((t, s) => t + scored.get(s.seat_id)!, 0) / n;

  return {
    seatIds: pick.map((s) => s.seat_id),
    avgScore: Math.round(avg * 10) / 10,
    split: true,
    orphanSeats: 0,
    reasons: ["no seats together; best individual seats", ...preferenceReasons],
  };
}
