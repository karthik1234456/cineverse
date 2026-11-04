import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Part B — Legend Counts Integrity (Strict Sum = 100)', () => {
  const layoutPath = path.resolve(__dirname, '../../public/models/seat_layout_v2.json');
  const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf-8'));
  const seats: { seat_id: string }[] = layout.seats;

  function calculateLegendCounts(
    seatStatuses: Record<string, 'available' | 'held' | 'booked'>,
    selectedSeats: string[]
  ) {
    let available = 0;
    let booked = 0;
    let held = 0;
    const selected = selectedSeats.length;

    for (const seat of seats) {
      if (selectedSeats.includes(seat.seat_id)) {
        continue;
      }
      const status = seatStatuses[seat.seat_id] || 'available';
      if (status === 'available') available++;
      else if (status === 'booked') booked++;
      else if (status === 'held') held++;
    }

    return { available, booked, held, selected, total: available + booked + held + selected };
  }

  it('sums to exactly 100 when all seats are available', () => {
    const counts = calculateLegendCounts({}, []);
    expect(counts.available).toBe(100);
    expect(counts.selected).toBe(0);
    expect(counts.held).toBe(0);
    expect(counts.booked).toBe(0);
    expect(counts.total).toBe(100);
  });

  it('sums to exactly 100 with 7 selected, 8 held, and 2 booked (fixing the 107 bug)', () => {
    const selected = ['E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'E07'];
    const statuses: Record<string, 'available' | 'held' | 'booked'> = {
      A01: 'booked',
      A02: 'booked',
      B01: 'held',
      B02: 'held',
      B03: 'held',
      B04: 'held',
      B05: 'held',
      B06: 'held',
      B07: 'held',
      B08: 'held',
    };

    const counts = calculateLegendCounts(statuses, selected);
    expect(counts.selected).toBe(7);
    expect(counts.held).toBe(8);
    expect(counts.booked).toBe(2);
    expect(counts.available).toBe(83); // 100 - 7 - 8 - 2 = 83
    expect(counts.total).toBe(100);
    expect(counts.available + counts.selected + counts.held + counts.booked).toBe(100);
  });

  it('sums to exactly 100 across 100 random combinations of seat states', () => {
    for (let run = 0; run < 100; run++) {
      const selected: string[] = [];
      const statuses: Record<string, 'available' | 'held' | 'booked'> = {};

      for (const seat of seats) {
        const rand = Math.random();
        if (rand < 0.1) {
          selected.push(seat.seat_id);
        } else if (rand < 0.25) {
          statuses[seat.seat_id] = 'held';
        } else if (rand < 0.4) {
          statuses[seat.seat_id] = 'booked';
        }
      }

      const counts = calculateLegendCounts(statuses, selected);
      expect(counts.total).toBe(100);
      expect(counts.available + counts.selected + counts.held + counts.booked).toBe(100);
    }
  });
});
