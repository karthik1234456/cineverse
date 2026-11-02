import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { SeatLayoutFile } from './types';

describe('GLB Model Integrity & Bounding Box Verification', () => {
  const glbPath = path.resolve(__dirname, '../public/models/cineverse_auditorium_v2.glb');
  const layoutPath = path.resolve(__dirname, '../public/models/seat_layout_v2.json');
  const layout: SeatLayoutFile = JSON.parse(fs.readFileSync(layoutPath, 'utf-8'));

  it('loads GLB and asserts every seat node exists and world Box3 matches layout within 0.01 tolerance', async () => {
    const glbBuffer = fs.readFileSync(glbPath);
    const arrayBuffer = glbBuffer.buffer.slice(
      glbBuffer.byteOffset,
      glbBuffer.byteOffset + glbBuffer.byteLength
    );

    const loader = new GLTFLoader();
    const gltf = await new Promise<GLTF>((resolve, reject) => {
      loader.parse(arrayBuffer, '', resolve, reject);
    });

    const scene: THREE.Group = gltf.scene;
    // Update world matrices so Box3 calculations are in true world space
    scene.updateMatrixWorld(true);

    // Verify screen mesh and centre
    const screenNode = scene.getObjectByName(layout.screen.mesh);
    expect(screenNode).toBeDefined();
    if (screenNode) {
      const screenBox = new THREE.Box3().setFromObject(screenNode);
      const screenCenter = new THREE.Vector3();
      screenBox.getCenter(screenCenter);

      expect(screenCenter.x).toBeCloseTo(layout.screen.center_gltf_y_up[0], 2);
      expect(screenCenter.y).toBeCloseTo(layout.screen.center_gltf_y_up[1], 2);
      expect(screenCenter.z).toBeCloseTo(layout.screen.center_gltf_y_up[2], 2);
    }

    // Verify each seat node
    let matchedSeats = 0;
    for (const seat of layout.seats) {
      const node = scene.getObjectByName(seat.node_name);
      expect(node, `Node ${seat.node_name} must exist in the GLB`).toBeDefined();
      if (!node) continue;

      const box = new THREE.Box3().setFromObject(node);
      const expectedMin = seat.bounds_gltf_y_up.min;
      const expectedMax = seat.bounds_gltf_y_up.max;

      // Assert Box3 bounds match JSON bounds within 0.01
      expect(Math.abs(box.min.x - expectedMin[0])).toBeLessThanOrEqual(0.01);
      expect(Math.abs(box.min.y - expectedMin[1])).toBeLessThanOrEqual(0.01);
      expect(Math.abs(box.min.z - expectedMin[2])).toBeLessThanOrEqual(0.01);

      expect(Math.abs(box.max.x - expectedMax[0])).toBeLessThanOrEqual(0.01);
      expect(Math.abs(box.max.y - expectedMax[1])).toBeLessThanOrEqual(0.01);
      expect(Math.abs(box.max.z - expectedMax[2])).toBeLessThanOrEqual(0.01);

      matchedSeats++;
    }

    expect(matchedSeats).toBe(100);
  });
});
