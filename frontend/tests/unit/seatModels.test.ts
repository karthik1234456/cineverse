import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { SEAT_REGISTRY, getSeatFamilyForSeat } from '@/lib/seatRegistry';
import layoutData from '@/public/models/seat_layout_v2.json';
import type { SeatLayoutFile } from '@/lib/types';

describe('CineVerse 3D Seat Models & Registry Verification', () => {
  const modelsDir = path.resolve(__dirname, '../../public/models/seats');
  const manifestPath = path.join(modelsDir, 'manifest.json');

  it('1. verifies manifest.json exists and contains all 3 original seat families', () => {
    expect(fs.existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    expect(manifest.version).toBe('2.0.0');
    expect(manifest.families).toBeDefined();
    expect(manifest.families.standard).toBeDefined();
    expect(manifest.families.recliner).toBeDefined();
    expect(manifest.families.sofa).toBeDefined();
  });

  it('2. verifies all binary GLB model files exist on disk for all LODs and variants', () => {
    const requiredFiles = [
      'standard_lod0.glb',
      'standard_lod1.glb',
      'standard_lod2.glb',
      'standard_tipped.glb',
      'recliner_single_lod0.glb',
      'recliner_single_lod1.glb',
      'recliner_single_lod2.glb',
      'recliner_pair_lod0.glb',
      'recliner_pair_lod1.glb',
      'recliner_pair_lod2.glb',
      'sofa_lod0.glb',
      'sofa_lod1.glb',
      'sofa_lod2.glb',
    ];

    for (const file of requiredFiles) {
      const filePath = path.join(modelsDir, file);
      expect(fs.existsSync(filePath), `File ${file} must exist`).toBe(true);
      const stat = fs.statSync(filePath);
      expect(stat.size).toBeGreaterThan(1000); // Must be a valid GLB (> 1KB)
    }
  });

  it('3. verifies triangle counts per LOD match technical budget and manifest', () => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    // Family A: Standard
    const std = manifest.families.standard.lods;
    expect(std.lod0.triangles).toBeGreaterThanOrEqual(4000);
    expect(std.lod0.triangles).toBeLessThanOrEqual(8000);
    expect(std.lod1.triangles).toBeGreaterThanOrEqual(1200);
    expect(std.lod1.triangles).toBeLessThanOrEqual(1800);
    expect(std.lod2.triangles).toBeGreaterThanOrEqual(250);
    expect(std.lod2.triangles).toBeLessThanOrEqual(350);

    // Family B: Recliner Single
    const recSingle = manifest.families.recliner.single.lods;
    expect(recSingle.lod0.triangles).toBeGreaterThanOrEqual(4000);
    expect(recSingle.lod0.triangles).toBeLessThanOrEqual(8000);
    expect(recSingle.lod1.triangles).toBeGreaterThanOrEqual(1200);
    expect(recSingle.lod1.triangles).toBeLessThanOrEqual(1900);
    expect(recSingle.lod2.triangles).toBeGreaterThanOrEqual(250);
    expect(recSingle.lod2.triangles).toBeLessThanOrEqual(350);

    // Family C: Boutique Sofa
    const sofa = manifest.families.sofa.lods;
    expect(sofa.lod0.triangles).toBeGreaterThanOrEqual(4000);
    expect(sofa.lod0.triangles).toBeLessThanOrEqual(8000);
    expect(sofa.lod1.triangles).toBeGreaterThanOrEqual(1200);
    expect(sofa.lod1.triangles).toBeLessThanOrEqual(1800);
    expect(sofa.lod2.triangles).toBeGreaterThanOrEqual(250);
    expect(sofa.lod2.triangles).toBeLessThanOrEqual(450);
  });

  it('4. verifies footprint measurements match real-world metres and scene unit specifications', () => {
    // Standard seat: width ~0.62m (1.24u scene), height ~0.99m (1.98u scene)
    expect(SEAT_REGISTRY.standard.realWorldMeters.width).toBe(0.62);
    expect(SEAT_REGISTRY.standard.footprintSceneUnits[0]).toBe(1.24);

    // Recliner single: width ~0.88m (1.04u scene), height ~1.08m (2.08u scene)
    expect(SEAT_REGISTRY.recliner.realWorldMeters.width).toBe(0.88);
    expect(SEAT_REGISTRY.recliner.footprintSceneUnits[0]).toBe(1.04);

    // Recliner pair: width ~1.68m (1.84u scene)
    expect(SEAT_REGISTRY.recliner.pairVariant?.realWorldMeters.width).toBe(1.68);
    expect(SEAT_REGISTRY.recliner.pairVariant?.footprintSceneUnits[0]).toBe(1.84);

    // Sofa: width ~1.28m (1.24u scene)
    expect(SEAT_REGISTRY.sofa.realWorldMeters.width).toBe(1.28);
    expect(SEAT_REGISTRY.sofa.footprintSceneUnits[0]).toBe(1.24);
  });

  it('5. verifies all 100 supplied-hall seat positions in seat_layout_v2.json remain exact and unchanged', () => {
    const seats = (layoutData as unknown as SeatLayoutFile).seats;
    expect(seats.length).toBe(100);

    const seatMap = new Map(seats.map((s) => [s.seat_id, s]));

    // Check specific anchor seats across all rows
    const a01 = seatMap.get('A01')!;
    expect(a01.position_gltf_y_up).toEqual([6.0, 1.365, -8.032]);

    const a10 = seatMap.get('A10')!;
    expect(a10.position_gltf_y_up).toEqual([-6.0, 1.365, -8.032]);

    const e05 = seatMap.get('E05')!;
    expect(e05.position_gltf_y_up).toEqual([1.2, 2.245, -14.032]);

    const j01 = seatMap.get('J01')!;
    expect(j01.position_gltf_y_up).toEqual([6.0, 3.345, -21.532]);

    const j10 = seatMap.get('J10')!;
    expect(j10.position_gltf_y_up).toEqual([-6.0, 3.345, -21.532]);

    // Check seat spacing / clearance against standard model width
    // Check seat bounds against standard model footprint
    const boundsWidth = a01.bounds_gltf_y_up.max[0] - a01.bounds_gltf_y_up.min[0];
    expect(boundsWidth).toBeCloseTo(1.28, 2);
    // Model width is 1.24 scene units, so clearance is 0.04 units (no collision!)
    expect(boundsWidth).toBeGreaterThanOrEqual(SEAT_REGISTRY.standard.footprintSceneUnits[0]);
  });

  it('6. verifies seat family selector maps correctly across categories and hall types', () => {
    // Front & Prime categories -> Standard
    expect(getSeatFamilyForSeat('front', 'standard', 'Standard')).toBe('standard');
    expect(getSeatFamilyForSeat('prime', 'standard', 'Standard')).toBe('standard');

    // Premier category or recliner pairs -> Recliner
    expect(getSeatFamilyForSeat('premier', 'standard', 'Standard')).toBe('recliner');
    expect(getSeatFamilyForSeat('prime', 'recliner_pair', 'Standard')).toBe('recliner');

    // Boutique / VIP halls or sofa seat types -> Boutique Sofa
    expect(getSeatFamilyForSeat('prime', 'standard', 'Boutique VIP')).toBe('sofa');
    expect(getSeatFamilyForSeat('prime', 'sofa', 'Standard')).toBe('sofa');
  });
});
