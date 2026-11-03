/**
 * WalkCollision — Pure TypeScript collision detection, sliding physics,
 * ground following, and edge-guard calculations for CineVerse 3D first-person walk mode.
 * 
 * Spec:
 * - Player = vertical capsule, radius 0.30u, standing eye height ~3.77u
 * - Horizontal: Circle-vs-AABB with sliding along surfaces
 * - Sub-stepping to prevent tunneling at high delta
 * - Vertical: Ground height = highest walkable surface under player (step-up <= 0.30u, step-down <= 0.40u)
 * - Edge guards: Any move that drops > 0.40u is blocked
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface BoundingBox {
  min: [number, number, number];
  max: [number, number, number];
}

export interface WalkableSurface {
  name: string;
  type: string;
  bounds: BoundingBox;
  top_y: number;
}

export interface Collider {
  name: string;
  type: string;
  bounds: BoundingBox;
}

export interface WalkPlayerState {
  position: Vec3; // ground position [x, groundY, z]
  eyeHeight: number; // current smooth eye height above ground
  yaw: number; // radians
  pitch: number; // radians
  isGrounded: boolean;
}

export interface WalkMovementOptions {
  radius?: number;
  maxStepUp?: number;
  maxStepDown?: number;
  playerHeight?: number;
  subStepMaxDist?: number;
}

const DEFAULT_RADIUS = 0.30;
const DEFAULT_MAX_STEP_UP = 0.30;
const DEFAULT_MAX_STEP_DOWN = 0.40;
const DEFAULT_PLAYER_HEIGHT = 4.20;
const DEFAULT_SUBSTEP_MAX_DIST = 0.05;

/**
 * Calculates highest walkable surface under the point (x, z).
 * Returns null if no walkable surface is below (or within tolerance).
 */
export function getGroundHeightAt(
  x: number,
  z: number,
  walkables: WalkableSurface[],
  currentGroundY: number,
  toleranceRadius: number = 0.15
): number | null {
  let highestY: number | null = null;

  for (const w of walkables) {
    const minX = w.bounds.min[0] - toleranceRadius;
    const maxX = w.bounds.max[0] + toleranceRadius;
    const minZ = w.bounds.min[2] - toleranceRadius;
    const maxZ = w.bounds.max[2] + toleranceRadius;

    if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) {
      const topY = w.top_y !== undefined ? w.top_y : w.bounds.max[1];
      if (highestY === null || topY > highestY) {
        highestY = topY;
      }
    }
  }

  return highestY;
}

/**
 * Circle-vs-AABB 2D collision resolution on XZ plane.
 * Modifies (px, pz) in place to push circle out of AABB.
 * Returns true if collision occurred.
 */
export function resolveCircleAABB(
  px: number,
  pz: number,
  radius: number,
  box: BoundingBox
): { x: number; z: number; collided: boolean } {
  const minX = box.min[0];
  const maxX = box.max[0];
  const minZ = box.min[2];
  const maxZ = box.max[2];

  // Find closest point on AABB to circle center
  const cx = Math.max(minX, Math.min(px, maxX));
  const cz = Math.max(minZ, Math.min(pz, maxZ));

  const dx = px - cx;
  const dz = pz - cz;
  const distSq = dx * dx + dz * dz;

  // No collision if outside radius
  if (distSq >= radius * radius) {
    return { x: px, z: pz, collided: false };
  }

  // If center is outside AABB but within radius
  if (distSq > 1e-8) {
    const dist = Math.sqrt(distSq);
    const overlap = radius - dist;
    const nx = dx / dist;
    const nz = dz / dist;
    return {
      x: px + nx * overlap,
      z: pz + nz * overlap,
      collided: true
    };
  }

  // Circle center is strictly inside AABB: push out via nearest edge
  const dLeft = px - minX;
  const dRight = maxX - px;
  const dFront = pz - minZ;
  const dBack = maxZ - pz;

  const minD = Math.min(dLeft, dRight, dFront, dBack);

  let outX = px;
  let outZ = pz;

  if (minD === dLeft) outX = minX - radius;
  else if (minD === dRight) outX = maxX + radius;
  else if (minD === dFront) outZ = minZ - radius;
  else outZ = maxZ + radius;

  return { x: outX, z: outZ, collided: true };
}

