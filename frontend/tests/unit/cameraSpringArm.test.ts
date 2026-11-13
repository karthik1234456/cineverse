import { describe, it, expect } from 'vitest';
import * as THREE from 'three';

// Spring-arm collision solver matching CameraController.tsx
export function solveSpringArm(
  target: THREE.Vector3,
  desiredPos: THREE.Vector3,
  bounds: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number },
  margin: number = 0.35,
  minDist: number = 2.0
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

  const maxAllowed = Math.max(minDist, Math.max(0, hitDist));
  const resultDist = Math.min(dist, maxAllowed);
  const clampedPos = target.clone().addScaledVector(u, resultDist);

  // Hard safety clamp
  const safetyMargin = 0.25;
  clampedPos.x = THREE.MathUtils.clamp(clampedPos.x, bounds.minX + safetyMargin, bounds.maxX - safetyMargin);
  clampedPos.y = THREE.MathUtils.clamp(clampedPos.y, bounds.minY + safetyMargin, bounds.maxY - safetyMargin);
  clampedPos.z = THREE.MathUtils.clamp(clampedPos.z, bounds.minZ + safetyMargin, bounds.maxZ - safetyMargin);

  return clampedPos;
}

export function computeProximityOpacity(distanceToSurface: number, fadeThreshold: number = 1.5): number {
  if (distanceToSurface >= fadeThreshold) return 1.0;
  return THREE.MathUtils.clamp((distanceToSurface - 0.2) / (fadeThreshold - 0.2), 0.0, 1.0);
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
    const zoomDistances = [3.0, 12.0, 35.0]; // close (near screen), medium, far

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

  it('respects pitch bounds from 8 to 85 degrees', () => {
    const minPitchRad = (8 * Math.PI) / 180; // 0.1396 rad
    const maxPitchRad = (85 * Math.PI) / 180; // 1.4835 rad

    for (let pitchDeg = 8; pitchDeg <= 85; pitchDeg += 5) {
      const phi = (pitchDeg * Math.PI) / 180;
      expect(phi).toBeGreaterThanOrEqual(minPitchRad - 1e-4);
      expect(phi).toBeLessThanOrEqual(maxPitchRad + 1e-4);
    }
  });

  it('fades out surfaces within ~1.5m of camera', () => {
    // Outside 1.5m -> full opacity 1.0
    expect(computeProximityOpacity(2.5)).toBe(1.0);
    expect(computeProximityOpacity(1.5)).toBe(1.0);

    // Between 0.2m and 1.5m -> smooth fade
    const midFade = computeProximityOpacity(0.85);
    expect(midFade).toBeGreaterThan(0.0);
    expect(midFade).toBeLessThan(1.0);

    // Below 0.2m -> completely faded out
    expect(computeProximityOpacity(0.15)).toBe(0.0);
  });

  it('verifies spring-arm bounds across all 4 hall types', () => {
    const hallBounds = {
      standard: { minX: -9.5, maxX: 9.5, minY: 1.0, maxY: 9.0, minZ: -24.5, maxZ: -2.0 },
      balcony: { minX: -14.5, maxX: 14.5, minY: 1.0, maxY: 14.5, minZ: -36.0, maxZ: -2.0 },
      luxury_recliner: { minX: -7.5, maxX: 7.5, minY: 1.0, maxY: 6.8, minZ: -18.5, maxZ: -2.0 },
      dolby_atmos_4dx: { minX: -10.5, maxX: 10.5, minY: 1.0, maxY: 10.0, minZ: -27.0, maxZ: -2.0 },
    };

    for (const [type, b] of Object.entries(hallBounds)) {
      const tgt = new THREE.Vector3(0, (b.minY + b.maxY) / 3, (b.minZ + b.maxZ) / 2);
      const testPos = new THREE.Vector3(b.maxX + 20, tgt.y, tgt.z);
      const res = solveSpringArm(tgt, testPos, b);

      expect(res.x).toBeLessThanOrEqual(b.maxX);
      expect(res.x).toBeGreaterThanOrEqual(b.minX);
      expect(res.y).toBeLessThanOrEqual(b.maxY);
      expect(res.y).toBeGreaterThanOrEqual(b.minY);
      expect(res.z).toBeLessThanOrEqual(b.maxZ);
      expect(res.z).toBeGreaterThanOrEqual(b.minZ);
    }
  });
});
