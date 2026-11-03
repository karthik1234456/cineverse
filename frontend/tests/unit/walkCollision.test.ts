import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createWorld, paramsFromNav, spawnState, moveWithCollision, groundHeight, isBlocked, computeMove, NO_INPUT, smoothEyeY } from "../../lib/walkCollision.ts";

const nav = JSON.parse(readFileSync(new URL("../../public/models/walk_nav_v2.json", import.meta.url), "utf8"));
const world = createWorld(nav), P = paramsFromNav(nav), box = (n: string) => nav.colliders.find((c: any) => c.name === n);
const tier = (r: string) => nav.walkable.find((w: any) => w.name === `tier_platform_${r}`);
const near = (a: number, b: number, tol: number, msg = "") => assert.ok(Math.abs(a - b) <= tol, `${msg} expected ${b} got ${a}`);
/** walk with a fixed dt for `secs` seconds along (fx,fz) unit direction */
function walk(s: any, fx: number, fz: number, secs: number, speed = nav.player.walk_speed_units_per_s, dt = 1 / 60) {
  let maxJump = 0;
  const frames = Math.round(secs / dt); // integer frame count: float time accumulation would add/drop a frame
  for (let f = 0; f < frames; f++) { const n = moveWithCollision(world, s, fx * speed * dt, fz * speed * dt, P); maxJump = Math.max(maxJump, Math.abs(n.y - s.y)); s = n; }
  return { s, maxJump };
}

