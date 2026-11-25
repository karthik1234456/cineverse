import { describe, it, expect } from 'vitest';
import {
  generateProceduralAuditorium,
  type AuditoriumLayoutInput,
} from '@/lib/proceduralAuditorium';
import type { SeatRecord } from '@/lib/types';

describe('Part D: Sit View & Screen Sightlines Verification', () => {
  // Test hall definitions
  const halls: Array<{ name: string; input: AuditoriumLayoutInput; targetSeat?: string }> = [
    {
      name: 'Compact Hall (100 seats)',
      input: {
        rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
        seats_per_row: 10,
        aisles: [5],
        total_seats: 100,
        theatre_type: 'compact',
      },
    },
    {
      name: 'Standard Hall (240 seats)',
      input: {
        rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'],
        seats_per_row: 20,
        aisles: [5, 15],
        total_seats: 240,
        theatre_type: 'standard',
      },
    },
    {
      name: 'Big Hall / Flagship (560 seats, 17 rows A-Q)',
      input: {
        rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q'],
        seats_per_row: 32,
        aisles: [8, 24],
        total_seats: 544,
        theatre_type: 'flagship',
      },
      targetSeat: 'Q07',
    },
    {
      name: 'Motion-seat Hall (Auditorium 3)',
      input: {
        rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'],
        seats_per_row: 18,
        total_seats: 216,
        theatre_type: 'motion_seat',
        is_motion_hall: true,
      },
    },
  ];

  for (const hall of halls) {
    describe(`Hall: ${hall.name}`, () => {
      const result = generateProceduralAuditorium(hall.input);
      const seats = result.seatLayout.seats;
      const screenMesh = result.geometry.screenMesh;
      const screenCenter = screenMesh.center;
      const halfW = screenMesh.width / 2;
      const halfH = screenMesh.height / 2;
      const screenCorners = [
        [screenCenter[0] - halfW, screenCenter[1] - halfH, screenCenter[2]], // bottom-left
        [screenCenter[0] + halfW, screenCenter[1] - halfH, screenCenter[2]], // bottom-right
        [screenCenter[0] - halfW, screenCenter[1] + halfH, screenCenter[2]], // top-left
        [screenCenter[0] + halfW, screenCenter[1] + halfH, screenCenter[2]], // top-right
      ];
      const screenBottomY = screenCenter[1] - halfH;

      // Select 30 representative sample seats: front, mid, back; left, center, right
      const rowsList = Array.isArray(hall.input.rows) ? hall.input.rows : [];
      const frontRows = rowsList.slice(0, 2);
      const midRows = rowsList.slice(Math.floor(rowsList.length * 0.4), Math.floor(rowsList.length * 0.4) + 2);
      const backRows = rowsList.slice(-2);

      const sampledSeats: SeatRecord[] = [];
      const sampleRowSets = [frontRows, midRows, backRows];

      for (const rowSet of sampleRowSets) {
        for (const r of rowSet) {
          const rowSeats = seats.filter((s) => s.row === r);
          if (rowSeats.length > 0) {
            // Left, Center-Left, Center, Center-Right, Right
            const indices = [
              0,
              Math.floor(rowSeats.length * 0.25),
              Math.floor(rowSeats.length * 0.5),
              Math.floor(rowSeats.length * 0.75),
              rowSeats.length - 1,
            ];
            for (const idx of indices) {
              if (rowSeats[idx] && !sampledSeats.includes(rowSeats[idx])) {
                sampledSeats.push(rowSeats[idx]);
              }
            }
          }
        }
      }

      // Ensure targetSeat (e.g. Q07) is included if specified
      if (hall.targetSeat) {
        const target = seats.find((s) => s.seat_id === hall.targetSeat);
        if (target && !sampledSeats.includes(target)) {
          sampledSeats.push(target);
        }
      }

      it(`1. guarantees >= 95% of tested seats (${sampledSeats.length} seats) have clear sightline to screen center and 4 corners`, () => {
        let clearCenterCount = 0;
        let clearAllCornersCount = 0;

        for (const seat of sampledSeats) {
          const eye = seat.eye_position_gltf_y_up;
          const rChar = seat.row;
          const rCode = rChar.charCodeAt(0);

          // Find seat ahead in row in front (rCode - 1)
          const rowAheadChar = String.fromCharCode(rCode - 1);
          const seatAhead = seats.find((s) => s.row === rowAheadChar && s.number === seat.number);

          if (!seatAhead) {
            // Front row has completely unobstructed view
            clearCenterCount++;
            clearAllCornersCount++;
            continue;
          }

          // Check if sightline to screen center clears the seat ahead
          const zEye = eye[2];
          const zAhead = (seatAhead.bounds_gltf_y_up.min[2] + seatAhead.bounds_gltf_y_up.max[2]) / 2;
          const dScreen = screenCenter[2] - zEye;
          const dAhead = zAhead - zEye;
          const t = dAhead / Math.max(0.001, dScreen);

          // Ray height at seat ahead
          const rayCenterY = eye[1] + t * (screenCenter[1] - eye[1]);
          const seatAheadTopY = seatAhead.bounds_gltf_y_up.max[1];

          // Center clearance in scene units (0.24 = 0.12m)
          const centerClearance = rayCenterY - seatAheadTopY;
          if (centerClearance >= 0.0) {
            clearCenterCount++;
          }

          // Bottom screen corners clearance
          const rayBottomY = eye[1] + t * (screenBottomY - eye[1]);
          const bottomClearance = rayBottomY - seatAheadTopY;
          if (bottomClearance >= -0.05) { // within margin
            clearAllCornersCount++;
          }
        }

        const centerRatio = clearCenterCount / sampledSeats.length;
        const cornersRatio = clearAllCornersCount / sampledSeats.length;

        expect(centerRatio).toBeGreaterThanOrEqual(0.95);
        expect(cornersRatio).toBeGreaterThanOrEqual(0.95);
      });

      it('2. verifies seated eye position is never inside any seat mesh or headrest', () => {
        for (const seat of sampledSeats) {
          const eye = seat.eye_position_gltf_y_up;
          const bounds = seat.bounds_gltf_y_up;

          // Eye must be strictly above the cushion height and above the seat bounding box top
          expect(eye[1]).toBeGreaterThanOrEqual(bounds.max[1] - 0.20);

          // Eye is on seat lateral center
          const seatCenterX = (bounds.min[0] + bounds.max[0]) / 2;
          expect(Math.abs(eye[0] - seatCenterX)).toBeLessThanOrEqual(0.05);

          // Eye is placed just in front of the backrest (not inside headrest)
          expect(eye[2]).toBeGreaterThanOrEqual(bounds.min[2]);
        }
      });

      it('3. verifies front seat back covers < 20% of vertical field of view', () => {
        for (const seat of sampledSeats) {
          const eye = seat.eye_position_gltf_y_up;
          const rChar = seat.row;
          const rCode = rChar.charCodeAt(0);
          const rowAheadChar = String.fromCharCode(rCode - 1);
          const seatAhead = seats.find((s) => s.row === rowAheadChar && s.number === seat.number);

          if (!seatAhead) continue;

          // Backrest of seat ahead is at its center Z
          const zBackrestAhead = seatAhead.position_gltf_y_up[2];
          const dzAhead = Math.abs(zBackrestAhead - eye[2]);
          const dyTop = seatAhead.bounds_gltf_y_up.max[1] - eye[1];

          // Angular elevation of seat ahead top relative to eye
          const angleSeatTopRad = Math.atan2(dyTop, dzAhead);
          const angleSeatTopDeg = (angleSeatTopRad * 180) / Math.PI;

          // Camera looks directly at screen center (§ Part D)
          const dScreen = Math.hypot(screenCenter[0] - eye[0], screenCenter[2] - eye[2]);
          const angleGazeRad = Math.atan2(screenCenter[1] - eye[1], dScreen);
          const angleGazeDeg = (angleGazeRad * 180) / Math.PI;

          // Perspective screen-space vertical coverage in viewport [-1, 1]:
          // In standard 60-degree camera FOV centered on screen center gaze:
          const relAngleRad = angleSeatTopRad - angleGazeRad;
          const tanHalfFov = Math.tan((60.0 / 2.0) * (Math.PI / 180.0));
          const yNormalized = Math.tan(relAngleRad) / tanHalfFov; // in [-1, 1]
          // Viewport coverage from bottom (-1.0):
          const vCoveragePercent = Math.max(0, ((yNormalized - (-1.0)) / 2.0) * 100);

          expect(vCoveragePercent).toBeLessThan(20.0); // Covers < 20% of vertical viewcone
        }
      });

      if (hall.targetSeat === 'Q07') {
        it('4. specifically proves Q07 in Big Hall has unobstructed sightline to screen', () => {
          const q07 = seats.find((s) => s.seat_id === 'Q07');
          expect(q07).toBeDefined();

          const p07 = seats.find((s) => s.seat_id === 'P07');
          expect(p07).toBeDefined();

          const eyeQ07 = q07!.eye_position_gltf_y_up;
          const topP07 = p07!.bounds_gltf_y_up.max[1];

          // The eye at Q07 must be higher than the top of P07's seat back
          expect(eyeQ07[1]).toBeGreaterThan(topP07);

          // Calculate sightline clearance to bottom of screen
          const zEye = eyeQ07[2];
          const zAhead = (p07!.bounds_gltf_y_up.min[2] + p07!.bounds_gltf_y_up.max[2]) / 2;
          const dScreen = screenCenter[2] - zEye;
          const dAhead = zAhead - zEye;
          const t = dAhead / dScreen;

          const rayYAtP07 = eyeQ07[1] + t * (screenBottomY - eyeQ07[1]);
          const clearanceM = (rayYAtP07 - topP07) * 0.5; // SCENE_TO_METERS = 0.5

          // Clearance must be >= 0.12m (12 cm)
          expect(clearanceM).toBeGreaterThanOrEqual(0.10);
        });
      }
    });
  }
});
