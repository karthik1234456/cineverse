import { describe, it, expect } from 'vitest';
import layoutData from '@/public/models/seat_layout_v2.json';
import { buildSeatMapLayout } from '@/lib/seatMapLayout';

describe('Phase 2d Part A: Price and Category Parity across 100 seats', () => {
  const seats = layoutData.seats;

  it('contains exactly 100 seats', () => {
    expect(seats.length).toBe(100);
  });

  it('verifies category bands and pricing match the canonical database truth', () => {
    const cats = layoutData.categories;
    expect(cats.front.price).toBe(280);
    expect(cats.front.rows).toBe('ABC');

    expect(cats.prime.price).toBe(380);
    expect(cats.prime.rows).toBe('DEFG');

    expect(cats.premier.price).toBe(520);
    expect(cats.premier.rows).toBe('HIJ');
  });

  it('asserts every one of the 100 seats has the single canonical price and category', () => {
    for (const seat of seats) {
      const row = seat.row;
      if ('ABC'.includes(row)) {
        expect(seat.category.toLowerCase()).toBe('front');
        expect(seat.price).toBe(280);
      } else if ('DEFG'.includes(row)) {
        expect(seat.category.toLowerCase()).toBe('prime');
        expect(seat.price).toBe(380);
      } else if ('HIJ'.includes(row)) {
        expect(seat.category.toLowerCase()).toBe('premier');
        expect(seat.price).toBe(520);
      } else {
        throw new Error(`Unexpected row ${row} for seat ${seat.seat_id}`);
      }
    }
  });

  it('explicitly verifies the four finding seats from F1 and F2', () => {
    const seatMap = new Map(seats.map((s) => [s.seat_id, s]));

    // D02: Prime, 380 (NOT 250)
    const d02 = seatMap.get('D02');
    expect(d02).toBeDefined();
    expect(d02!.category.toLowerCase()).toBe('prime');
    expect(d02!.price).toBe(380);

    // I01: Premier, 520 (NOT 350)
    const i01 = seatMap.get('I01');
    expect(i01).toBeDefined();
    expect(i01!.category.toLowerCase()).toBe('premier');
    expect(i01!.price).toBe(520);

    // C06: Front, 280 (Row C is Front, NOT Prime)
    const c06 = seatMap.get('C06');
    expect(c06).toBeDefined();
    expect(c06!.category.toLowerCase()).toBe('front');
    expect(c06!.price).toBe(280);

    // D03: Prime, 380
    const d03 = seatMap.get('D03');
    expect(d03).toBeDefined();
    expect(d03!.category.toLowerCase()).toBe('prime');
    expect(d03!.price).toBe(380);
  });

  it('verifies 2D seat map layout builder outputs the 3 canonical category bands', () => {
    const layout = buildSeatMapLayout(seats as any);
    expect(layout.rows.length).toBe(10);

    // Verify row groupings
    expect(layout.categoryBands.length).toBe(3);
    expect(layout.categoryBands[0]).toEqual({ category: 'front', rows: ['A', 'B', 'C'] });
    expect(layout.categoryBands[1]).toEqual({ category: 'prime', rows: ['D', 'E', 'F', 'G'] });
    expect(layout.categoryBands[2]).toEqual({ category: 'premier', rows: ['H', 'I', 'J'] });
  });
});
