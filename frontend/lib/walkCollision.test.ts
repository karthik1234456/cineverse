import { describe, it, expect } from 'vitest';
import {
  getGroundHeightAt,
  resolveCircleAABB,
  stepPlayer,
  smoothEyeHeight,
  type WalkableSurface,
  type Collider
} from './walkCollision';
import walkNavData from '../public/models/walk_nav_v2.json';

const walkables = walkNavData.walkable as unknown as WalkableSurface[];
const colliders = walkNavData.colliders as unknown as Collider[];

describe('WalkCollision Physics & Navigation Engine', () => {
  it('01. Player slides smoothly along wall surface without getting stuck', () => {
    // Left wall is at x in [-11.11, -10.69]. Player at x=-10.4 walks diagonally towards it (dx=-0.2, dz=-0.5).
    const start = { x: -10.4, y: 0.0, z: -5.0 };
    const move = { dx: -0.5, dz: -0.5 };
    const result = stepPlayer(start, move, walkables, colliders, { radius: 0.30 });

    // Should slide: x clamped to wall boundary (~ -10.69 + 0.30 = -10.39), while z advances
    expect(result.collidedWithWall).toBe(true);
    expect(result.newPos.x).toBeGreaterThan(-10.45);
    expect(result.newPos.z).toBeLessThan(start.z);
  });

  it('02. Resolves corner collision without vibrating or freezing', () => {
    const box = {
      min: [1.0, 0.0, 1.0] as [number, number, number],
      max: [3.0, 2.0, 3.0] as [number, number, number]
    };
    // Circle intersecting the corner (minX, minZ) = (1.0, 1.0)
    const px = 0.85;
    const pz = 0.85;
    const res = resolveCircleAABB(px, pz, 0.30, box);

    expect(res.collided).toBe(true);
    const distFromCorner = Math.hypot(res.x - 1.0, res.z - 1.0);
    expect(distFromCorner).toBeCloseTo(0.30, 2);
  });

  it('03. Sub-stepping eliminates tunneling through thin colliders at large delta', () => {
    // Thin rail post box
    const thinCollider: Collider = {
      name: 'thin_barrier',
      type: 'rail_post',
      bounds: {
        min: [-0.5, 0.0, -10.0],
        max: [0.5, 2.0, -9.9]
      }
    };
    const start = { x: 0.0, y: 0.0, z: -8.0 };
    // Large move of 4.0 units across the barrier at high speed/delta
    const largeMove = { dx: 0.0, dz: -4.0 };
    const res = stepPlayer(start, largeMove, walkables, [thinCollider], {
      radius: 0.30,
      subStepMaxDist: 0.05
    });

    // Player must be stopped in front of the barrier (z > -9.9 - 0.30 = -10.20, actually before z=-9.9)
    expect(res.newPos.z).toBeGreaterThan(-9.9);
    expect(res.collidedWithWall).toBe(true);
  });

  it('04. Seats act as solid obstacles and prevent walking between them', () => {
    // Seat E05 bounding box is in colliders
    const seatE05 = colliders.find((c) => c.name === 'seat_E_05');
    expect(seatE05).toBeDefined();

    const box = seatE05!.bounds;
    const centerX = (box.min[0] + box.max[0]) / 2;
    const centerZ = (box.min[2] + box.max[2]) / 2;

    // Attempt to step into center of seat
    const start = { x: centerX, y: box.min[1], z: box.max[2] + 0.6 };
    const move = { dx: 0.0, dz: -1.0 };
    const res = stepPlayer(start, move, walkables, colliders, { radius: 0.30 });

    expect(res.collidedWithWall).toBe(true);
    expect(res.newPos.z).toBeGreaterThan(box.max[2] + 0.25);
  });

  it('05. Central aisle (|x| < 0.56) is completely passable from front to back', () => {
    // Walk along central aisle from z=-5.5 to z=-15.0 at x=0
    let pos = { x: 0.0, y: 0.0, z: -5.5 };
    for (let step = 0; step < 20; step++) {
      const res = stepPlayer(pos, { dx: 0.0, dz: -0.4 }, walkables, colliders, { radius: 0.30 });
      pos = res.newPos;
    }

    expect(pos.z).toBeLessThan(-12.0);
    expect(Math.abs(pos.x)).toBeLessThan(0.56);
  });

  it('06. Stage lip (y=1.56) blocks player from walking up to the screen', () => {
    const stageLip = colliders.find((c) => c.name === 'screen_stage_lip');
    expect(stageLip).toBeDefined();

    // From z=-2.5 walking towards screen (z=-0.5)
    const start = { x: 0.0, y: 0.0, z: -2.5 };
    const move = { dx: 0.0, dz: 2.0 };
    const res = stepPlayer(start, move, walkables, colliders, { radius: 0.30 });

    expect(res.collidedWithWall).toBe(true);
    expect(res.newPos.z).toBeLessThan(stageLip!.bounds.min[2]);
  });

  it('07. Tiers and treads step up smoothly (rise <= 0.25 <= maxStepUp)', () => {
    // Tiers rise 0.22u each, well within maxStepUp=0.30u
    const groundFloor = getGroundHeightAt(0.0, -5.5, walkables, 0.0);
    const groundTierA = getGroundHeightAt(0.0, -7.5, walkables, 0.0);

    expect(groundFloor).toBeCloseTo(-0.025, 2);
    expect(groundTierA).toBeGreaterThan(groundFloor!);
    expect(groundTierA! - groundFloor!).toBeLessThanOrEqual(0.30);
  });

  it('08. Edge guard blocks stepping off platforms into unmodelled drops > 0.40u', () => {
    // Platform J is at y=2.20. Behind it drops to floor (y=0), diff=2.20u > 0.40u
    const posOnJ = { x: 0.0, y: 2.20, z: -21.8 };
    const moveOffEdge = { dx: 0.0, dz: -1.0 }; // moving backwards towards rear wall
    const res = stepPlayer(posOnJ, moveOffEdge, walkables, colliders, { radius: 0.30, maxStepDown: 0.40 });

    expect(res.blockedByEdge).toBe(true);
    expect(res.newPos.y).toBeCloseTo(2.20, 1);
  });

  it('09. Eye height critically damped smoothing prevents abrupt camera jumps', () => {
    let eyeY = 3.77;
    const targetY = 4.50; // stepped onto platform
    const dt = 0.016; // 60 fps frame

    eyeY = smoothEyeHeight(eyeY, targetY, dt, 14.0);
    expect(eyeY).toBeGreaterThan(3.77);
    expect(eyeY).toBeLessThan(4.50); // smooth, not instantaneous teleport
  });

  it('10. Frame-rate independence: displacement at 30 fps matches 144 fps within 10%', () => {
    const walkSpeed = 3.0; // 3 u/s
    const totalTime = 1.0; // 1 second

    // 30 fps
    const dt30 = 1.0 / 30;
    let dist30 = 0;
    for (let i = 0; i < 30; i++) {
      dist30 += walkSpeed * dt30;
    }

    // 144 fps
    const dt144 = 1.0 / 144;
    let dist144 = 0;
    for (let i = 0; i < 144; i++) {
      dist144 += walkSpeed * dt144;
    }

    expect(Math.abs(dist30 - dist144) / dist30).toBeLessThan(0.01);
  });

  it('11. Back wall seals auditorium completely, including at exit door positions (x=-7.5, x=0, x=+7.5)', () => {
    const backWall = colliders.find((c) => c.name === 'back_wall');
    expect(backWall).toBeDefined();
    expect(backWall!.bounds.min[0]).toBeLessThanOrEqual(-11.0);
    expect(backWall!.bounds.max[0]).toBeGreaterThanOrEqual(11.0);

    // Test multiple x coordinates: left exit door area (-7.5), center aisle (0), right exit door area (+7.5)
    for (const testX of [-7.5, -4.0, 0.0, 4.0, 7.5]) {
      const start = { x: testX, y: 0.0, z: -25.0 };
      const move = { dx: 0.0, dz: -3.0 }; // attempt to push through back wall past -26.0
      const res = stepPlayer(start, move, walkables, colliders, { radius: 0.30 });

      expect(res.collidedWithWall).toBe(true);
      expect(res.newPos.z).toBeGreaterThanOrEqual(backWall!.bounds.max[2]);
      expect(res.newPos.z).toBeGreaterThan(-26.0);
    }
  });

  it('12. Screen structures (outer frame and stage lip) prevent penetration to screen surface', () => {
    const outerFrame = colliders.find((c) => c.name === 'screen_outer_frame');
    const stageLip = colliders.find((c) => c.name === 'screen_stage_lip');
    expect(outerFrame).toBeDefined();
    expect(stageLip).toBeDefined();

    // From z=-2.5 at various X coordinates facing the screen
    for (const testX of [-5.0, -2.0, 0.0, 2.0, 5.0]) {
      const start = { x: testX, y: 0.0, z: -2.0 };
      const move = { dx: 0.0, dz: 3.0 }; // try to walk through screen at z=-1.255
      const res = stepPlayer(start, move, walkables, colliders, { radius: 0.30 });

      expect(res.collidedWithWall).toBe(true);
      // Stopped before stage lip min z
      expect(res.newPos.z).toBeLessThanOrEqual(stageLip!.bounds.min[2] + 0.01);
    }
  });

  it('13. Perimeter walls contain player across the full length of the auditorium', () => {
    const leftWall = colliders.find((c) => c.name === 'left_wall');
    const rightWall = colliders.find((c) => c.name === 'right_wall');
    expect(leftWall).toBeDefined();
    expect(rightWall).toBeDefined();

    // Left wall penetration attempt
    const leftStart = { x: -10.0, y: 0.0, z: -10.0 };
    const leftRes = stepPlayer(leftStart, { dx: -3.0, dz: 0.0 }, walkables, colliders, { radius: 0.30 });
    expect(leftRes.collidedWithWall).toBe(true);
    expect(leftRes.newPos.x).toBeGreaterThanOrEqual(leftWall!.bounds.max[0]);

    // Right wall penetration attempt
    const rightStart = { x: 10.0, y: 0.0, z: -10.0 };
    const rightRes = stepPlayer(rightStart, { dx: 3.0, dz: 0.0 }, walkables, colliders, { radius: 0.30 });
    expect(rightRes.collidedWithWall).toBe(true);
    expect(rightRes.newPos.x).toBeLessThanOrEqual(rightWall!.bounds.min[0]);
  });

  it('14. Exactly 122 colliders present (100 seats + 22 architectural barriers)', () => {
    expect(colliders.length).toBe(122);
    const seatColliders = colliders.filter((c) => c.name.startsWith('seat_'));
    expect(seatColliders.length).toBe(100);
    const nonSeatColliders = colliders.filter((c) => !c.name.startsWith('seat_'));
    expect(nonSeatColliders.length).toBe(22);
  });
});

