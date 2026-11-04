import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { buildSeatMapLayout } from '@/lib/seatMapLayout';
import { screenDistance, horizontalAngle, verticalAngle, screenFov } from '@/lib/seatView';

describe('Part A — 100-Seat Numbering Consistency across 2D, 3D, and Layout Data', () => {
  const layoutPath = path.resolve(__dirname, '../../public/models/seat_layout_v2.json');
  const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf-8'));
  const seats: any[] = layout.seats;
  const screen = layout.screen;
  const byId = Object.fromEntries(seats.map((s: any) => [s.seat_id, s]));

  it('contains exactly 100 unique seats and node names', () => {
    expect(seats.length).toBe(100);
    const seatIds = new Set(seats.map((s) => s.seat_id));
    const nodeNames = new Set(seats.map((s) => s.node_name));
    expect(seatIds.size).toBe(100);
    expect(nodeNames.size).toBe(100);
  });

  it('mirrored numbering rule: seat_id number = 11 - node number (A05 <-> seat_A_06, J10 <-> seat_J_01)', () => {
    for (const s of seats) {
      const nodeNum = Number(s.node_name.split('_')[2]);
      expect(s.number).toBe(11 - nodeNum);
      expect(s.seat_id).toBe(`${s.row}${s.number.toString().padStart(2, '0')}`);
    }
    expect(byId.A01.node_name).toBe('seat_A_10');
    expect(byId.A05.node_name).toBe('seat_A_06');
    expect(byId.A10.node_name).toBe('seat_A_01');
    expect(byId.E01.node_name).toBe('seat_E_10');
    expect(byId.E06.node_name).toBe('seat_E_05');
    expect(byId.J10.node_name).toBe('seat_J_01');
  });

  it('places seat 01 on the audience left (+X) and seat 10 on the audience right (-X)', () => {
    for (const r of 'ABCDEFGHIJ') {
      const rowSeats = Array.from({ length: 10 }, (_, i) => byId[`${r}${String(i + 1).padStart(2, '0')}`]);
      // X coordinates must strictly decrease: +6.0 down to -6.0
      for (let i = 1; i < 10; i++) {
        expect(rowSeats[i].position_gltf_y_up[0]).toBeLessThan(rowSeats[i - 1].position_gltf_y_up[0]);
      }
      expect(rowSeats[0].position_gltf_y_up[0]).toBeCloseTo(6.0, 1);
      expect(rowSeats[9].position_gltf_y_up[0]).toBeCloseTo(-6.0, 1);
    }
  });

  it('verifies 2D map places A01 and E01 in column 0 (leftmost) and A10 and E10 in column 9 (rightmost)', () => {
    const map = buildSeatMapLayout(seats);
    expect(map.rows.length).toBe(10);
    for (const r of map.rows) {
      expect(r.seats[0].number).toBe(1);
      expect(r.seats[0].seat_id).toBe(`${r.row}01`);
      expect(r.seats[0].col).toBe(0);
      expect(r.seats[9].number).toBe(10);
      expect(r.seats[9].seat_id).toBe(`${r.row}10`);
      expect(r.seats[9].col).toBe(9);
    }

    const rowE = map.rows.find((r) => r.row === 'E');
    expect(rowE).toBeDefined();
    expect(rowE?.seats[0].seat_id).toBe('E01');
    expect(rowE?.seats[5].seat_id).toBe('E06');
  });

  it('verifies horizontal angle signs: audience-left sees screen to the right (+), audience-right sees screen to the left (-)', () => {
    // A01 is audience left (+X): looking straight ahead +Z, screen is to the right
    expect(byId.A01.horizontal_offset_deg).toBeGreaterThan(0);
    // A10 is audience right (-X): looking straight ahead +Z, screen is to the left
    expect(byId.A10.horizontal_offset_deg).toBeLessThan(0);
    // E06 is at x = -1.2 (audience right), screen center is to the viewer's left
    expect(byId.E06.horizontal_offset_deg).toBeLessThan(0);
    expect(byId.E06.horizontal_offset_deg).toBeCloseTo(-5.35, 1);
  });

  it('recomputed seatView math matches seat_layout_v2.json within tolerance for all 100 seats', () => {
    for (const s of seats) {
      const eye = s.eye_position_gltf_y_up;
      const dist = screenDistance(eye, screen.center_gltf_y_up);
      const horiz = horizontalAngle(eye, screen.center_gltf_y_up);
      const vert = verticalAngle(eye, screen.center_gltf_y_up);
      const fov = screenFov(eye, screen.width, screen.height, screen.center_gltf_y_up);

      expect(Math.abs(dist - s.screen_distance)).toBeLessThan(0.05);
      expect(Math.abs(horiz - s.horizontal_offset_deg)).toBeLessThan(0.1);
      expect(Math.abs(vert - s.vertical_angle_deg)).toBeLessThan(0.1);
      expect(Math.abs(fov.hFov - s.screen_h_fov_deg)).toBeLessThan(0.2);
      expect(Math.abs(fov.vFov - s.screen_v_fov_deg)).toBeLessThan(0.2);
    }
  });
});
