import { describe, it, expect } from 'vitest';
import { generateProceduralAuditorium } from '../../lib/proceduralAuditorium';
import { THEATRE_TYPE_REGISTRY, type TheatreTypeId } from '../../lib/theatreTypeRegistry';

describe('Auditorium Geometry and Screen Placement', () => {
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

  it('inspects Auditorium 13 geometry and hall types', () => {
    for (const t of types) {
      const def = THEATRE_TYPE_REGISTRY[t];
      const rows = t === 'boutique' ? ['A', 'B', 'C', 'D', 'E', 'F'] : ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      const res = generateProceduralAuditorium({
        theatre_type: t,
        rows,
        seats_per_row: t === 'luxury_recliner' ? 8 : 10,
        aisles: t === 'luxury_recliner' ? [2, 6] : [3, 7],
      });

      const sMesh = res.geometry.screenMesh;
      const stage = res.geometry.stageLip;
      const frontWall = res.geometry.walls.front;
      const dims = res.geometry.dimensions;
      const seats = res.seatLayout.seats;
      const rowASeats = seats.filter(s => s.row === 'A');
      const rowAZ = rowASeats[0]?.position_gltf_y_up[2] ?? 0;
      const screenZ = sMesh.center[2];
      const screenDistM = Math.abs(rowAZ - screenZ) * 0.5;
      const screenWidthM = sMesh.width * 0.5;
      const screenHeightM = sMesh.height * 0.5;
      const bottomEdgeY = sMesh.center[1] - sMesh.height / 2;
      const stageDepth = stage.max[2] - stage.min[2];
      const fov = 2 * Math.atan((screenWidthM / 2) / screenDistM) * 180 / Math.PI;

      console.log(`=== Hall: ${t} ===`);
      console.log(`  Screen: width=${screenWidthM.toFixed(2)}m, height=${screenHeightM.toFixed(2)}m, center=[${sMesh.center.map(v => v.toFixed(2)).join(', ')}], bottomY=${bottomEdgeY.toFixed(2)}m`);
      console.log(`  Stage Lip: min=[${stage.min.map(v => v.toFixed(2))}], max=[${stage.max.map(v => v.toFixed(2))}], depth=${stageDepth.toFixed(2)}m`);
      console.log(`  Front Wall: min=[${frontWall.min.map(v => v.toFixed(2))}], max=[${frontWall.max.map(v => v.toFixed(2))}]`);
      console.log(`  Default Cam Pos: [${res.geometry.defaultCameraPos.map(v => v.toFixed(2)).join(', ')}], Target: [${res.geometry.defaultCameraTarget.map(v => v.toFixed(2)).join(', ')}]`);
      console.log(`  Distance to Row A: ${screenDistM.toFixed(2)}m (${(screenDistM / screenWidthM).toFixed(2)}x width), First-row FOV: ${fov.toFixed(1)} deg`);

      // Bounding box overlap checks
      // Screen box in scene:
      const screenMinZ = sMesh.center[2] - 0.15;
      const screenMaxZ = sMesh.center[2] + 0.15;
      const screenMinX = sMesh.center[0] - sMesh.width / 2;
      const screenMaxX = sMesh.center[0] + sMesh.width / 2;
      const screenMinY = bottomEdgeY;
      const screenMaxY = sMesh.center[1] + sMesh.height / 2;

      for (const seat of seats) {
        const sb = seat.bounds_gltf_y_up;
        const overlapX = !(screenMaxX < sb.min[0] || screenMinX > sb.max[0]);
        const overlapY = !(screenMaxY < sb.min[1] || screenMinY > sb.max[1]);
        const overlapZ = !(screenMaxZ < sb.min[2] || screenMinZ > sb.max[2]);
        if (overlapX && overlapY && overlapZ) {
          console.error(`  FAIL: Overlap with seat ${seat.seat_id}`);
          expect(overlapX && overlapY && overlapZ).toBe(false);
        }
      }

      // Check overlap between screen and stage lip
      const stageOverlapX = !(screenMaxX < stage.min[0] || screenMinX > stage.max[0]);
      const stageOverlapY = !(screenMaxY < stage.min[1] || screenMinY > stage.max[1]);
      const stageOverlapZ = !(screenMaxZ < stage.min[2] || screenMinZ > stage.max[2]);
      if (stageOverlapX && stageOverlapY && stageOverlapZ) {
        console.error(`  FAIL: Screen overlaps Stage Lip in ${t}`);
        expect(stageOverlapX && stageOverlapY && stageOverlapZ).toBe(false);
      }
    }
  });
});
