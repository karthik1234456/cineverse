import { describe, it, expect } from 'vitest';
import { generateProceduralAuditorium } from '../../lib/proceduralAuditorium';
import type { TheatreTypeId } from '../../lib/theatreTypeRegistry';

describe('Coherent Screen Distance Rules, FOV & Stage Apron Verification', () => {
  const theatreTypes = [
    'compact',
    'standard',
    'large',
    'flagship',
    'motion_seat',
    'dolby_atmos_4dx',
    'luxury_recliner',
    'boutique',
    'balcony',
  ];

  theatreTypes.forEach(tid => {
    it(`enforces distance 0.5-0.6x screen width, FOV 80-90 deg, empty floor <= 4m for ${tid}`, () => {
      const rows = tid === 'boutique' ? 6 : 10;
      const res = generateProceduralAuditorium({
        theatre_type: tid,
        rows,
        seats_per_row: 14,
        is_motion_hall: tid === 'motion_seat' || tid === 'dolby_atmos_4dx',
      });

      const screen = res.seatLayout.screen;
      // In scene units (scale = 2.0u/m)
      const screenWidth = screen.width * 0.5; // metres
      const screenHeight = screen.height * 0.5; // metres
      const screenZ = screen.center_gltf_y_up[2] * 0.5; // metres

      const rowASeats = res.seatLayout.seats.filter(s => s.row === 'A');
      expect(rowASeats.length).toBeGreaterThan(0);
      const rowAZ = rowASeats[0].position_gltf_y_up[2] * 0.5; // metres

      const frontDistance = Math.abs(rowAZ - screenZ);

      // Rule 1: Front row distance between 0.50 and 0.60 times screen width
      expect(frontDistance).toBeGreaterThanOrEqual(0.50 * screenWidth - 0.05);
      expect(frontDistance).toBeLessThanOrEqual(0.60 * screenWidth + 0.05);

      // Rule 2: Front row horizontal FOV between 80 and 90 degrees
      const frontFOV = (2 * Math.atan((screenWidth / 2) / frontDistance) * 180) / Math.PI;
      expect(frontFOV).toBeGreaterThanOrEqual(79.0);
      expect(frontFOV).toBeLessThanOrEqual(91.0);

      // Rule 3: Back row horizontal FOV >= 28 degrees
      const lastRowLetter = res.seatLayout.seats[res.seatLayout.seats.length - 1].row;
      const backSeats = res.seatLayout.seats.filter(s => s.row === lastRowLetter);
      const backZ = backSeats[0].position_gltf_y_up[2] * 0.5;
      const backDistance = Math.abs(backZ - screenZ);
      const backFOV = (2 * Math.atan((screenWidth / 2) / backDistance) * 180) / Math.PI;

      expect(backFOV).toBeGreaterThanOrEqual(28.0);

      // Rule 4: Empty floor between stage edge and Row A <= 4.0 m
      const stageLip = res.geometry.stageLip;
      const stageEdgeZ = stageLip.min[2] * 0.5; // stage front edge in metres
      const emptyFloorM = Math.abs(rowAZ - stageEdgeZ);
      expect(emptyFloorM).toBeLessThanOrEqual(4.0);
      expect(emptyFloorM).toBeGreaterThan(0.5); // strictly positive clearance
    });
  });
});

