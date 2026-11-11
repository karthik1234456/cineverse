import { describe, it, expect } from 'vitest';
import { generateProceduralAuditorium, type AuditoriumLayoutInput } from '@/lib/proceduralAuditorium';
import { getTheatreTypeDefinition } from '@/lib/theatreTypeRegistry';
import { screenDistance, horizontalAngle, verticalAngle, screenFov } from '@/lib/seatView';

describe('Motion-Seat (4DX-Style) Hall Type — Structure, Screen & Seating Verification', () => {
  // Test fixture: 240 seats (12 rows of 20 seats, 5 pods of 4 per row)
  const motionInput240: AuditoriumLayoutInput = {
    rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'],
    seats_per_row: 20,
    aisles: [4, 16],
    theatre_type: 'dolby_atmos_4dx',
    total_seats: 240,
    base_price: 450,
  };

  const res = generateProceduralAuditorium(motionInput240);
  const { seatLayout, geometry, walkNav } = res;

  describe('1. Motion Pod Layout, Numbering & Spatial Non-Overlap', () => {
    it('generates exact capacity matching total seats (240)', () => {
      expect(seatLayout.seats.length).toBe(240);
    });

    it('assigns all seats to motion pods of 2 or 4 seats', () => {
      expect(seatLayout.pods).toBeDefined();
      expect(seatLayout.pods!.length).toBeGreaterThan(0);

      let totalPodSeats = 0;
      for (const pod of seatLayout.pods!) {
        expect([2, 4]).toContain(pod.capacity);
        expect(pod.seat_ids.length).toBe(pod.capacity);
        totalPodSeats += pod.capacity;
      }
      expect(totalPodSeats).toBe(240);
    });

    it('ensures every seat has a valid unique pod_id, motion_zone="all", and in_motion_zone=true', () => {
      const seenIds = new Set<string>();
      for (const s of seatLayout.seats) {
        expect(seenIds.has(s.seat_id)).toBe(false);
        seenIds.add(s.seat_id);

        expect(s.pod_id).toBeDefined();
        expect(s.pod_id).toMatch(/^POD-[A-L]\d+$/);
        expect(s.motion_zone).toBe('all');
        expect(s.in_motion_zone).toBe(true);
      }
    });

    it('orders seat numbering strictly from audience left (+X) to audience right (-X)', () => {
      for (const rowLetter of motionInput240.rows) {
        const rowSeats = seatLayout.seats.filter((s) => s.row === rowLetter);
        expect(rowSeats.length).toBe(20);

        for (let i = 0; i < rowSeats.length - 1; i++) {
          const current = rowSeats[i];
          const next = rowSeats[i + 1];
          // Seat numbers increment: 1, 2, 3...
          expect(next.number).toBe(current.number + 1);
          // +X is audience left, so X must strictly decrease
          expect(current.position_gltf_y_up[0]).toBeGreaterThan(next.position_gltf_y_up[0]);
        }
      }
    });

    it('guarantees no spatial overlap between any two seat bounding boxes', () => {
      const seats = seatLayout.seats;
      for (let i = 0; i < seats.length; i++) {
        const b1 = seats[i].bounds_gltf_y_up;
        for (let j = i + 1; j < seats.length; j++) {
          const b2 = seats[j].bounds_gltf_y_up;

          // Check if boxes overlap in 3D
          const overlapX = b1.min[0] < b2.max[0] && b1.max[0] > b2.min[0];
          const overlapY = b1.min[1] < b2.max[1] && b1.max[1] > b2.min[1];
          const overlapZ = b1.min[2] < b2.max[2] && b1.max[2] > b2.min[2];

          expect(overlapX && overlapY && overlapZ).toBe(false);
        }
      }
    });

    it('guarantees no spatial overlap between motion pod platform bases', () => {
      const podBases = geometry.motionPodBases || [];
      expect(podBases.length).toBeGreaterThan(0);

      for (let i = 0; i < podBases.length; i++) {
        const p1 = podBases[i].bounds;
        for (let j = i + 1; j < podBases.length; j++) {
          const p2 = podBases[j].bounds;

          const overlapX = p1.min[0] < p2.max[0] && p1.max[0] > p2.min[0];
          const overlapY = p1.min[1] < p2.max[1] && p1.max[1] > p2.min[1];
          const overlapZ = p1.min[2] < p2.max[2] && p1.max[2] > p2.min[2];

          expect(overlapX && overlapY && overlapZ).toBe(false);
        }
      }
    });
  });

  describe('2. Uniform Seat Type & Recliner Absence', () => {
    it('uses uniform motion seat type for all regular seats with zero recliners', () => {
      const reclinerSeats = seatLayout.seats.filter(
        (s) => s.seat_type === 'recliner' || s.seat_type === 'recliner_pair'
      );
      expect(reclinerSeats.length).toBe(0);

      const motionSeats = seatLayout.seats.filter((s) => s.seat_type === 'motion');
      // All seats except accessible A01 & A20, and companion A02
      expect(motionSeats.length).toBe(240 - 3);
    });

    it('has no paired recliner linkages in motion hall', () => {
      const pairedSeats = seatLayout.seats.filter((s) => s.pair_partner_id !== undefined);
      expect(pairedSeats.length).toBe(0);
    });
  });

  describe('3. Panoramic Wrap Screen Geometry & Specifications', () => {
    it('configures screenMesh as panoramic_wrap with angled side panels', () => {
      expect(geometry.screenMesh.type).toBe('panoramic_wrap');
      expect(geometry.screenMesh.panoramicWrap).toBeDefined();

      const wrap = geometry.screenMesh.panoramicWrap!;
      expect(wrap.sideAngleDeg).toBe(25);
      expect(wrap.sideWidthRatio).toBeCloseTo(0.42, 2);
      expect(wrap.sideHeightRatio).toBeCloseTo(0.82, 2);
    });

    it('has a clear proscenium frame and projector beam enabled', () => {
      expect(geometry.screenMesh.bezel?.clearFrame).toBe(true);
      expect(geometry.screenMesh.hasProjectorBeam).toBe(true);
    });

    it('uses the center panel as the exact reference for all view maths', () => {
      const screenCenter = geometry.screenMesh.center;
      expect(screenCenter[0]).toBe(0.0);
      expect(screenCenter[2]).toBe(-1.255);

      const seat = seatLayout.seats[0];
      const dist = screenDistance(seat.eye_position_gltf_y_up, screenCenter);
      expect(seat.screen_distance).toBeCloseTo(dist, 2);

      const hAngle = horizontalAngle(seat.eye_position_gltf_y_up, screenCenter);
      expect(seat.horizontal_offset_deg).toBeCloseTo(hAngle, 1);

      const vAngle = verticalAngle(seat.eye_position_gltf_y_up, screenCenter);
      expect(seat.vertical_angle_deg).toBeCloseTo(vAngle, 1);
    });
  });

  describe('4. 3D Structure, Effects Rig & Colliders', () => {
    it('generates 30 atmospheric effect props with valid types and tags', () => {
      const props = geometry.effectProps || [];
      expect(props.length).toBe(30);

      const propTypes = new Set(props.map((p) => p.type));
      expect(propTypes.has('wind')).toBe(true);
      expect(propTypes.has('fog')).toBe(true);
      expect(propTypes.has('water')).toBe(true);
      expect(propTypes.has('strobe')).toBe(true);
      expect(propTypes.has('scent')).toBe(true);
      expect(propTypes.has('poke')).toBe(true);
    });

    it('registers pod platform bases and wall fog machines as colliders in walkNav', () => {
      const podColliders = walkNav.colliders.filter((c) => c.type === ('pod_base' as any));
      expect(podColliders.length).toBeGreaterThan(0);

      const rigColliders = walkNav.colliders.filter((c) => c.type === ('effect_rig' as any));
      expect(rigColliders.length).toBe(4); // 4 wall fog machines
    });

    it('provides front floor trim light along stage proscenium', () => {
      expect(geometry.frontFloorTrim).toBeDefined();
      expect(geometry.frontFloorTrim?.color).toBe('#06b6d4');
    });

    it('includes effects_rig and wrap_screen camera presets', () => {
      expect(geometry.cameraPresets).toBeDefined();
      expect(geometry.cameraPresets!.effects_rig).toBeDefined();
      expect(geometry.cameraPresets!.wrap_screen).toBeDefined();
      expect(geometry.cameraPresets!.effects_rig.caption).toContain('Effects Rig');
      expect(geometry.cameraPresets!.wrap_screen.caption).toContain('Wrap Screen');
    });
  });

  describe('5. Multi-City Motion Hall Variety Verification', () => {
    const cityCapacities = [168, 192, 200, 216, 240, 264, 280];

    for (const cap of cityCapacities) {
      it(`successfully generates valid motion-seat hall for capacity ${cap}`, () => {
        const rowCount = cap === 280 ? 14 : cap === 200 ? 10 : 12;
        const seatsPerRow = cap / rowCount;
        const rows = Array.from({ length: rowCount }, (_, i) => String.fromCharCode(65 + i));

        const cityRes = generateProceduralAuditorium({
          rows,
          seats_per_row: seatsPerRow,
          aisles: [Math.floor(seatsPerRow * 0.25), Math.floor(seatsPerRow * 0.75)],
          theatre_type: 'dolby_atmos_4dx',
          total_seats: cap,
        });

        expect(cityRes.seatLayout.seats.length).toBe(cap);
        expect(cityRes.geometry.motionPodBases?.length).toBeGreaterThan(0);
        expect(cityRes.geometry.screenMesh.type).toBe('panoramic_wrap');
        expect(cityRes.seatLayout.features?.motion_seats).toBe(true);
      });
    }
  });

  describe('6. Hall Layout & Screen Distance Mathematical Conformance (PART A Requirements)', () => {
    it('verifies screen distance >= 1.2 * screenHeight across all generated seats and rows', () => {
      const sh = geometry.screenMesh.height;
      const sw = geometry.screenMesh.width;
      const screenZ = geometry.screenMesh.center[2];
      const minDistH = 1.2 * sh;

      const rowASeats = seatLayout.seats.filter((s) => s.row === 'A');
      for (const s of rowASeats) {
        const distZ = Math.abs(s.position_gltf_y_up[2] - screenZ);
        expect(distZ).toBeGreaterThanOrEqual(minDistH - 0.05);
        expect(s.screen_h_fov_deg).toBeLessThanOrEqual(75.5);
      }

      const allRows = Array.from(new Set(seatLayout.seats.map((s) => s.row))).sort();
      const backRow = allRows[allRows.length - 1];
      const backSeats = seatLayout.seats.filter((s) => s.row === backRow);
      for (const s of backSeats) {
        expect(s.screen_h_fov_deg).toBeGreaterThanOrEqual(28.0);
      }
    });

    it('ensures no obstructing partition wall in the middle of the hall and effect props are slim and off-center', () => {
      // Stage lip sits compactly under screen (min Z >= SCREEN_Z - 1.5, nowhere near Row A at Z <= -11.6)
      expect(geometry.stageLip.min[2]).toBeGreaterThan(-3.0);
      expect(geometry.stageLip.max[2]).toBeLessThanOrEqual(geometry.screenMesh.center[2]);
      // Poke actuators are not located at X = 0.0 (middle aisle)
      const pokeProps = (geometry.effectProps || []).filter((p) => p.type === 'poke');
      for (const p of pokeProps) {
        expect(Math.abs(p.position[0])).toBeGreaterThan(0.5);
      }
    });
  });
});
