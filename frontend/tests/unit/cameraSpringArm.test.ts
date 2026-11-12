import { describe, it, expect } from 'vitest';
import * as THREE from 'three';

// Spring-arm collision solver matching CameraController.tsx
export function solveSpringArm(
  target: THREE.Vector3,
  desiredPos: THREE.Vector3,
  bounds: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number },
  margin: number = 0.35
): THREE.Vector3 {
  const dir = new THREE.Vector3().subVectors(desiredPos, target);
  const dist = dir.length();
  if (dist < 1e-4) return desiredPos.clone();

  const u = dir.clone().multiplyScalar(1 / dist);
  let hitDist = Infinity;

  if (u.x > 1e-5) {
    hitDist = Math.min(hitDist, (bounds.maxX - margin - target.x) / u.x);
  } else if (u.x < -1e-5) {
    hitDist = Math.min(hitDist, (bounds.minX + margin - target.x) / u.x);
  }

  if (u.y > 1e-5) {
    hitDist = Math.min(hitDist, (bounds.maxY - margin - target.y) / u.y);
  } else if (u.y < -1e-5) {
    hitDist = Math.min(hitDist, (bounds.minY + margin - target.y) / u.y);
  }

  if (u.z > 1e-5) {
    hitDist = Math.min(hitDist, (bounds.maxZ - margin - target.z) / u.z);
  } else if (u.z < -1e-5) {
    hitDist = Math.min(hitDist, (bounds.minZ + margin - target.z) / u.z);
  }

  const maxAllowed = Math.max(2.2, Math.max(0, hitDist));
  const resultDist = Math.min(dist, maxAllowed);
  const clampedPos = target.clone().addScaledVector(u, resultDist);

  // Hard safety clamp
  const safetyMargin = 0.25;
  clampedPos.x = THREE.MathUtils.clamp(clampedPos.x, bounds.minX + safetyMargin, bounds.maxX - safetyMargin);
  clampedPos.y = THREE.MathUtils.clamp(clampedPos.y, bounds.minY + safetyMargin, bounds.maxY - safetyMargin);
  clampedPos.z = THREE.MathUtils.clamp(clampedPos.z, bounds.minZ + safetyMargin, bounds.maxZ - safetyMargin);

  return clampedPos;
}

describe('PART A: Spring-Arm Camera Collision & Boundary Clamping', () => {
  const bounds = {
    minX: -11.0,
    maxX: 11.0,
    minY: 1.0,
    maxY: 11.2,
    minZ: -28.0,
    maxZ: -2.5,
  };
  const target = new THREE.Vector3(0.0, 3.0, -14.0);

  it('rotates 360 degrees without stalling azimuth at three zoom levels', () => {
    const zoomDistances = [5.0, 15.0, 35.0]; // close, medium, far

    for (const radius of zoomDistances) {
      let previousAzimuth = -1;

      for (let deg = 0; deg <= 360; deg += 5) {
        const rad = (deg * Math.PI) / 180;
        const elevation = 0.35; // gentle angle looking down

        // Desired position in spherical orbit
        const desiredPos = new THREE.Vector3(
          target.x + radius * Math.cos(elevation) * Math.sin(rad),
          target.y + radius * Math.sin(elevation),
          target.z + radius * Math.cos(elevation) * Math.cos(rad)
        );

        const clamped = solveSpringArm(target, desiredPos, bounds);

        // 1. Camera strictly inside volume
        expect(clamped.x).toBeGreaterThanOrEqual(bounds.minX);
        expect(clamped.x).toBeLessThanOrEqual(bounds.maxX);
        expect(clamped.y).toBeGreaterThanOrEqual(bounds.minY);
        expect(clamped.y).toBeLessThanOrEqual(bounds.maxY);
        expect(clamped.z).toBeGreaterThanOrEqual(bounds.minZ);
        expect(clamped.z).toBeLessThanOrEqual(bounds.maxZ);

        // 2. Azimuth angle relative to target continues to rotate continuously
        const curAzimuth = Math.atan2(clamped.x - target.x, clamped.z - target.z);
        if (previousAzimuth !== -1 && deg > 0 && deg < 360) {
          // Angle should never be identical when stepping 5 degrees
          expect(curAzimuth).not.toBe(previousAzimuth);
        }
        previousAzimuth = curAzimuth;
      }
    }
  });

  it('pulls camera inward near walls instead of stalling', () => {
    // Ray pointing directly at right wall (X = 11.0)
    const farRightPos = new THREE.Vector3(50.0, target.y, target.z);
    const clamped = solveSpringArm(target, farRightPos, bounds);

    // Distance should be shortened to hit wall minus margin
    expect(clamped.x).toBeLessThan(bounds.maxX);
    expect(clamped.x).toBeGreaterThan(target.x);
    // Y and Z should remain aligned with target
    expect(clamped.y).toBeCloseTo(target.y, 2);
    expect(clamped.z).toBeCloseTo(target.z, 2);
  });
});
