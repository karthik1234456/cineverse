/**
 * First-person walk physics for the auditorium. Pure TypeScript.
 * World = glTF Y-up (screen z~-1.25, audience at negative Z, seats face +Z, right = -X).
 * Data comes from walk_nav_v2.json (AABBs). Never collide against the 1.5M-triangle meshes.
 *
 * Player state is the FEET position. Eye = feet.y + standing eye height (smoothed by the caller).
 * yaw 0 faces +Z; increasing yaw turns LEFT; forward = (sin yaw, cos yaw); right = (-cos yaw, sin yaw).
 */
export type Vec3 = [number, number, number];
export interface AABB { min: Vec3; max: Vec3; name?: string; kind?: string }
export interface NavData {
  player: { radius: number; standing_eye_height_units: number; max_step_up: number; max_step_down: number;
            walk_speed_units_per_s: number; run_speed_units_per_s: number; spawn: { position: Vec3 } };
  walkable: AABB[]; colliders: AABB[];
}
export interface PlayerParams { radius: number; bodyHeight: number; maxStepUp: number; maxStepDown: number }
export interface PlayerState { x: number; y: number; z: number }
export interface World { walkable: AABB[]; colliders: AABB[] }

const EPS = 1e-6, MAX_SUBSTEP = 0.1;

export function paramsFromNav(nav: NavData): PlayerParams {
  return { radius: nav.player.radius, bodyHeight: nav.player.standing_eye_height_units + 0.3,
           maxStepUp: nav.player.max_step_up, maxStepDown: nav.player.max_step_down };
}
export const createWorld = (nav: NavData): World => ({ walkable: nav.walkable, colliders: nav.colliders });

/** Highest walkable top at (x,z) reachable from feet height `fromY` (step up/down limits). null = no ground / edge. */
export function groundHeight(w: World, x: number, z: number, fromY: number, p: PlayerParams): number | null {
  let best: number | null = null;
  for (const s of w.walkable) {
    if (x < s.min[0] - EPS || x > s.max[0] + EPS || z < s.min[2] - EPS || z > s.max[2] + EPS) continue;
    const top = s.max[1];
    if (top > fromY + p.maxStepUp + EPS || top < fromY - p.maxStepDown - EPS) continue;
    if (best === null || top > best) best = top;
  }
  return best;
}
/** True if a body at feet (x,y,z) would intersect a solid collider (circle vs expanded AABB, with vertical overlap). */
export function isBlocked(w: World, x: number, y: number, z: number, p: PlayerParams): boolean {
  for (const c of w.colliders) {
    if (c.max[1] <= y + p.maxStepUp + EPS) continue;       // low enough to step over
    if (c.min[1] >= y + p.bodyHeight - EPS) continue;       // above the head
    const cx = Math.max(c.min[0], Math.min(x, c.max[0])), cz = Math.max(c.min[2], Math.min(z, c.max[2]));
    if ((x - cx) ** 2 + (z - cz) ** 2 < p.radius * p.radius - EPS) return true;
  }
  return false;
}
function tryMove(w: World, s: PlayerState, nx: number, nz: number, p: PlayerParams): boolean {
  if (isBlocked(w, nx, s.y, nz, p)) return false;
  const g = groundHeight(w, nx, nz, s.y, p);
  if (g === null) return false;                              // edge guard: would fall too far / no floor
  if (isBlocked(w, nx, g, nz, p)) return false;              // re-check at the new height (stairs)
  s.x = nx; s.z = nz; s.y = g; return true;
}
/** Move by (dx,dz) with sub-stepping (no tunnelling) and per-axis sliding. Returns a NEW state. */
export function moveWithCollision(w: World, from: PlayerState, dx: number, dz: number, p: PlayerParams): PlayerState {
  const s = { ...from }, dist = Math.hypot(dx, dz);
  if (dist < EPS) return s;
  const n = Math.max(1, Math.ceil(dist / MAX_SUBSTEP)), sx = dx / n, sz = dz / n;
  for (let i = 0; i < n; i++) {
    const movedX = sx !== 0 && tryMove(w, s, s.x + sx, s.z, p);
    const movedZ = sz !== 0 && tryMove(w, s, s.x, s.z + sz, p);
    if (!movedX && !movedZ) break;
  }
  return s;
}
/** Ground height at the spawn point (feet y), so the spawn never floats or sinks. */
export function spawnState(nav: NavData, w: World = createWorld(nav)): PlayerState {
  const [x, , z] = nav.player.spawn.position, p = paramsFromNav(nav);
  const g = groundHeight(w, x, z, nav.player.spawn.position[1], p);
  if (g === null) throw new Error("Spawn point has no ground");
  return { x, y: g, z };
}

export interface MoveInput { forward: boolean; back: boolean; strafeLeft: boolean; strafeRight: boolean; turnLeft: boolean; turnRight: boolean; run: boolean }
export const NO_INPUT: MoveInput = { forward: false, back: false, strafeLeft: false, strafeRight: false, turnLeft: false, turnRight: false, run: false };
export const TURN_RATE = 1.8; // rad/s for arrow-key turning
/** Convert held keys into a displacement and yaw change for one frame. dt is clamped (tab-switch spikes). */
export function computeMove(input: MoveInput, yaw: number, dtRaw: number, walkSpeed: number, runSpeed: number) {
  const dt = Math.min(Math.max(dtRaw, 0), 0.1);
  let f = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
  let r = (input.strafeRight ? 1 : 0) - (input.strafeLeft ? 1 : 0);
  const len = Math.hypot(f, r);
  if (len > 1) { f /= len; r /= len; }                       // normalise diagonals
  const speed = (input.run ? runSpeed : walkSpeed) * dt;
  const dyaw = ((input.turnLeft ? 1 : 0) - (input.turnRight ? 1 : 0)) * TURN_RATE * dt;
  return { dx: (Math.sin(yaw) * f - Math.cos(yaw) * r) * speed, dz: (Math.cos(yaw) * f + Math.sin(yaw) * r) * speed, dyaw };
}
/** Frame-rate independent smoothing of eye height (stairs feel like stairs, not teleports). */
export function smoothEyeY(current: number, target: number, dt: number, rate = 12): number {
  return target + (current - target) * Math.exp(-rate * Math.max(dt, 0));
}
