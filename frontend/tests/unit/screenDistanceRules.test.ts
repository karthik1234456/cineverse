import { describe, it, expect } from 'vitest';
import { generateProceduralAuditorium } from '../../lib/proceduralAuditorium';
import { THEATRE_TYPES } from '../../lib/theatreTypeRegistry';

describe('PART F: Screen Distance Rules & FOV Verification', () => {
  const theatreTypes = [
    'compact',
    'standard',
    'large',
    'flagship',
    'dolby_atmos_4dx',
    'luxury_recliner',
    'boutique',
    'balcony',
  ];

  theatreTypes.forEach(tid => {
    it(`enforces distance >= 1.2x H and FOV limits for ${tid}`, () => {
      const res = generateProceduralAuditorium({
        theatre_type: tid,
        rows: 10,
        seats_per_row: 14,
        is_motion_hall: tid === 'dolby_atmos_4dx',
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

      // Rule 1: Front row distance >= 1.2 * screenHeight
      expect(frontDistance).toBeGreaterThanOrEqual(1.2 * screenHeight - 0.05);

      // Rule 2: Front row horizontal FOV <= 75 degrees
      const frontFOV = (2 * Math.atan((screenWidth / 2) / frontDistance) * 180) / Math.PI;
      expect(frontFOV).toBeLessThanOrEqual(75.5);

      // Rule 3: Back row horizontal FOV >= 28 degrees
      const lastRowLetter = res.seatLayout.seats[res.seatLayout.seats.length - 1].row;
      const backSeats = res.seatLayout.seats.filter(s => s.row === lastRowLetter);
      const backZ = backSeats[0].position_gltf_y_up[2] * 0.5;
      const backDistance = Math.abs(backZ - screenZ);
      const backFOV = (2 * Math.atan((screenWidth / 2) / backDistance) * 180) / Math.PI;

      expect(backFOV).toBeGreaterThanOrEqual(28.0);
    });
  });
});