/**
 * Perform collision-aware step with sliding, edge-guarding, and ground following.
 */
export function stepPlayer(
  currentPos: Vec3,
  displacement: { dx: number; dz: number },
  walkables: WalkableSurface[],
  colliders: Collider[],
  options: WalkMovementOptions = {}
): { newPos: Vec3; blockedByEdge: boolean; collidedWithWall: boolean } {
  const radius = options.radius ?? DEFAULT_RADIUS;
  const maxStepUp = options.maxStepUp ?? DEFAULT_MAX_STEP_UP;
  const maxStepDown = options.maxStepDown ?? DEFAULT_MAX_STEP_DOWN;
  const playerHeight = options.playerHeight ?? DEFAULT_PLAYER_HEIGHT;
  const subStepMaxDist = options.subStepMaxDist ?? DEFAULT_SUBSTEP_MAX_DIST;

  const totalDist = Math.hypot(displacement.dx, displacement.dz);
  if (totalDist < 1e-6) {
    return { newPos: { ...currentPos }, blockedByEdge: false, collidedWithWall: false };
  }

  const numSubSteps = Math.max(1, Math.ceil(totalDist / subStepMaxDist));
  const stepDx = displacement.dx / numSubSteps;
  const stepDz = displacement.dz / numSubSteps;

  let curX = currentPos.x;
  let curY = currentPos.y;
  let curZ = currentPos.z;

  let anyBlockedByEdge = false;
  let anyCollided = false;

  for (let s = 0; s < numSubSteps; s++) {
    // 1. Candidate horizontal move
    let candX = curX + stepDx;
    let candZ = curZ + stepDz;

    // 2. Check vertical ground height at candidate position
    const candGroundY = getGroundHeightAt(candX, candZ, walkables, curY);

    if (candGroundY === null) {
      // Stepping into void / non-walkable zone -> edge guard blocks
      anyBlockedByEdge = true;
      break;
    }

    const stepDiff = candGroundY - curY;
    if (stepDiff > maxStepUp) {
      // Step too high
      anyBlockedByEdge = true;
      break;
    }

    if (stepDiff < -maxStepDown) {
      // Drop too steep -> edge guard prevents cliff fall
      anyBlockedByEdge = true;
      break;
    }

    // 3. Resolve horizontal collisions with sliding against relevant colliders
    let subStepCollided = false;
    for (let iter = 0; iter < 3; iter++) {
      let movedInIter = false;
      for (const col of colliders) {
        // Vertical overlap check
        const colMinY = col.bounds.min[1];
        const colMaxY = col.bounds.max[1];
        if (candGroundY + playerHeight < colMinY || candGroundY > colMaxY) {
          continue;
        }

        const resolved = resolveCircleAABB(candX, candZ, radius, col.bounds);
        if (resolved.collided) {
          candX = resolved.x;
          candZ = resolved.z;
          subStepCollided = true;
          movedInIter = true;
        }
      }
      if (!movedInIter) break;
    }

    if (subStepCollided) {
      anyCollided = true;
    }

    // 4. Verify resolved position is still on walkable surface
    const finalGroundY = getGroundHeightAt(candX, candZ, walkables, candGroundY);
    if (finalGroundY === null || Math.abs(finalGroundY - curY) > Math.max(maxStepUp, maxStepDown)) {
      // Collision pushed player off ground or over edge: cancel this substep
      anyBlockedByEdge = true;
      break;
    }

    // Accept sub-step
    curX = candX;
    curZ = candZ;
    curY = finalGroundY;
  }

  return {
    newPos: { x: curX, y: curY, z: curZ },
    blockedByEdge: anyBlockedByEdge,
    collidedWithWall: anyCollided
  };
}

/**
 * Critically damped spring-damper smoothing for eye elevation over tiers/stairs.
 */
export function smoothEyeHeight(
  currentEyeY: number,
  targetEyeY: number,
  deltaTime: number,
  damping: number = 14.0
): number {
  const diff = targetEyeY - currentEyeY;
  const factor = 1.0 - Math.exp(-damping * Math.min(deltaTime, 0.1));
  return currentEyeY + diff * factor;
}