test("nav data: 10 tiers, 100 seat colliders, spawn has ground and is not blocked", () => {
  assert.equal(nav.walkable.filter((w: any) => w.kind === "tier").length, 10);
  assert.equal(nav.colliders.filter((c: any) => c.kind === "seat").length, 100);
  const s = spawnState(nav); assert.equal(isBlocked(world, s.x, s.y, s.z, P), false);
});
test("walk up the central aisle to row J: eye height follows tiers, no step bigger than max step-up", () => {
  const start = spawnState(nav); // z=-5.5, x=0
  const { s, maxJump } = walk(start, 0, -1, 6.5);   // -> z about -25 attempted; guard must stop us at row J
  near(s.y, tier("J").max[1], 0.02, "feet on tier J top");
  assert.ok(maxJump <= P.maxStepUp + 1e-6, `largest per-frame rise ${maxJump}`);
  assert.ok(s.z > -22.4 && s.z < -20.5, `stopped on/near row J, z=${s.z}`);
  assert.ok(Math.abs(s.x) <= 0.26 + 1e-6, `stayed in the aisle, x=${s.x}`);
});
test("cannot walk off the back of row J (drop of ~2.2 units is blocked)", () => {
  const start = spawnState(nav); const up = walk(start, 0, -1, 6.5).s;
  const after = walk(up, 0, -1, 2).s; near(after.y, tier("J").max[1], 0.02); assert.ok(after.z >= tier("J").min[2] - 1e-6 - 0.0, `z=${after.z}`);
});
test("seats are solid: from the aisle at row E you cannot enter the seat block", () => {
  const eZ = (tier("E").min[2] + tier("E").max[2]) / 2;
  let s = { x: 0, y: tier("E").max[1], z: eZ }; assert.equal(isBlocked(world, s.x, s.y, s.z, P), false);
  for (const dir of [-1, 1]) { const r = walk({ ...s }, dir, 0, 2).s; assert.ok(Math.abs(r.x) <= 0.56 - P.radius + 1e-3, `x=${r.x}`); }
});
test("cannot squeeze between rows (gap < player diameter)", () => {
  // Start in the side aisle, beside row E, and try to go sideways into the block between seats.
  const eZ = (tier("E").min[2] + tier("E").max[2]) / 2, s0 = { x: 7.5, y: tier("E").max[1], z: eZ };
  const r = walk(s0, -1, 0, 3).s; assert.ok(r.x >= 6.64 + P.radius - 1e-3, `x=${r.x} entered seat block`);
});
test("walls stop you (left and right)", () => {
  const s0 = spawnState(nav);
  const right = walk({ ...s0 }, 1, 0, 8).s, left = walk({ ...s0 }, -1, 0, 8).s;
  assert.ok(right.x <= box("right_wall").min[0] - P.radius + 1e-3 || right.x < 10.5, `right x=${right.x}`);
  assert.ok(left.x >= box("left_wall").max[0] + P.radius - 1e-3 || left.x > -10.5, `left x=${left.x}`);
  assert.ok(Math.abs(right.x) < 11 && Math.abs(left.x) < 11);
});
test("stage lip blocks you in front of the screen", () => {
  const lip = box("screen_stage_lip"), s = walk(spawnState(nav), 0, 1, 6).s;
  assert.ok(s.z <= lip.min[2] - P.radius + 1e-3, `z=${s.z} lip.min.z=${lip.min[2]}`);
});
test("cannot step off the side edge of a high tier (edge guard)", () => {
  const j = tier("J"), s0 = { x: 7.5, y: j.max[1], z: (j.min[2] + j.max[2]) / 2 }; // side aisle on row J
  const s = walk(s0, 1, 0, 3).s; assert.ok(s.x <= j.max[0] + 1e-6, `x=${s.x}`); near(s.y, j.max[1], 1e-6);
});
test("no tunnelling: a huge single frame whose landing spot is FREE must still be stopped by the seats in between", () => {
  const eZ = (tier("E").min[2] + tier("E").max[2]) / 2, y = tier("E").max[1];
  // Landing point x=7.6 is in the free side aisle; the straight path from the central aisle crosses the whole seat block.
  assert.equal(isBlocked(world, 7.6, y, eZ, P), false, "landing spot is free (test precondition)");
  assert.notEqual(groundHeight(world, 7.6, eZ, y, P), null, "landing spot has ground (test precondition)");
  const b = moveWithCollision(world, { x: 0, y, z: eZ }, 7.6, 0, P);
  assert.ok(Math.abs(b.x) <= 0.26 + 1e-3, `tunnelled through seats: x=${b.x}`);
  const a = moveWithCollision(world, spawnState(nav), 15, 0, P); assert.ok(a.x < 11, `x=${a.x}`);
});
test("sliding: walking diagonally into a wall keeps the parallel component", () => {
  const wallRight = box("right_wall").min[0];
  const s = { ...spawnState(nav), x: wallRight - P.radius - 0.05 }, r = moveWithCollision(world, s, 1, 1, P);
  assert.ok(r.z > s.z + 0.5, "slid along the wall"); assert.ok(r.x <= wallRight - P.radius + 1e-3);
});
test("frame-rate independence: same distance at 30, 60 and 144 fps", () => {
  const d = (dt: number) => { const a = walk(spawnState(nav), 1, 0, 1, nav.player.walk_speed_units_per_s, dt).s; return a.x; };
  const base = d(1 / 60); near(d(1 / 30), base, base * 0.02, "30fps"); near(d(1 / 144), base, base * 0.02, "144fps");
  near(base, nav.player.walk_speed_units_per_s, 0.1, "~3 units in 1 s");
});
test("computeMove: facing +Z forward is +Z, right is -X; yaw PI faces -Z; diagonals normalised; dt clamped", () => {
  const w = 3, r = 6, i = (o: any) => ({ ...NO_INPUT, ...o });
  let m = computeMove(i({ forward: true }), 0, 1 / 60, w, r); near(m.dz, w / 60, 1e-9); near(m.dx, 0, 1e-9);
  m = computeMove(i({ strafeRight: true }), 0, 1 / 60, w, r); near(m.dx, -w / 60, 1e-9); near(m.dz, 0, 1e-9);
  m = computeMove(i({ forward: true }), Math.PI, 1 / 60, w, r); near(m.dz, -w / 60, 1e-9);
  m = computeMove(i({ forward: true, strafeRight: true }), 0, 1 / 60, w, r); near(Math.hypot(m.dx, m.dz), w / 60, 1e-9);
  m = computeMove(i({ forward: true, run: true }), 0, 1 / 60, w, r); near(m.dz, r / 60, 1e-9);
  m = computeMove(i({ forward: true }), 0, 5, w, r); near(m.dz, w * 0.1, 1e-9, "dt clamped to 0.1 s");
  assert.ok(computeMove(i({ turnLeft: true }), 0, 1 / 60, w, r).dyaw > 0); assert.ok(computeMove(i({ turnRight: true }), 0, 1 / 60, w, r).dyaw < 0);
  assert.equal(computeMove(i({ forward: true, back: true }), 0, 1 / 60, w, r).dz, 0);
});
test("smoothEyeY converges and is frame-rate independent", () => {
  let a = 0, b = 0; for (let i = 0; i < 60; i++) a = smoothEyeY(a, 1, 1 / 60); for (let i = 0; i < 144; i++) b = smoothEyeY(b, 1, 1 / 144);
  near(a, b, 1e-3); assert.ok(a > 0.99);
});
test("groundHeight: floor at spawn, null beyond walls", () => {
  const s = spawnState(nav); near(groundHeight(world, 0, -5.5, s.y, P)!, s.y, 1e-9); assert.equal(groundHeight(world, 50, -5.5, s.y, P), null);
});
