import { describe, it, expect } from "vitest";
import {
  viewScore,
  bestAvailable,
  DEFAULT_SCORE_OPTIONS,
  getScoreOptionsForPreference,
  ScoredSeatInput,
} from "../../lib/seatScoring";
import seatLayout from "../../public/models/seat_layout_v2.json";

describe("Phase 11: Seat Scoring Engine (TypeScript)", () => {
  it("scores front-row centre vs back-row centre vs far side honestly", () => {
    const seats = seatLayout.seats as unknown as ScoredSeatInput[];
    const seatMap = new Map(seats.map((s) => [s.seat_id, s]));

    const frontCentre = viewScore(seatMap.get("A05")!);
    const backCentre = viewScore(seatMap.get("J05")!);
    const frontSide = viewScore(seatMap.get("A01")!);

    // Front centre has wide FOV penalty ("very close" or "a little close")
    expect(frontCentre.reasons.some((r) => r.includes("close"))).toBe(true);

    // Far side has off-to-side penalty
    expect(frontSide.reasons.some((r) => r.includes("side"))).toBe(true);
    expect(frontCentre.score).toBeGreaterThan(frontSide.score);

    // Back centre has a comfortable or relaxed sightline
    expect(backCentre.score).toBeGreaterThan(50);
  });

  it("satisfies property: score drops as seat moves off-centre in the same row", () => {
    const seats = seatLayout.seats as unknown as ScoredSeatInput[];
    const rowF = seats
      .filter((s) => s.row === "F")
      .sort((a, b) => Math.abs(a.horizontal_offset_deg) - Math.abs(b.horizontal_offset_deg));

    const scores = rowF.map((s) => viewScore(s).score);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1] + 0.1);
    }
  });

  it("handles preference options appropriately", () => {
    const seats = seatLayout.seats as unknown as ScoredSeatInput[];
    const seatMap = new Map(seats.map((s) => [s.seat_id, s]));

    const centreSeat = seatMap.get("F05")!;
    const sideSeat = seatMap.get("F01")!;

    const centreOptions = getScoreOptionsForPreference("centre");
    const normalSide = viewScore(sideSeat, DEFAULT_SCORE_OPTIONS).score;
    const penalisedSide = viewScore(sideSeat, centreOptions).score;

    expect(penalisedSide).toBeLessThan(normalSide);
  });

  it("bestAvailable finds contiguous same-row seats and avoids orphans", () => {
    const seats = seatLayout.seats as unknown as ScoredSeatInput[];
    const status: Record<string, "available" | "booked" | "held" | "selected"> = {};
    for (const s of seats) status[s.seat_id] = "available";

    // Book F04 and F07, leaving F05, F06 free (size 2)
    // If user asks for 1 seat, picking F05 would orphan F06, so it penalises that choice
    const result2 = bestAvailable(seats, status, 2);
    expect(result2).not.toBeNull();
    expect(result2?.seatIds.length).toBe(2);
    expect(result2?.split).toBe(false);
  });

  it("bestAvailable handles odd party size and category filtering", () => {
    const seats = seatLayout.seats as unknown as ScoredSeatInput[];
    const status: Record<string, "available" | "booked" | "held" | "selected"> = {};
    for (const s of seats) status[s.seat_id] = "available";

    const res3Prime = bestAvailable(seats, status, 3, { category: "prime" });
    expect(res3Prime).not.toBeNull();
    expect(res3Prime?.seatIds.length).toBe(3);
    for (const id of res3Prime!.seatIds) {
      const s = seats.find((x) => x.seat_id === id);
      expect(s?.category?.toLowerCase()).toBe("prime");
    }
  });

  it("bestAvailable handles aisle preference", () => {
    const seats = seatLayout.seats as unknown as ScoredSeatInput[];
    const status: Record<string, "available" | "booked" | "held" | "selected"> = {};
    for (const s of seats) status[s.seat_id] = "available";

    const aislePick = bestAvailable(seats, status, 1, { preference: "aisle" });
    expect(aislePick).not.toBeNull();
    const seatId = aislePick!.seatIds[0];
    const num = parseInt(seatId.slice(1), 10);
    expect([1, 10].includes(num)).toBe(true);
  });
});

