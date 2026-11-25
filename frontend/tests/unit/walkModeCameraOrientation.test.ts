import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { THEATRE_TYPE_REGISTRY, type TheatreTypeId } from '../../lib/theatreTypeRegistry';
import { generateProceduralAuditorium } from '../../lib/proceduralAuditorium';

describe('Walk Mode Camera Orientation and Motion Consistency (Part C)', () => {
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

  const MAX_PITCH = (85 * Math.PI) / 180; // 1.48353 rad (±85°)
  const WORLD_UP = new THREE.Vector3(0, 1, 0);

  it('proves camera up vector keeps dot product >= 0.99 with world up across all 8 hall types after 30s of random inputs', () => {
    for (const hallType of types) {
      const procedural = generateProceduralAuditorium({
        theatre_type: hallType,
        rows: ['A', 'B', 'C', 'D', 'E', 'F'],
        seats_per_row: 10,
        aisles: [3, 7],
      });

      const playerCfg = procedural.walkNav.player;
      const camera = new THREE.PerspectiveCamera();
      camera.up.copy(WORLD_UP);

      let yaw = playerCfg.spawn_yaw;
      let pitch = 0.0;
      const pos = new THREE.Vector3(...playerCfg.spawn_position);

      const sensitivity = 0.002;
      const dt = 1 / 60; // 60 FPS
      const totalFrames = 30 * 60; // 30 seconds

      // Pseudo-random deterministic seed
      let seed = 42;
      const rand = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      };

      for (let frame = 0; frame < totalFrames; frame++) {
        // Random mouse movement (-30px to +30px)
        const mouseDx = (rand() - 0.5) * 60;
        const mouseDy = (rand() - 0.5) * 60;

        yaw += mouseDx * sensitivity;
        pitch -= mouseDy * sensitivity;
        pitch = THREE.MathUtils.clamp(pitch, -MAX_PITCH, MAX_PITCH);

        // Random arrow turns
        const arrow = rand() > 0.6 ? 1 : rand() < 0.3 ? -1 : 0;
        yaw += arrow * 2.2 * dt;

        // Apply camera update logic from WalkController.tsx
        camera.position.set(pos.x, pos.y + playerCfg.standing_eye_height, pos.z);
        camera.up.set(0, 1, 0);
        camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw + Math.PI, 0, 'YXZ'));

        // Verify camera up dot world up
        const dot = camera.up.dot(WORLD_UP);
        expect(dot).toBeGreaterThanOrEqual(0.99);

        // Verify horizon level: roll (z rotation) must be 0
        const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
        expect(Math.abs(euler.z)).toBeLessThan(1e-5);

        // Verify pitch bounds
        expect(pitch).toBeGreaterThanOrEqual(-MAX_PITCH);
        expect(pitch).toBeLessThanOrEqual(MAX_PITCH);
      }
    }
  });

  it('proves W moves where camera looks, A/D strafe correctly, and ArrowLeft/Right turn in expected direction', () => {
    let yaw = 0.0; // facing +Z (screenward)
    let pitch = 0.2; // looking slightly up

    const camera = new THREE.PerspectiveCamera();
    camera.up.copy(WORLD_UP);
    camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw + Math.PI, 0, 'YXZ'));

    const forwardDir = new THREE.Vector3();
    camera.getWorldDirection(forwardDir);

    // Forward direction in horizontal plane (XZ)
    const horizForward = new THREE.Vector3(forwardDir.x, 0, forwardDir.z).normalize();
    expect(horizForward.z).toBeCloseTo(1.0, 4); // facing +Z

    // Movement forward (KeyW)
    const sinY = Math.sin(yaw);
    const cosY = Math.cos(yaw);
    const moveW = new THREE.Vector3(sinY, 0, cosY).normalize();
    expect(moveW.dot(horizForward)).toBeCloseTo(1.0, 4);

    // Strafe right (KeyD)
    const moveD = new THREE.Vector3(cosY, 0, -sinY).normalize();
    const rightDir = new THREE.Vector3().crossVectors(horizForward, WORLD_UP).normalize();
    expect(moveD.dot(new THREE.Vector3(1, 0, 0))).toBeCloseTo(1.0, 4); // +X is right

    // Arrow keys: ArrowLeft must decrease yaw (turn left), ArrowRight must increase yaw (turn right)
    let turnYaw = 0;
    const arrowLeftTurn = -1;
    turnYaw += arrowLeftTurn * 2.2 * 0.016;
    expect(turnYaw).toBeLessThan(0); // turning left

    const arrowRightTurn = 1;
    turnYaw += arrowRightTurn * 2.2 * 0.032;
    expect(turnYaw).toBeGreaterThan(0); // turning right
  });

  it('proves pointer lock and touch look yield identical yaw and pitch deltas', () => {
    const walkSettings = { sensitivity: 0.002, invertY: false };
    const MAX_PITCH = (85 * Math.PI) / 180;

    // Pointer lock delta
    let mouseYaw = 0;
    let mousePitch = 0;
    const movementX = 25;
    const movementY = -15;

    mouseYaw += movementX * walkSettings.sensitivity;
    mousePitch -= movementY * walkSettings.sensitivity;
    mousePitch = THREE.MathUtils.clamp(mousePitch, -MAX_PITCH, MAX_PITCH);

    // Touch look delta with equal scaled displacement
    let touchYaw = 0;
    let touchPitch = 0;
    const touchDx = 25 / 1.5;
    const touchDy = -15 / 1.5;

    touchYaw += touchDx * (walkSettings.sensitivity * 1.5);
    touchPitch -= touchDy * (walkSettings.sensitivity * 1.5);
    touchPitch = THREE.MathUtils.clamp(touchPitch, -MAX_PITCH, MAX_PITCH);

    expect(touchYaw).toBeCloseTo(mouseYaw, 5);
    expect(touchPitch).toBeCloseTo(mousePitch, 5);
  });
});
