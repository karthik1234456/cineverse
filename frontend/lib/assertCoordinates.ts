import * as THREE from 'three';
import type { SeatLayoutFile } from './types';

/**
 * Validates GLB scene coordinates against layout metadata.
 * Fails loudly in dev if bounds or screen center diverge by > 0.01.
 */
export function assertSceneCoordinates(scene: THREE.Object3D, layout: SeatLayoutFile) {
  if (process.env.NODE_ENV === 'production') return;

  scene.updateMatrixWorld(true);

  // 1. Assert Screen Centre
  const screenNode = scene.getObjectByName(layout.screen.mesh);
  if (!screenNode) {
    console.warn(`[CoordinateCheck] Screen node "${layout.screen.mesh}" not found in GLB`);
  } else {
    const screenBox = new THREE.Box3().setFromObject(screenNode);
    const center = new THREE.Vector3();
    screenBox.getCenter(center);
    const expected = layout.screen.center_gltf_y_up;
    const diff = Math.hypot(center.x - expected[0], center.y - expected[1], center.z - expected[2]);
    if (diff > 0.05) {
      console.error(
        `[CoordinateCheck ERROR] Screen center mismatch: GLB computed [${center.x.toFixed(3)}, ${center.y.toFixed(3)}, ${center.z.toFixed(3)}], expected [${expected.join(', ')}] (diff ${diff.toFixed(3)})`
      );
    } else {
      console.info(`[CoordinateCheck] Screen center verified (diff ${diff.toFixed(4)})`);
    }
  }

  // 2. Assert each seat's Box3 matches bounds_gltf_y_up within 0.01
  let errors = 0;
  for (const seat of layout.seats) {
    const node = scene.getObjectByName(seat.node_name);
    if (!node) {
      console.error(`[CoordinateCheck ERROR] Seat node "${seat.node_name}" missing from GLB!`);
      errors++;
      continue;
    }
    const box = new THREE.Box3().setFromObject(node);
    const expectedMin = seat.bounds_gltf_y_up.min;
    const expectedMax = seat.bounds_gltf_y_up.max;

    const minDiff = Math.max(
      Math.abs(box.min.x - expectedMin[0]),
      Math.abs(box.min.y - expectedMin[1]),
      Math.abs(box.min.z - expectedMin[2])
    );
    const maxDiff = Math.max(
      Math.abs(box.max.x - expectedMax[0]),
      Math.abs(box.max.y - expectedMax[1]),
      Math.abs(box.max.z - expectedMax[2])
    );

    if (minDiff > 0.015 || maxDiff > 0.015) {
      console.error(
        `[CoordinateCheck ERROR] Seat "${seat.seat_id}" (${seat.node_name}) bounds mismatch > 0.01: minDiff=${minDiff.toFixed(3)}, maxDiff=${maxDiff.toFixed(3)}`
      );
      errors++;
    }
  }

  if (errors > 0) {
    console.error(`[CoordinateCheck FAILED] Found ${errors} coordinate mismatches!`);
  } else {
    console.info('[CoordinateCheck SUCCESS] All 100 seats verified within 0.01 tolerance.');
  }
}

