import { describe, it, expect } from 'vitest';
import { THEATRE_TYPE_REGISTRY, SCENE_TO_METERS, METERS_TO_SCENE } from '../../lib/theatreTypeRegistry';
import { generateProceduralAuditorium } from '../../lib/proceduralAuditorium';

describe('Screen Size Ranges & Distinctness Per Type', () => {
  it('verifies documented scale constants', () => {
    expect(SCENE_TO_METERS).toBe(0.5);
    expect(METERS_TO_SCENE).toBe(2.0);
  });

  it('standard flat screen is 15 to 19 m wide', () => {
    const std = THEATRE_TYPE_REGISTRY.standard;
    expect(std.screenType.type).toBe('standard_flat');
    expect(std.realWorldDimensions.screenWidthM).toBeGreaterThanOrEqual(15.0);
    expect(std.realWorldDimensions.screenWidthM).toBeLessThanOrEqual(19.0);
  });

  it('large curved or large format screen is 22 to 30 m wide', () => {
    const lrg = THEATRE_TYPE_REGISTRY.large;
    expect(lrg.screenType.type).toBe('large_curved');
    expect(lrg.realWorldDimensions.screenWidthM).toBeGreaterThanOrEqual(22.0);
    expect(lrg.realWorldDimensions.screenWidthM).toBeLessThanOrEqual(30.0);

    const flag = THEATRE_TYPE_REGISTRY.flagship;
    expect(flag.screenType.type).toBe('large_curved');
    expect(flag.realWorldDimensions.screenWidthM).toBeGreaterThanOrEqual(22.0);
    expect(flag.realWorldDimensions.screenWidthM).toBeLessThanOrEqual(30.0);
  });

  it('premium direct-view screen is 12 to 16 m wide', () => {
    const dir = THEATRE_TYPE_REGISTRY.luxury_recliner;
    expect(dir.screenType.type).toBe('premium_direct_view');
    expect(dir.realWorldDimensions.screenWidthM).toBeGreaterThanOrEqual(12.0);
    expect(dir.realWorldDimensions.screenWidthM).toBeLessThanOrEqual(16.0);
  });

  it('panoramic wrap screen is 17 to 22 m wide', () => {
    const wrap = THEATRE_TYPE_REGISTRY.motion_seat;
    expect(wrap.screenType.type).toBe('panoramic_wrap');
    expect(wrap.realWorldDimensions.screenWidthM).toBeGreaterThanOrEqual(17.0);
    expect(wrap.realWorldDimensions.screenWidthM).toBeLessThanOrEqual(22.0);
  });

  it('boutique screen is 8 to 11 m wide and hall has 60 to 120 seats', () => {
    const bq = THEATRE_TYPE_REGISTRY.boutique;
    expect(bq.screenType.type).toBe('boutique_small_flat');
    expect(bq.realWorldDimensions.screenWidthM).toBeGreaterThanOrEqual(8.0);
    expect(bq.realWorldDimensions.screenWidthM).toBeLessThanOrEqual(11.0);
    expect(bq.targetSeats[0]).toBeGreaterThanOrEqual(60);
    expect(bq.targetSeats[1]).toBeLessThanOrEqual(120);
  });

  it('ensures no two different types share identical sizes by accident', () => {
    const types = [
      'compact',
      'standard',
      'large',
      'flagship',
      'luxury_recliner',
      'motion_seat',
      'boutique'
    ] as const;

    const sizes = types.map(t => {
      const def = THEATRE_TYPE_REGISTRY[t];
      return `${def.realWorldDimensions.screenWidthM}x${def.realWorldDimensions.screenHeightM}`;
    });

    const uniqueSizes = new Set(sizes);
    expect(uniqueSizes.size).toBe(types.length);
  });

  it('procedural generation accurately respects scene-to-meters scale for every type', () => {
    const types = [
      'compact',
      'standard',
      'large',
      'flagship',
      'luxury_recliner',
      'motion_seat',
      'boutique'
    ] as const;

    types.forEach(t => {
      const res = generateProceduralAuditorium({
        theatre_type: t,
        rows: t === 'boutique' ? 6 : 10,
        seats_per_row: 14
      });

      const scr = res.seatLayout.screen;
      const expectedDef = THEATRE_TYPE_REGISTRY[t];
      const metricW = Math.round(scr.width * SCENE_TO_METERS * 10) / 10;
      const metricH = Math.round(scr.height * SCENE_TO_METERS * 10) / 10;

      expect(metricW).toBeCloseTo(expectedDef.realWorldDimensions.screenWidthM, 1);
      expect(metricH).toBeCloseTo(expectedDef.realWorldDimensions.screenHeightM, 1);
    });
  });
});
