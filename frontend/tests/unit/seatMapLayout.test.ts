import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { buildSeatMapLayout, LayoutSeat } from '@/lib/seatMapLayout';

describe('seatMapLayout module', () => {
  const layoutPath = path.resolve(__dirname, '../../public/models/seat_layout_v2.json');
  const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf-8'));
  const seats: LayoutSeat[] = layout.seats;

  it('builds a valid 2D seat map from 3D layout records', () => {
    const map = buildSeatMapLayout(seats);
    expect(map).toBeDefined();
    expect(map.rows.length).toBe(10); // A to J
    expect(map.cols).toBe(10); // 10 seats per row
  });

  it('places seat 01 on the audience left (-X in glTF space) for every row', () => {
    const map = buildSeatMapLayout(seats);
    for (const r of map.rows) {
      expect(r.seats[0].number).toBe(1);
      expect(r.seats[9].number).toBe(10);
      // X coordinates increase left to right from audience perspective (-6.0 -> +6.0)
      for (let i = 1; i < r.seats.length; i++) {
        expect(r.seats[i].x).toBeGreaterThan(r.seats[i - 1].x);
      }
    }
  });

  it('orders rows from top to bottom (front row A to back row J)', () => {
    const map = buildSeatMapLayout(seats);
    // In buildSeatMapLayout: sorted by larger z (closer to screen, i.e., front)
    // Row A is at z ≈ -8.0, Row J is at z ≈ -21.6
    expect(map.rows[0].row).toBe('A');
    expect(map.rows[9].row).toBe('J');
  });

  it('detects aisle gaps properly', () => {
    const map = buildSeatMapLayout(seats);
    expect(map.aisleAfterCols).toBeDefined();
    expect(Array.isArray(map.aisleAfterCols)).toBe(true);
    // In our auditorium, central aisle is between seat 05 and seat 06 (col index 4)
    expect(map.aisleAfterCols).toContain(4);
  });

  it('groups categories into continuous bands', () => {
    const map = buildSeatMapLayout(seats);
    expect(map.categoryBands.length).toBeGreaterThan(0);
  });
});
