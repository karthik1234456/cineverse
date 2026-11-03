/**
 * Seat view maths. Pure TypeScript, no dependencies.
 * World = glTF Y-up. Screen at z~-1.25, audience at more negative Z, seats FACE +Z.
 * Facing +Z the viewer's right is -X. All angles in degrees unless noted.
 * Everything here is a GEOMETRIC ESTIMATE (see eye_model in seat_layout_v2.json), not a
 * measurement of a physical cinema, and no obstruction is modelled.
 */
export type Vec3 = [number, number, number];
export interface ScreenInfo { center_gltf_y_up: Vec3; width: number; height: number }
export interface SeatRecord {
  seat_id: string; node_name: string; row: string; number: number; category: string; price: number;
  position_gltf_y_up: Vec3; eye_position_gltf_y_up: Vec3;
  screen_distance: number; horizontal_offset_deg: number; vertical_angle_deg: number;
  screen_h_fov_deg: number; screen_v_fov_deg: number;
}
const DEG = 180 / Math.PI;

export function screenDistance(eye: Vec3, screenCenter: Vec3): number {
  return Math.hypot(screenCenter[0] - eye[0], screenCenter[1] - eye[1], screenCenter[2] - eye[2]);
}
/** + = screen centre is to the viewer's RIGHT of straight ahead (viewer faces +Z, right = -X). */
export function horizontalOffsetDeg(eye: Vec3, screenCenter: Vec3): number {
  const dx = screenCenter[0] - eye[0], dz = screenCenter[2] - eye[2];
  return Math.atan2(-dx, dz) * DEG;
}
/** + = looking UP to the screen centre. */
export function verticalAngleDeg(eye: Vec3, screenCenter: Vec3): number {
  const dx = screenCenter[0] - eye[0], dy = screenCenter[1] - eye[1], dz = screenCenter[2] - eye[2];
  return Math.atan2(dy, Math.hypot(dx, dz)) * DEG;
}
/** Angle the screen subtends, using depth along the facing direction (+Z). */
export function screenFovDeg(eye: Vec3, screen: ScreenInfo): { h: number; v: number } {
  const dz = screen.center_gltf_y_up[2] - eye[2];
  if (dz <= 0) throw new Error("Eye is not in front of the screen (expected eye.z < screen.z)");
  return { h: 2 * Math.atan(screen.width / 2 / dz) * DEG, v: 2 * Math.atan(screen.height / 2 / dz) * DEG };
}
export const cameraTarget = (screen: ScreenInfo): Vec3 => [...screen.center_gltf_y_up] as Vec3;
export const eyePosition = (seat: Pick<SeatRecord, "eye_position_gltf_y_up">): Vec3 => [...seat.eye_position_gltf_y_up] as Vec3;

/** yaw/pitch (radians) to look from `from` toward `to`. yaw 0 faces +Z; increasing yaw turns LEFT. */
export function yawPitchToward(from: Vec3, to: Vec3): { yaw: number; pitch: number } {
  const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2];
  return { yaw: Math.atan2(dx, dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
}
/**
 * three.js cameras look down -Z by default. To face direction (sin yaw, 0, cos yaw) set
 * camera.rotation.y = yaw + PI (Euler order YXZ). This is the "+Z facing" trap in one line.
 */
export const threeCameraRotationY = (yaw: number): number => yaw + Math.PI;

/**
 * Fraction (0..1) of the screen's angular size that fits inside a camera of the given FOV when looking
 * at the screen centre. GEOMETRIC ONLY: says nothing about heads, rails or other obstructions.
 */
export function geometricCoverage(screenFov: { h: number; v: number }, cameraHFovDeg: number, cameraVFovDeg: number): number {
  return Math.min(1, cameraHFovDeg / screenFov.h) * Math.min(1, cameraVFovDeg / screenFov.v);
}
/** Vertical FOV -> horizontal FOV for a given aspect ratio (width/height). */
export function horizontalFovFromVertical(vFovDeg: number, aspect: number): number {
  return 2 * Math.atan(Math.tan((vFovDeg / DEG) / 2) * aspect) * DEG;
}
/** Recompute all derived metrics for a seat from its eye position (used to cross-check the JSON). */
export function computeSeatMetrics(seat: Pick<SeatRecord, "eye_position_gltf_y_up">, screen: ScreenInfo) {
  const eye = seat.eye_position_gltf_y_up, c = screen.center_gltf_y_up, fov = screenFovDeg(eye, screen);
  return { distance: screenDistance(eye, c), horizontal: horizontalOffsetDeg(eye, c), vertical: verticalAngleDeg(eye, c), hFov: fov.h, vFov: fov.v };
}
