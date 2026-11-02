/**
 * Pure mathematical functions for CineVerse 3D seat metrics, angles, and view analysis.
 * 
 * Coordinate System (glTF Y-up):
 * - Screen center: [0.0, 5.55, -1.255]
 * - Audience sits along -Z (Row A z ≈ -8 ... Row J z ≈ -21.6)
 * - Seats face +Z toward the screen
 * - Facing +Z, viewer's right is -X, viewer's left is +X
 */

export const DEFAULT_UNIT_TO_METERS = 0.43; // 1.28 model units ≈ 0.55m seat width
export const DEFAULT_SCREEN_CENTER: [number, number, number] = [0.0, 5.55, -1.255];
export const DEFAULT_SCREEN_WIDTH = 15.6;
export const DEFAULT_SCREEN_HEIGHT = 7.25;

export interface Vector3Tuple {
  x: number;
  y: number;
  z: number;
}

/**
 * 3D Euclidean distance from eye position to screen center.
 */
export function screenDistance(
  eye: [number, number, number],
  screenCenter: [number, number, number] = DEFAULT_SCREEN_CENTER
): number {
  const dx = screenCenter[0] - eye[0];
  const dy = screenCenter[1] - eye[1];
  const dz = screenCenter[2] - eye[2];
  return Math.hypot(dx, dy, dz);
}

/**
 * Approximate distance in real-world meters.
 */
export function screenDistanceMeters(
  distanceUnits: number,
  unitToMeters: number = DEFAULT_UNIT_TO_METERS
): number {
  return distanceUnits * unitToMeters;
}

/**
 * Horizontal offset angle from screen center to viewer's forward gaze (+Z).
 * Positive (+) = screen center is to the viewer's RIGHT (-X in glTF space).
 * Negative (-) = screen center is to the viewer's LEFT (+X in glTF space).
 */
export function horizontalAngle(
  eye: [number, number, number],
  screenCenter: [number, number, number] = DEFAULT_SCREEN_CENTER
): number {
  const dx = screenCenter[0] - eye[0];
  const dz = screenCenter[2] - eye[2]; // depth along facing axis +Z
  // In glTF right-handed space facing +Z, -X is right.
  const rad = Math.atan2(-dx, dz);
  return (rad * 180) / Math.PI;
}

/**
 * Vertical angle from viewer's horizontal gaze plane to the screen center.
 * Positive (+) = looking upward toward the screen.
 * Negative (-) = looking downward.
 */
export function verticalAngle(
  eye: [number, number, number],
  screenCenter: [number, number, number] = DEFAULT_SCREEN_CENTER
): number {
  const dx = screenCenter[0] - eye[0];
  const dy = screenCenter[1] - eye[1];
  const dz = screenCenter[2] - eye[2];
  const groundDist = Math.hypot(dx, dz);
  const rad = Math.atan2(dy, groundDist);
  return (rad * 180) / Math.PI;
}

/**
 * Horizontal and vertical fields of view (angular span) subtended by the screen
 * from the viewer's eye position.
 */
export function screenFov(
  eye: [number, number, number],
  screenWidth: number = DEFAULT_SCREEN_WIDTH,
  screenHeight: number = DEFAULT_SCREEN_HEIGHT,
  screenCenter: [number, number, number] = DEFAULT_SCREEN_CENTER
): { hFov: number; vFov: number } {
  const depth = screenCenter[2] - eye[2]; // dz along +Z
  const hRad = 2 * Math.atan((screenWidth / 2) / Math.max(0.001, depth));
  const vRad = 2 * Math.atan((screenHeight / 2) / Math.max(0.001, depth));
  return {
    hFov: (hRad * 180) / Math.PI,
    vFov: (vRad * 180) / Math.PI,
  };
}

/**
 * Camera target point when looking at the screen from a seat.
 */
export function cameraTarget(
  screenCenter: [number, number, number] = DEFAULT_SCREEN_CENTER
): [number, number, number] {
  return [screenCenter[0], screenCenter[1], screenCenter[2]];
}

/**
 * Estimate seated adult eye position from bounding box.
 * Height = cushion top + 0.65m seated adult eye height.
 * Forward = 0.45u in front of backrest rear face.
 */
export function eyePosition(
  boundsMin: [number, number, number],
  boundsMax: [number, number, number],
  cushionTopAboveMinUnits: number = 0.8,
  eyeAboveCushionM: number = 0.65,
  unitToM: number = DEFAULT_UNIT_TO_METERS,
  eyeForwardOfBackUnits: number = 0.45
): [number, number, number] {
  const centerX = (boundsMin[0] + boundsMax[0]) / 2;
  const cushionTopY = boundsMin[1] + cushionTopAboveMinUnits;
  const eyeY = cushionTopY + eyeAboveCushionM / unitToM;
  // In glTF Y-up: backrest is at min Z, front is at max Z
  const eyeZ = boundsMin[2] + eyeForwardOfBackUnits;
  return [centerX, eyeY, eyeZ];
}

/**
 * Geometric screen coverage percentage.
 * Based on SMPTE/THX cinema viewing angle recommendations:
 * - 36° to 45° is recommended ideal cinema FOV
 * - Coverage scales from 0 to 100% relative to a standard immersive 90° FOV cone
 * Note: This is pure geometric coverage, NOT physical obstruction.
 */
export function geometricCoverage(hFov: number, vFov: number): number {
  // Weighted geometric solid angle index mapped to a 0-100% scale
  const normalizedH = Math.min(100, Math.max(0, (hFov / 90) * 80));
  const normalizedV = Math.min(100, Math.max(0, (vFov / 50) * 20));
  const total = normalizedH + normalizedV;
  return Math.round(Math.min(100, Math.max(10, total)));
}

/**
 * Format angle to 1 decimal place with proper sign and direction indicator.
 */
export function formatHorizontalAngle(deg: number): string {
  const abs = Math.abs(deg).toFixed(1);
  if (Math.abs(deg) < 0.5) return '0.0° (Centre)';
  return deg > 0 ? `${abs}° Right` : `${abs}° Left`;
}

export function formatVerticalAngle(deg: number): string {
  const abs = Math.abs(deg).toFixed(1);
  if (Math.abs(deg) < 0.5) return '0.0° (Level)';
  return deg > 0 ? `+${abs}° Up` : `-${abs}° Down`;
}

