import { describe, it, expect } from 'vitest';
import { generateProceduralAuditorium } from '../../lib/proceduralAuditorium';

describe('PART G: Data Truth & Price Bands Non-Overlap', () => {
  it('ensures category price bands never overlap across rows', () => {
    const types = ['compact', 'standard', 'large', 'flagship', 'dolby_atmos_4dx', 'luxury_recliner', 'boutique', 'balcony'];

    types.forEach(tid => {
      const res = generateProceduralAuditorium({
        theatre_type: tid,
        rows: 10,
        seats_per_row: 14,
        is_motion_hall: tid === 'dolby_atmos_4dx',
      });

      const rowCategories = new Map<string, Set<string>>();
      res.seatLayout.seats.forEach(seat => {
        if (!rowCategories.has(seat.row)) {
          rowCategories.set(seat.row, new Set());
        }
        rowCategories.get(seat.row)!.add(seat.category);
      });

      // Assert that every row has exactly one category (strictly non-overlapping bands)
      rowCategories.forEach((cats, row) => {
        expect(cats.size, `Theatre type ${tid} row ${row} has multiple categories: ${Array.from(cats)}`).toBe(1);
      });
    });
  });

  it('guarantees every seat has exactly one category assigned', () => {
    const res = generateProceduralAuditorium({
      theatre_type: 'flagship',
      rows: 12,
      seats_per_row: 16,
    });

    res.seatLayout.seats.forEach(seat => {
      expect(['front', 'prime', 'premier']).toContain(seat.category.toLowerCase());
    });
  });
});

