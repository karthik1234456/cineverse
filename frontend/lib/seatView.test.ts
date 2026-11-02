import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  screenDistance,
  screenDistanceMeters,
  horizontalAngle,
  verticalAngle,
  screenFov,
  geometricCoverage,
} from './seatView';
import type { SeatLayoutFile, SeatRecord } from './types';

describe('seatView Mathematical Calculations', () => {
  const layoutPath = path.resolve(__dirname, '../public/models/seat_layout_v2.json');
  const layout: SeatLayoutFile = JSON.parse(fs.readFileSync(layoutPath, 'utf-8'));
  const seatsById = new Map<string, SeatRecord>(
    layout.seats.map((s) => [s.seat_id, s])
  );

  it('matches prompt sanity fixtures for Row A centre seat (A05)', () => {
    const a05 = seatsById.get('A05');
    expect(a05).toBeDefined();
    if (!a05) return;

    const dist = screenDistance(a05.eye_position_gltf_y_up, layout.screen.center_gltf_y_up);
    const fov = screenFov(
      a05.eye_position_gltf_y_up,
      layout.screen.width,
      layout.screen.height,
      layout.screen.center_gltf_y_up
    );

    // Prompt fixture: row A centre seat h-FOV ≈ 97.7°, distance ≈ 7.5u
    expect(dist).toBeCloseTo(7.494, 2);
    expect(dist).toBeCloseTo(7.5, 0);
    expect(fov.hFov).toBeCloseTo(97.7, 1);
    expect(a05.screen_distance).toBeCloseTo(7.494, 2);
    expect(a05.screen_h_fov_deg).toBeCloseTo(97.7, 1);
  });

  it('matches prompt sanity fixtures for Row E centre seat (E05)', () => {
    const e05 = seatsById.get('E05');
    expect(e05).toBeDefined();
    if (!e05) return;

    const fov = screenFov(
      e05.eye_position_gltf_y_up,
      layout.screen.width,
      layout.screen.height,
      layout.screen.center_gltf_y_up
    );

    // Prompt fixture: row E ≈ 62.6°
    expect(fov.hFov).toBeCloseTo(62.6, 1);
    expect(e05.screen_h_fov_deg).toBeCloseTo(62.6, 1);
  });

  it('matches prompt sanity fixtures for Row J centre seat (J05)', () => {
    const j05 = seatsById.get('J05');
    expect(j05).toBeDefined();
    if (!j05) return;

    const dist = screenDistance(j05.eye_position_gltf_y_up, layout.screen.center_gltf_y_up);
    const fov = screenFov(
      j05.eye_position_gltf_y_up,
      layout.screen.width,
      layout.screen.height,
      layout.screen.center_gltf_y_up
    );

    // Prompt fixture: row J ≈ 42.0°, distance ≈ 20.4u
    expect(dist).toBeCloseTo(20.374, 2);
    expect(dist).toBeCloseTo(20.4, 0);
    expect(fov.hFov).toBeCloseTo(42.0, 1);
    expect(j05.screen_distance).toBeCloseTo(20.374, 2);
    expect(j05.screen_h_fov_deg).toBeCloseTo(42.0, 1);
  });

  it('calculates horizontal and vertical angles correctly for off-centre seats', () => {
    const a01 = seatsById.get('A01')!;
    const j10 = seatsById.get('J10')!;

    const a01Horiz = horizontalAngle(a01.eye_position_gltf_y_up, layout.screen.center_gltf_y_up);
    const a01Vert = verticalAngle(a01.eye_position_gltf_y_up, layout.screen.center_gltf_y_up);

    expect(a01Horiz).toBeCloseTo(a01.horizontal_offset_deg, 1);
    expect(a01Vert).toBeCloseTo(a01.vertical_angle_deg, 1);

    const j10Horiz = horizontalAngle(j10.eye_position_gltf_y_up, layout.screen.center_gltf_y_up);
    const j10Vert = verticalAngle(j10.eye_position_gltf_y_up, layout.screen.center_gltf_y_up);

    expect(j10Horiz).toBeCloseTo(j10.horizontal_offset_deg, 1);
    expect(j10Vert).toBeCloseTo(j10.vertical_angle_deg, 1);
  });

  it('calculates distance in meters with estimated conversion factor', () => {
    const m = screenDistanceMeters(7.494, 0.43);
    expect(m).toBeCloseTo(3.22, 2);
  });

  it('computes realistic geometric screen coverage percentage', () => {
    const a05 = seatsById.get('A05')!;
    const j05 = seatsById.get('J05')!;

    const covA = geometricCoverage(a05.screen_h_fov_deg, a05.screen_v_fov_deg);
    const covJ = geometricCoverage(j05.screen_h_fov_deg, j05.screen_v_fov_deg);

    expect(covA).toBeGreaterThan(covJ);
    expect(covA).toBeLessThanOrEqual(100);
    expect(covJ).toBeGreaterThan(0);
  });
});

describe('Seat Layout Integrity and Uniqueness Tests', () => {
  const layoutPath = path.resolve(__dirname, '../public/models/seat_layout_v2.json');
  const layout: SeatLayoutFile = JSON.parse(fs.readFileSync(layoutPath, 'utf-8'));

  it('contains exactly 100 seats across rows A through J', () => {
    expect(layout.seats).toHaveLength(100);

    const rows = new Set(layout.seats.map((s) => s.row));
    expect(Array.from(rows).sort()).toEqual([
      'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
    ]);

    for (const row of rows) {
      const seatsInRow = layout.seats.filter((s) => s.row === row);
      expect(seatsInRow).toHaveLength(10);
      const numbers = seatsInRow.map((s) => s.number).sort((a, b) => a - b);
      expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    }
  });

  it('ensures every seat_id and node_name is unique and properly formatted', () => {
    const seatIds = new Set<string>();
    const nodeNames = new Set<string>();

    for (const seat of layout.seats) {
      expect(seatIds.has(seat.seat_id)).toBe(false);
      expect(nodeNames.has(seat.node_name)).toBe(false);

      seatIds.add(seat.seat_id);
      nodeNames.add(seat.node_name);

      expect(seat.seat_id).toMatch(/^[A-J](0[1-9]|10)$/);
      expect(seat.node_name).toBe(`seat_${seat.row}_${seat.number.toString().padStart(2, '0')}`);
    }
  });

  it('has valid bounding boxes for all seats', () => {
    for (const seat of layout.seats) {
      const { min, max } = seat.bounds_gltf_y_up;
      expect(max[0]).toBeGreaterThan(min[0]);
      expect(max[1]).toBeGreaterThan(min[1]);
      expect(max[2]).toBeGreaterThan(min[2]);

      // Eye position must be within or above seat cushion bounds
      expect(seat.eye_position_gltf_y_up[1]).toBeGreaterThan(min[1]);
      expect(seat.eye_position_gltf_y_up[0]).toBeGreaterThanOrEqual(min[0] - 0.1);
      expect(seat.eye_position_gltf_y_up[0]).toBeLessThanOrEqual(max[0] + 0.1);
    }
  });
});
