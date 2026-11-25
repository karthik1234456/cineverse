import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { SEAT_REGISTRY, getSeatFamilyForSeat } from '@/lib/seatRegistry';
import { THEATRE_TYPE_REGISTRY, type TheatreTypeId } from '@/lib/theatreTypeRegistry';
import { generateProceduralAuditorium } from '@/lib/proceduralAuditorium';

describe('Part E: Seat Shapes, Volume Ratios, and Hall Type Mapping Verification', () => {
  const modelsDir = path.resolve(__dirname, '../../public/models/seats');

  function computeGlbMeshVolume(filePath: string) {
    const buf = fs.readFileSync(filePath);
    const jsonLen = buf.readUInt32LE(12);
    const jsonStr = buf.toString('utf8', 20, 20 + jsonLen);
    const gltf = JSON.parse(jsonStr);
    const binOffset = 20 + jsonLen + 8;

    const prim = gltf.meshes[0].primitives[0];
    const posAcc = gltf.accessors[prim.attributes.POSITION];
    const idxAcc = gltf.accessors[prim.indices];

    const posBv = gltf.bufferViews[posAcc.bufferView];
    const idxBv = gltf.bufferViews[idxAcc.bufferView];

    const posByteOffset = binOffset + (posBv.byteOffset || 0) + (posAcc.byteOffset || 0);
    const idxByteOffset = binOffset + (idxBv.byteOffset || 0) + (idxAcc.byteOffset || 0);

    const numVertices = posAcc.count;
    const positions = new Float32Array(buf.buffer, buf.byteOffset + posByteOffset, numVertices * 3);

    const numIndices = idxAcc.count;
    const indices =
      idxAcc.componentType === 5123
        ? new Uint16Array(buf.buffer, buf.byteOffset + idxByteOffset, numIndices)
        : new Uint32Array(buf.buffer, buf.byteOffset + idxByteOffset, numIndices);

    let totalVol = 0;
    for (let i = 0; i < numIndices; i += 3) {
      const i0 = indices[i] * 3;
      const i1 = indices[i + 1] * 3;
      const i2 = indices[i + 2] * 3;

      const ax = positions[i0], ay = positions[i0 + 1], az = positions[i0 + 2];
      const bx = positions[i1], by = positions[i1 + 1], bz = positions[i1 + 2];
      const cx = positions[i2], cy = positions[i2 + 1], cz = positions[i2 + 2];

      const vol = (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6.0;
      totalVol += vol;
    }

    const [minX, minY, minZ] = posAcc.min;
    const [maxX, maxY, maxZ] = posAcc.max;
    const bboxVol = (maxX - minX) * (maxY - minY) * (maxZ - minZ);
    return {
      triangles: numIndices / 3,
      meshVolume: Math.abs(totalVol),
      bboxVolume: bboxVol,
      ratio: Math.abs(totalVol) / bboxVol,
      dimensions: {
        width: maxX - minX,
        height: maxY - minY,
        depth: maxZ - minZ,
      },
    };
  }

  it('reports exact volume-to-bounding-box ratios (< 0.70) and triangle counts for all seat families', () => {
    const families = [
      { id: 'standard', file: 'standard_lod0.glb', name: 'Standard Cinema Seat' },
      { id: 'recliner', file: 'recliner_single_lod0.glb', name: 'Luxury Recliner (Single)' },
      { id: 'recliner_pair', file: 'recliner_pair_lod0.glb', name: 'Luxury Recliner (Pair)' },
      { id: 'sofa', file: 'sofa_lod0.glb', name: 'Boutique Sofa' },
    ];

    const report: Record<string, any> = {};

    for (const fam of families) {
      const res = computeGlbMeshVolume(path.join(modelsDir, fam.file));
      report[fam.id] = {
        name: fam.name,
        triangles: res.triangles,
        meshVolume: res.meshVolume.toFixed(3),
        bboxVolume: res.bboxVolume.toFixed(3),
        volumeToBboxRatio: res.ratio.toFixed(3),
        dimensions: {
          width: res.dimensions.width.toFixed(2),
          height: res.dimensions.height.toFixed(2),
          depth: res.dimensions.depth.toFixed(2),
        },
      };

      console.log(`[Seat Shape Report] ${fam.name}:`);
      console.log(`  Triangles: ${res.triangles}`);
      console.log(`  Volume / BBox Ratio: ${res.ratio.toFixed(3)} (< 0.70 required)`);
      console.log(`  Dimensions (scene units): W=${res.dimensions.width.toFixed(2)}, H=${res.dimensions.height.toFixed(2)}, D=${res.dimensions.depth.toFixed(2)}`);

      // Formal assertion: not a plain box (must be < 0.70, genuine chair with armrest/headrest hollows)
      expect(res.ratio).toBeLessThan(0.70);
      expect(res.ratio).toBeGreaterThan(0.20);
      // Triangle count within realistic budget (singles <= 8000, double/pairs <= 14000)
      expect(res.triangles).toBeGreaterThanOrEqual(4000);
      expect(res.triangles).toBeLessThanOrEqual(fam.id === 'recliner_pair' ? 14000 : 8000);
    }
  });

  it('verifies seat family resolution across all 8 auditorium hall types, especially luxury_recliner', () => {
    const types: TheatreTypeId[] = [
      'compact',
      'standard',
      'large',
      'flagship',
      'motion_seat',
      'luxury_recliner',
      'boutique',
      'balcony',
    ];

    for (const t of types) {
      const aud = generateProceduralAuditorium({
        theatre_type: t,
        rows: ['A', 'B', 'C', 'D'],
        seats_per_row: 8,
      });

      const seats = aud.seatLayout.seats;
      const families = seats.map((s) => getSeatFamilyForSeat(s.category, s.seat_type, t, t));

      if (t === 'luxury_recliner') {
        // Every seat in luxury_recliner hall must resolve to 'recliner'
        expect(families.every((f) => f === 'recliner')).toBe(true);
      } else if (t === 'boutique') {
        expect(families.every((f) => f === 'sofa')).toBe(true);
      } else {
        expect(families.some((f) => f === 'standard')).toBe(true);
      }
    }
  });
});
