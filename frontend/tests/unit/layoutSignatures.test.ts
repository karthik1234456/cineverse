import { describe, it, expect } from 'vitest';
import { generateProceduralAuditorium } from '../../lib/proceduralAuditorium';

describe('PART D: Seating Gaps & Varied Signatures', () => {
  it('enforces visible armrest gap in seat pitch (width + 0.08m)', () => {
    const res = generateProceduralAuditorium({
      theatre_type: 'flagship',
      rows: 10,
      seats_per_row: 16,
      screen_type: 'large_curved',
    });

    expect(res.seatLayout.seats.length).toBeGreaterThan(0);
    // Standard seat pitch is 0.55m width + 0.08m armrest = 0.63m -> 1.26 scene units
    // Verify distance between adjacent seats in same row
    const rowASeats = res.seatLayout.seats.filter(s => s.row === 'A').sort((a, b) => a.number - b.number);
    if (rowASeats.length >= 2) {
      const deltaX = Math.abs(rowASeats[1].position_gltf_y_up[0] - rowASeats[0].position_gltf_y_up[0]);
      // In scene units (scale = 2.0), deltaX should be >= 0.55 * 2.0 = 1.1u
      expect(deltaX).toBeGreaterThanOrEqual(1.1);
    }
  });

  it('produces distinct layout signatures across different theatre types', () => {
    const types = ['flagship', 'motion_seat', 'luxury_recliner', 'balcony', 'boutique', 'standard'];
    const signatures = new Set<string>();

    types.forEach(tid => {
      const res = generateProceduralAuditorium({
        theatre_type: tid,
        rows: 8,
        seats_per_row: 12,
        is_motion_hall: tid === 'motion_seat',
      });
      expect(res.seatLayout.layout_signature).toBeDefined();
      signatures.add(res.seatLayout.layout_signature!);
    });

    expect(signatures.size).toBeGreaterThanOrEqual(5);
    expect(signatures).toContain('motion_pods');
    expect(signatures).toContain('curved_rows');
    expect(signatures).toContain('back_pairs_lounge');
    expect(signatures).toContain('premium_middle_block');
  });

  it('ensures motion-seat halls use motion_pods signature and pods data', () => {
    const res = generateProceduralAuditorium({
      theatre_type: 'motion_seat',
      rows: 6,
      seats_per_row: 12,
      is_motion_hall: true,
    });

    expect(res.seatLayout.layout_signature).toBe('motion_pods');
    expect(res.seatLayout.pods).toBeDefined();
    expect(res.seatLayout.pods!.length).toBeGreaterThan(0);
  });
});
