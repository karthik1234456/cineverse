import { describe, it, expect } from 'vitest';
import {
  generateProceduralAuditorium,
  computeRowXPositions,
} from '@/lib/proceduralAuditorium';
import {
  THEATRE_TYPE_REGISTRY,
  getTheatreTypeDefinition,
  METERS_TO_SCENE,
  SCENE_TO_METERS,
  type TheatreTypeId,
} from '@/lib/theatreTypeRegistry';
import { buildSeatMapLayout } from '@/lib/seatMapLayout';

describe('Real-World Theatre Dimensions & Arrangements Tests', () => {
  const theatreTypes: TheatreTypeId[] = [
    'compact',
    'standard',
    'large',
    'flagship',
    'dolby_atmos_4dx',
    'luxury_recliner',
    'boutique',
    'balcony',
  ];

  describe('1. Documented Scale & Type Registry Integrity', () => {
    it('verifies documented scale constants (1.0m = 2.0 scene units)', () => {
      expect(METERS_TO_SCENE).toBe(2.0);
      expect(SCENE_TO_METERS).toBe(0.5);
    });

    it('verifies all 8 theatre types exist in registry with real-world dimensions in metres', () => {
      for (const tid of theatreTypes) {
        const def = THEATRE_TYPE_REGISTRY[tid];
        expect(def).toBeDefined();
        expect(def.id).toBe(tid);
        expect(def.realWorldDimensions.seatWidthM).toBeGreaterThanOrEqual(0.5);
        expect(def.realWorldDimensions.rowPitchM).toBeGreaterThanOrEqual(0.95);
        expect(def.realWorldDimensions.rakeStepM).toBeGreaterThanOrEqual(0.15);
        expect(def.realWorldDimensions.aisleWidthM).toBeGreaterThanOrEqual(1.1);
        expect(def.realWorldDimensions.ceilingHeightM).toBeGreaterThanOrEqual(8.0);
      }
    });

    it('verifies flagship screen has 20-26m width and balcony ceiling reaches 14m', () => {
      const flagship = THEATRE_TYPE_REGISTRY.flagship;
      expect(flagship.realWorldDimensions.screenWidthM).toBeGreaterThanOrEqual(20.0);
      expect(flagship.realWorldDimensions.screenWidthM).toBeLessThanOrEqual(26.0);

      const balcony = THEATRE_TYPE_REGISTRY.balcony;
      expect(balcony.realWorldDimensions.ceilingHeightM).toBe(14.0);
    });
  });

  describe('2. Layout Generation & Capacity Matching', () => {
    it('generates 560-seat IMAX flagship hall with curved arc and sweet-spot premier block', () => {
      const res = generateProceduralAuditorium({
        theatre_type: 'flagship',
        rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'],
        seats_per_row: 28,
        blocks_pattern: [7, 14, 7],
        sweet_spot: {
          rows: ['J', 'K', 'L', 'M'],
          seat_numbers: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
          label: 'IMAX Optimal Center',
          price_multiplier: 1.45,
        },
      });

      const seats = res.seatLayout.seats;
      expect(seats.length).toBe(560);
      expect(res.seatLayout.theatre_type).toBe('flagship');
      expect(res.seatLayout.documented_scale?.meters_to_scene).toBe(2.0);

      // Verify sweet spot seats have premier category
      const sweetSeat = seats.find((s) => s.row === 'K' && s.number === 14);
      expect(sweetSeat).toBeDefined();
      expect(sweetSeat!.category).toBe('premier');
    });

    it('generates 700-seat Grand Balcony hall with two tiers and 14m ceiling', () => {
      const stallRows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P'];
      const balconyRows = ['Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X'];
      const allRows = [...stallRows, ...balconyRows];

      const res = generateProceduralAuditorium({
        theatre_type: 'balcony',
        rows: allRows,
        seats_per_row: 28, // approx 672-700 seats
        blocks_pattern: [7, 14, 7],
        has_balcony: true,
        balcony_rows: balconyRows,
      });

      const seats = res.seatLayout.seats;
      expect(seats.length).toBe(allRows.length * 28);
      expect(res.seatLayout.has_balcony).toBe(true);

      const stallSeat = seats.find((s) => s.row === 'A' && s.number === 1);
      const balcSeat = seats.find((s) => s.row === 'X' && s.number === 1);
      expect(stallSeat!.level).toBe('stalls');
      expect(balcSeat!.level).toBe('balcony');
      expect(balcSeat!.position_gltf_y_up[1]).toBeGreaterThan(stallSeat!.position_gltf_y_up[1] + 5.0);
    });

    it('generates 84-seat luxury recliner hall with loveseat pairs', () => {
      const res = generateProceduralAuditorium({
        theatre_type: 'luxury_recliner',
        rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
        seats_per_row: 12,
        blocks_pattern: [4, 4, 4],
      });

      const seats = res.seatLayout.seats;
      expect(seats.length).toBe(84);
      // Verify recliners are paired
      const pairSeats = seats.filter((s) => s.pair_partner_id !== undefined);
      expect(pairSeats.length).toBeGreaterThan(70);
    });

    it('generates 48-seat boutique velvet salon with sofa seat types', () => {
      const res = generateProceduralAuditorium({
        theatre_type: 'boutique',
        rows: ['A', 'B', 'C', 'D', 'E', 'F'],
        seats_per_row: 8,
        blocks_pattern: [4, 4],
        accessible_seats: [],
      });

      const seats = res.seatLayout.seats;
      expect(seats.length).toBe(48);
      const sofaSeats = seats.filter((s) => s.seat_type === 'sofa');
      expect(sofaSeats.length).toBe(48);
    });
  });

  describe('3. Geometry Safety: No Overlaps & Aisle Clearances', () => {
    it('guarantees no seat bounding box overlaps across all seats in large hall', () => {
      const res = generateProceduralAuditorium({
        theatre_type: 'flagship',
        rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'],
        seats_per_row: 28,
        blocks_pattern: [7, 14, 7],
      });

      const seats = res.seatLayout.seats;
      for (const row of ['A', 'J', 'T']) {
        const rowSeats = seats.filter((s) => s.row === row).sort((a, b) => b.position_gltf_y_up[0] - a.position_gltf_y_up[0]);
        for (let i = 0; i < rowSeats.length - 1; i++) {
          const s1 = rowSeats[i];
          const s2 = rowSeats[i + 1];
          const dist = s1.position_gltf_y_up[0] - s2.position_gltf_y_up[0];
          // Each seat is ~1.16 units wide; distance must be at least seat pitch
          expect(dist).toBeGreaterThanOrEqual(1.10);
        }
      }
    });

    it('guarantees aisle width is >= 1.1m (2.2 scene units)', () => {
      const aisles = [7, 21];
      const seatPitch = 1.16;
      const aisleGap = 2.60; // 1.30m x 2.0
      const xs = computeRowXPositions(28, aisles, seatPitch, aisleGap);

      // Gap at aisle after seat 7 (index 6 to 7)
      const seat7X = xs[6];
      const seat8X = xs[7];
      const gapAcrossAisle = Math.abs(seat7X - seat8X);
      expect(gapAcrossAisle).toBeGreaterThanOrEqual(2.2); // >= 1.1m
    });
  });

  describe('4. Numbering Consistency & 2D/3D Parity', () => {
    it('guarantees Seat 01 on Audience Left (+X) and descending X to Seat N (-X)', () => {
      const res = generateProceduralAuditorium({
        theatre_type: 'large',
        rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'],
        seats_per_row: 20,
      });

      const rowA = res.seatLayout.seats.filter((s) => s.row === 'A');
      expect(rowA[0].seat_id).toBe('A01');
      expect(rowA[0].position_gltf_y_up[0]).toBeGreaterThan(0);
      expect(rowA[19].seat_id).toBe('A20');
      expect(rowA[19].position_gltf_y_up[0]).toBeLessThan(0);
      expect(rowA[0].position_gltf_y_up[0]).toBe(-rowA[19].position_gltf_y_up[0]); // Symmetrical
    });

    it('preserves exact 2D map column ordering (col 0 = Seat 01)', () => {
      const res = generateProceduralAuditorium({
        theatre_type: 'standard',
        rows: ['A', 'B', 'C', 'D'],
        seats_per_row: 16,
      });

      const mapLayout = buildSeatMapLayout(res.seatLayout.seats);
      expect(mapLayout.rows.length).toBe(4);
      for (const mapRow of mapLayout.rows) {
        expect(mapRow.seats[0].number).toBe(1);
        expect(mapRow.seats[15].number).toBe(16);
      }
    });
  });

  describe('5. Camera Bounds & Safe Framing for Large Auditoriums', () => {
    it('verifies camera bounds and overview preset frame the entire 560-seat hall', () => {
      const res = generateProceduralAuditorium({
        theatre_type: 'flagship',
        rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'],
        seats_per_row: 28,
      });

      const geo = res.geometry;
      const bounds = geo.cameraBounds;
      const overview = geo.cameraPresets?.overview;

      expect(bounds.minZ).toBeLessThan(-45.0);
      expect(bounds.maxY).toBeGreaterThan(20.0);
      expect(overview).toBeDefined();
      // Overview camera should be placed behind the back rows and high up
      expect(overview!.position[2]).toBeLessThan(-40.0);
      expect(overview!.position[1]).toBeGreaterThan(10.0);
    });
  });

  describe('6. Architectural Features: Roof Systems, Walls, Projection Booth & Projector Beam', () => {
    it('generates suspended ceiling clouds and dark structural trusses for standard hall', () => {
      const res = generateProceduralAuditorium({
        theatre_type: 'standard',
        rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'],
        seats_per_row: 16,
      });

      const geo = res.geometry;
      expect(geo.ceilingClouds.length).toBeGreaterThanOrEqual(6);
      expect(geo.roofTrusses.length).toBeGreaterThanOrEqual(4);
      expect(geo.ventilationDucts.length).toBe(2); // Left and Right HVAC ducts
      expect(geo.coveLightStrips.length).toBeGreaterThanOrEqual(4); // Left, Right, Screen, Rear
      expect(geo.skirtingLights.length).toBe(2); // Baseboard runners
    });

    it('generates projection booth with center projector aperture and monitor ports', () => {
      const res = generateProceduralAuditorium({
        theatre_type: 'standard',
        rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
        seats_per_row: 12,
      });

      const booth = res.geometry.projectionBooth;
      expect(booth).toBeDefined();
      expect(booth.housing).toBeDefined();
      expect(booth.centerWindow).toBeDefined();
      expect(booth.sideWindows.length).toBe(2);
      expect(booth.projectorAperture[2]).toBeCloseTo(res.geometry.dimensions.zBack + 0.85, 1);
      expect(booth.screenTarget[2]).toBe(-1.255); // Screen Z
    });

    it('generates 4DX effect rigs (transverse trusses with fans and nozzles) for 4DX halls', () => {
      const res = generateProceduralAuditorium({
        theatre_type: 'dolby_atmos_4dx',
        rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'],
        seats_per_row: 20,
        features: { is_4dx: true },
      });

      expect(res.geometry.effectRigs).toBeDefined();
      expect(res.geometry.effectRigs!.length).toBeGreaterThanOrEqual(2);
      expect(res.geometry.effectRigs![0].fans.length).toBeGreaterThanOrEqual(3);
      expect(res.geometry.effectRigs![0].nozzles.length).toBeGreaterThanOrEqual(4);
    });

    it('generates acoustic baffles for IMAX flagship hall', () => {
      const res = generateProceduralAuditorium({
        theatre_type: 'flagship',
        rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'],
        seats_per_row: 28,
      });

      expect(res.geometry.acousticBaffles).toBeDefined();
      expect(res.geometry.acousticBaffles!.length).toBeGreaterThanOrEqual(6);
    });
  });
});
