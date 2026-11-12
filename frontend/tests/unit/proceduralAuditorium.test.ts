import { describe, it, expect } from 'vitest';
import {
  generateProceduralAuditorium,
  computeRowXPositions,
  type AuditoriumLayoutInput,
} from '@/lib/proceduralAuditorium';
import referenceLayout from '@/public/models/seat_layout_v2.json';
import type { SeatLayoutFile, SeatRecord } from '@/lib/types';

describe('Procedural Auditorium Generator — Faithfulness & Geometry Tests', () => {
  const refLayout = referenceLayout as unknown as SeatLayoutFile;

  describe('1. Faithfulness Test against 100-seat Reference Hall (Requirement 4)', () => {
    const input100: AuditoriumLayoutInput = {
      rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
      seats_per_row: 10,
      aisles: [5], // Central aisle between seat 5 and 6
      accessible_seats: ['A01', 'A02'],
      screen_type: 'IMAX 3D',
      total_seats: 100,
      base_price: 280,
    };

    const result = generateProceduralAuditorium(input100);
    const genSeats = result.seatLayout.seats;

    it('generates exact 100 seats matching reference count and IDs', () => {
      expect(genSeats.length).toBe(100);
      const genIds = genSeats.map((s) => s.seat_id);
      const refIds = refLayout.seats.map((s) => s.seat_id);
      expect(genIds).toEqual(refIds);
    });

    it('satisfies numbering rule: Seat 01 on Audience Left (+X) for every row', () => {
      for (const row of input100.rows) {
        const rowSeats = genSeats.filter((s) => s.row === row);
        expect(rowSeats.length).toBe(10);
        // Seat 1 should have largest positive X
        expect(rowSeats[0].number).toBe(1);
        expect(rowSeats[0].position_gltf_y_up[0]).toBeGreaterThan(0);
        expect(rowSeats[0].position_gltf_y_up[0]).toBe(6.0);
        // Seat 10 should have most negative X
        expect(rowSeats[9].number).toBe(10);
        expect(rowSeats[9].position_gltf_y_up[0]).toBe(-6.0);
      }
    });

    it('matches seat positions within tolerance <= 0.05 units (tolerance documented in report)', () => {
      let maxPosErr = 0;
      for (const refSeat of refLayout.seats) {
        const genSeat = genSeats.find((s) => s.seat_id === refSeat.seat_id);
        expect(genSeat).toBeDefined();

        const [rx, ry, rz] = refSeat.position_gltf_y_up;
        const [gx, gy, gz] = genSeat!.position_gltf_y_up;

        const err = Math.max(Math.abs(rx - gx), Math.abs(ry - gy), Math.abs(rz - gz));
        if (err > maxPosErr) maxPosErr = err;
        expect(err).toBeLessThanOrEqual(0.05);
      }
      expect(maxPosErr).toBeLessThanOrEqual(0.001); // Mathematically exact
    });

    it('matches eye positions within tolerance <= 0.05 units', () => {
      let maxEyeErr = 0;
      for (const refSeat of refLayout.seats) {
        const genSeat = genSeats.find((s) => s.seat_id === refSeat.seat_id);
        expect(genSeat).toBeDefined();

        const [rex, rey, rez] = refSeat.eye_position_gltf_y_up;
        const [gex, gey, gez] = genSeat!.eye_position_gltf_y_up;

        const err = Math.max(Math.abs(rex - gex), Math.abs(rey - gey), Math.abs(rez - gez));
        if (err > maxEyeErr) maxEyeErr = err;
        expect(err).toBeLessThanOrEqual(0.05);
      }
      expect(maxEyeErr).toBeLessThanOrEqual(0.001); // Mathematically exact
    });

    it('matches screen distances within tolerance <= 0.05 units', () => {
      let maxDistErr = 0;
      for (const refSeat of refLayout.seats) {
        const genSeat = genSeats.find((s) => s.seat_id === refSeat.seat_id);
        const err = Math.abs(refSeat.screen_distance - genSeat!.screen_distance);
        if (err > maxDistErr) maxDistErr = err;
        expect(err).toBeLessThanOrEqual(0.05);
      }
      expect(maxDistErr).toBeLessThanOrEqual(0.005);
    });

    it('matches horizontal and vertical viewing angles within tolerance <= 0.05 degrees', () => {
      let maxHErr = 0;
      let maxVErr = 0;
      for (const refSeat of refLayout.seats) {
        const genSeat = genSeats.find((s) => s.seat_id === refSeat.seat_id);
        const hErr = Math.abs(refSeat.horizontal_offset_deg - genSeat!.horizontal_offset_deg);
        const vErr = Math.abs(refSeat.vertical_angle_deg - genSeat!.vertical_angle_deg);
        if (hErr > maxHErr) maxHErr = hErr;
        if (vErr > maxVErr) maxVErr = vErr;
        expect(hErr).toBeLessThanOrEqual(0.05);
        expect(vErr).toBeLessThanOrEqual(0.05);
      }
      expect(maxHErr).toBeLessThanOrEqual(0.02);
      expect(maxVErr).toBeLessThanOrEqual(0.02);
    });

    it('matches screen horizontal and vertical FOV within tolerance <= 0.05 degrees', () => {
      let maxHfovErr = 0;
      let maxVfovErr = 0;
      for (const refSeat of refLayout.seats) {
        const genSeat = genSeats.find((s) => s.seat_id === refSeat.seat_id);
        const hErr = Math.abs(refSeat.screen_h_fov_deg - genSeat!.screen_h_fov_deg);
        const vErr = Math.abs(refSeat.screen_v_fov_deg - genSeat!.screen_v_fov_deg);
        if (hErr > maxHfovErr) maxHfovErr = hErr;
        if (vErr > maxVfovErr) maxVfovErr = vErr;
        expect(hErr).toBeLessThanOrEqual(0.05);
        expect(vErr).toBeLessThanOrEqual(0.05);
      }
      expect(maxHfovErr).toBeLessThanOrEqual(0.05);
      expect(maxVfovErr).toBeLessThanOrEqual(0.05);
    });
  });

  describe('2. Small Luxury Hall (72 seats) Generation', () => {
    const input72: AuditoriumLayoutInput = {
      rows: ['A', 'B', 'C', 'D', 'E', 'F'],
      seats_per_row: 12,
      aisles: [6],
      accessible_seats: ['A01', 'A12'],
      screen_type: 'Standard',
      total_seats: 72,
      base_price: 320,
    };

    const res72 = generateProceduralAuditorium(input72);

    it('generates 72 valid seats with rows A-F and numbers 1-12', () => {
      expect(res72.seatLayout.seats.length).toBe(72);
      expect(res72.geometry.tiers.length).toBe(6);
      expect(res72.geometry.aisleSteps.length).toBe(6);
    });

    it('places Seat 01 at +7.2 and Seat 12 at -7.2 symmetrically', () => {
      const a01 = res72.seatLayout.seats.find((s) => s.seat_id === 'A01')!;
      const a12 = res72.seatLayout.seats.find((s) => s.seat_id === 'A12')!;
      expect(a01.position_gltf_y_up[0]).toBe(7.2);
      expect(a12.position_gltf_y_up[0]).toBe(-7.2);
    });

    it('generates walk navigation with floor, tiers, and aisle treads', () => {
      const walkables = res72.walkNav.walkable;
      expect(walkables.some((w) => w.type === 'floor')).toBe(true);
      expect(walkables.filter((w) => w.type === 'tier').length).toBe(6);
      expect(walkables.filter((w) => w.type === 'tread').length).toBe(6);
    });
  });

  describe('3. Large Hall (260 seats) Generation', () => {
    const input260: AuditoriumLayoutInput = {
      rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'],
      seats_per_row: 20,
      aisles: [5, 15],
      accessible_seats: ['A01', 'A20'],
      screen_type: 'Dolby Atmos 2D',
      total_seats: 260,
      base_price: 350,
    };

    const res260 = generateProceduralAuditorium(input260);

    it('generates 260 seats with 13 tiers and 2 aisle staircases', () => {
      expect(res260.seatLayout.seats.length).toBe(260);
      expect(res260.geometry.tiers.length).toBe(13);
      expect(res260.geometry.aisleSteps.length).toBe(26); // 13 rows x 2 aisles
    });

    it('scales screen width to 21.0m for wide viewing cone', () => {
      expect(res260.seatLayout.screen.width).toBe(21.0);
      expect(res260.geometry.screenMesh.width).toBe(21.0);
    });

    it('has valid camera bounds enclosing the larger hall', () => {
      const bounds = res260.geometry.cameraBounds;
      expect(bounds.maxX).toBeGreaterThan(14.0);
      expect(bounds.minX).toBeLessThan(-14.0);
      expect(bounds.minZ).toBeLessThan(-26.0);
    });
  });

  describe('4. Flagship Big Hall (420 seats) Generation', () => {
    const input420: AuditoriumLayoutInput = {
      rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O'],
      seats_per_row: 28,
      aisles: [7, 14, 21],
      accessible_seats: ['A01', 'A28'],
      screen_type: 'IMAX with Laser',
      total_seats: 420,
      base_price: 450,
    };

    const res420 = generateProceduralAuditorium(input420);

    it('generates 420 seats with 15 tiers and 3 aisle stairways', () => {
      expect(res420.seatLayout.seats.length).toBe(420);
      expect(res420.geometry.tiers.length).toBe(15);
      expect(res420.geometry.aisleSteps.length).toBe(45); // 15 rows x 3 aisles
    });

    it('scales screen to massive IMAX proportions with curved flag', () => {
      expect(res420.geometry.screenMesh.width).toBeGreaterThanOrEqual(25.0);
      expect(res420.geometry.screenMesh.curved).toBe(true);
    });

    it('maintains strict Seat 01 on Audience Left rule across all 28 seats', () => {
      const rowA = res420.seatLayout.seats.filter((s) => s.row === 'A');
      expect(rowA[0].seat_id).toBe('A01');
      expect(rowA[0].position_gltf_y_up[0]).toBe(18.0);
      expect(rowA[27].seat_id).toBe('A28');
      expect(rowA[27].position_gltf_y_up[0]).toBe(-18.0);
    });
  });

  describe('5. Realistic Cinema Upgrades: Levels, Curved Rows, Recliner Pairs, 4DX Flags and Architectural Geometries', () => {
    const inputBalconyCurved4DX: AuditoriumLayoutInput = {
      rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'],
      seats_per_row: 20,
      aisles: [5, 15],
      accessible_seats: ['A01', 'A20'],
      companion_seats: ['A02', 'A19'],
      theatre_type: 'balcony',
      screen_type: 'Dolby Atmos 4DX',
      total_seats: 260,
      base_price: 380,
      curve_radius: 28.0,
      has_balcony: true,
      balcony_rows: ['K', 'L', 'M'],
      features: {
        is_4dx: true,
        motion_seats: true,
        wind: true,
        water: true,
        fog: true,
        scent: true,
        strobe: true,
        ticklers: true,
        dolby_atmos: true,
      },
    };

    const res = generateProceduralAuditorium(inputBalconyCurved4DX);

    it('generates distinct Stalls and Balcony levels with elevated balcony tiers and structure', () => {
      expect(res.seatLayout.has_balcony).toBe(true);
      expect(res.seatLayout.levels?.stalls?.rows).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']);
      expect(res.seatLayout.levels?.balcony?.rows).toEqual(['K', 'L', 'M']);

      const rowJ = res.seatLayout.seats.find((s) => s.row === 'J' && s.number === 10);
      const rowK = res.seatLayout.seats.find((s) => s.row === 'K' && s.number === 10);
      expect(rowJ).toBeDefined();
      expect(rowK).toBeDefined();
      // Row K (Balcony) should have an elevation jump of > 2.0 meters above Row J (Stalls)
      expect(rowK!.position_gltf_y_up[1]).toBeGreaterThan(rowJ!.position_gltf_y_up[1] + 2.0);

      // Balcony structure exists with platform, fascia, railing, and coveLightBounds
      expect(res.geometry.balconyStructure).toBeDefined();
      expect(res.geometry.balconyStructure?.platform).toBeDefined();
      expect(res.geometry.balconyStructure?.coveLightBounds).toBeDefined();
    });

    it('curves row arcs towards the screen at the side wings based on curve_radius', () => {
      // For row D (Z baseline), the center seat (10 or 11) should have smaller Z than the edge seat (1)
      const seatD01 = res.seatLayout.seats.find((s) => s.seat_id === 'D01')!;
      const seatD10 = res.seatLayout.seats.find((s) => s.seat_id === 'D10')!;
      // D01 has large X, so sagZ curves it towards screen (+Z direction)
      expect(seatD01.position_gltf_y_up[2]).toBeGreaterThan(seatD10.position_gltf_y_up[2]);
    });

    it('designates recliner pairs with bidirectional partner linkage', () => {
      const premierSeats = res.seatLayout.seats.filter((s) => s.seat_type === 'recliner_pair');
      expect(premierSeats.length).toBeGreaterThan(0);

      const seat1 = premierSeats[0];
      expect(seat1.pair_partner_id).toBeDefined();
      const partner = res.seatLayout.seats.find((s) => s.seat_id === seat1.pair_partner_id);
      expect(partner).toBeDefined();
      expect(partner!.pair_partner_id).toBe(seat1.seat_id);
    });

    it('marks accessible and companion seats appropriately', () => {
      const a01 = res.seatLayout.seats.find((s) => s.seat_id === 'A01')!;
      const a02 = res.seatLayout.seats.find((s) => s.seat_id === 'A02')!;
      expect(a01.seat_type).toBe('accessible');
      expect(a02.seat_type).toBe('companion');
    });

    it('flags 4DX features and motion zone seats', () => {
      expect(res.seatLayout.features?.is_4dx).toBe(true);
      expect(res.seatLayout.features?.motion_seats).toBe(true);
      const motionSeats = res.seatLayout.seats.filter((s) => s.in_motion_zone);
      expect(motionSeats.length).toBeGreaterThan(0);
      // Row E should be in motion zone
      expect(res.seatLayout.seats.find((s) => s.row === 'E')!.in_motion_zone).toBe(true);
    });

    it('generates rich architectural details: wooden slats, curtains, proscenium, exit signs, downlights, atmos speakers', () => {
      expect(res.geometry.woodenSlats.length).toBeGreaterThan(0);
      expect(res.geometry.sideCurtains.left).toBeDefined();
      expect(res.geometry.sideCurtains.right).toBeDefined();
      expect(res.geometry.proscenium).toBeDefined();
      expect(res.geometry.exitSigns.length).toBe(2);
      expect(res.geometry.ceilingDownlights.length).toBeGreaterThan(0);
      expect(res.geometry.atmosSpeakers.length).toBe(12);
      expect(res.geometry.stepLights.length).toBeGreaterThan(0);
      expect(res.geometry.carpetRunners?.length ?? 0).toBe(0);
      expect(res.geometry.cameraPresets?.balcony).toBeDefined();
      expect(res.geometry.cameraPresets?.screen).toBeDefined();
    });
  });
});
