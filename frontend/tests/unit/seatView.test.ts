import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { computeSeatMetrics, screenFovDeg, yawPitchToward, threeCameraRotationY, geometricCoverage, horizontalFovFromVertical } from "../../lib/seatView.ts";
import { buildSeatMapLayout } from "../../lib/seatMapLayout.ts";

const layout = JSON.parse(readFileSync(new URL("../../public/models/seat_layout_v2.json", import.meta.url), "utf8"));
const seats: any[] = layout.seats, byId = Object.fromEntries(seats.map((s) => [s.seat_id, s]));
const near = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} expected ${b} got ${a}`);

test("100 unique seats, ids and node names", () => {
  assert.equal(seats.length, 100);
  assert.equal(new Set(seats.map((s) => s.seat_id)).size, 100);
  assert.equal(new Set(seats.map((s) => s.node_name)).size, 100);
});
test("mirrored numbering: seat_id number = 11 - node number; A05 <-> seat_A_06", () => {
  for (const s of seats) assert.equal(s.number, 11 - Number(s.node_name.split("_")[2]));
  assert.equal(byId.A05.node_name, "seat_A_06"); assert.equal(byId.J10.node_name, "seat_J_01");
});
test("seat numbers increase left to right from the audience view (+X is audience-left)", () => {
  for (const r of "ABCDEFGHIJ") {
    const xs = Array.from({ length: 10 }, (_, i) => byId[`${r}${String(i + 1).padStart(2, "0")}`].position_gltf_y_up[0]);
    for (let i = 1; i < 10; i++) assert.ok(xs[i] < xs[i - 1], `row ${r}`);
  }
});
test("recomputed metrics match the JSON for all 100 seats", () => {
  for (const s of seats) {
    const m = computeSeatMetrics(s, layout.screen);
    near(m.distance, s.screen_distance, 0.01, s.seat_id); near(m.horizontal, s.horizontal_offset_deg, 0.05, s.seat_id);
    near(m.vertical, s.vertical_angle_deg, 0.05, s.seat_id); near(m.hFov, s.screen_h_fov_deg, 0.1, s.seat_id); near(m.vFov, s.screen_v_fov_deg, 0.1, s.seat_id);
  }
});
test("fixtures: row A/E/J horizontal FOV and distances", () => {
  near(byId.A05.screen_h_fov_deg, 97.7, 0.2); near(byId.E05.screen_h_fov_deg, 62.6, 0.2); near(byId.J05.screen_h_fov_deg, 42.0, 0.2);
  near(byId.A05.screen_distance, 7.494, 0.01); near(byId.J05.screen_distance, 20.4, 0.1);
});
test("sign convention: seat on audience-left sees the screen to the RIGHT (+), and vice versa", () => {
  assert.ok(byId.A01.horizontal_offset_deg > 0 && byId.A10.horizontal_offset_deg < 0);
  assert.ok(byId.A01.vertical_angle_deg > 0, "screen centre is above row A eye level");
});
test("all eyes are in front of the screen and inside the room", () => {
  for (const s of seats) { const e = s.eye_position_gltf_y_up; assert.ok(e[2] < layout.screen.center_gltf_y_up[2]); assert.ok(Math.abs(e[0]) < 11 && e[1] > 0 && e[1] < 11); }
});
test("screenFovDeg throws when the eye is behind the screen plane", () => {
  assert.throws(() => screenFovDeg([0, 3, 5], layout.screen));
});
test("yaw/pitch toward screen: yaw is the negative of horizontal offset; three camera faces the screen", () => {
  for (const id of ["A01", "E05", "J10"]) {
    const s = byId[id], { yaw, pitch } = yawPitchToward(s.eye_position_gltf_y_up, layout.screen.center_gltf_y_up);
    near((yaw * 180) / Math.PI, -s.horizontal_offset_deg, 0.05, id); near((pitch * 180) / Math.PI, s.vertical_angle_deg, 0.05, id);
    const ry = threeCameraRotationY(yaw), fwd = [-Math.sin(ry), -Math.cos(ry)]; // three: camera looks down local -Z
    const d = [layout.screen.center_gltf_y_up[0] - s.eye_position_gltf_y_up[0], layout.screen.center_gltf_y_up[2] - s.eye_position_gltf_y_up[2]], dl = Math.hypot(d[0], d[1]);
    assert.ok(fwd[0] * (d[0] / dl) + fwd[1] * (d[1] / dl) > 0.9999, `${id} camera forward points at screen`);
  }
});
test("coverage is geometric and capped at 1; fov conversion sane", () => {
  const f = screenFovDeg(byId.J05.eye_position_gltf_y_up, layout.screen);
  assert.equal(geometricCoverage(f, 120, 90), 1); assert.ok(geometricCoverage(f, 20, 10) < 0.3);
  near(horizontalFovFromVertical(60, 16 / 9), 91.5, 0.2);
});
test("2D seat map layout built from the same data", () => {
  const m = buildSeatMapLayout(seats);
  assert.deepEqual(m.rows.map((r) => r.row), [..."ABCDEFGHIJ"]);          // A (front/top) .. J (back/bottom)
  assert.equal(m.cols, 10); assert.deepEqual(m.aisleAfterCols, [4]);       // aisle between seat 05 and 06
  for (const r of m.rows) { assert.deepEqual(r.seats.map((s) => s.number), [1,2,3,4,5,6,7,8,9,10]); assert.deepEqual(r.seats.map((s) => s.col), [0,1,2,3,4,5,6,7,8,9]); }
  assert.deepEqual(m.categoryBands, [{ category: "front", rows: [..."ABC"] }, { category: "prime", rows: [..."DEFG"] }, { category: "premier", rows: [..."HIJ"] }]);
});
