/**
 * Procedural 3D Auditorium Generator
 * 
 * Generates faithful, photorealistic 3D cinema environments directly from
 * auditorium layout data (rows, seats per row, aisle indices, category bands).
 * 
 * Coordinate System (glTF Y-up, audience facing +Z toward screen):
 * - Screen center: [0.0, Y_screen, -1.255]
 * - Audience sits along -Z (Row A z = -8.032 ... decreasing by row_pitch = 1.5)
 * - Numbering rule: Seat 01 on the audience's left (+X)
 * - Row elevation: tier_rise = 0.22 per row
 */

import {
  screenDistance,
  horizontalAngle,
  verticalAngle,
  screenFov,
  eyePosition,
  DEFAULT_UNIT_TO_METERS,
} from './seatView';
import type {
  SeatRecord,
  SeatLayoutFile,
  WalkNavFile,
  WalkableSurface,
  ColliderAABB,
  BoundingBox3D,
  PlayerConfig,
  SeatCategory,
  CategoryInfo,
} from './types';

export interface AuditoriumLayoutInput {
  rows: string[];
  seats_per_row: number;
  aisles: number[];
  accessible_seats?: string[];
  companion_seats?: string[];
  category_bands?: Array<{
    category: string;
    rows: string[];
    price_multiplier?: number;
  }>;
  screen_type?: string;
  total_seats?: number;
  base_price?: number;
  curve_radius?: number;
  angle_span?: number;
  levels?: {
    stalls?: { label: string; height: number; rows: string[] };
    balcony?: { label: string; height: number; rows: string[] };
  };
  has_balcony?: boolean;
  balcony_rows?: string[];
  recliner_pairs?: Array<[string, string]>;
  motion_rows?: string[];
  features?: {
    motion_seats?: boolean;
    wind?: boolean;
    water?: boolean;
    fog?: boolean;
    scent?: boolean;
    strobe?: boolean;
    ticklers?: boolean;
    is_4dx?: boolean;
    dolby_atmos?: boolean;
  };
}

export interface AcousticPanelDef {
  id: string;
  position: [number, number, number];
  size: [number, number, number];
  rotationY: number;
}

export interface ProceduralGeometryData {
  dimensions: {
    width: number;
    depth: number;
    height: number;
    halfWidth: number;
    zBack: number;
    topTierY: number;
  };
  roomFloor: BoundingBox3D;
  tiers: Array<{
    name: string;
    row: string;
    bounds: BoundingBox3D;
    topY: number;
    level?: 'stalls' | 'balcony';
  }>;
  aisleSteps: Array<{
    name: string;
    bounds: BoundingBox3D;
    topY: number;
  }>;
  walls: {
    front: BoundingBox3D;
    back: BoundingBox3D;
    left: BoundingBox3D;
    right: BoundingBox3D;
  };
  ceiling: BoundingBox3D;
  screenMesh: {
    center: [number, number, number];
    width: number;
    height: number;
    curved: boolean;
    curveRadius?: number;
  };
  screenFrame: BoundingBox3D;
  stageLip: BoundingBox3D;
  proscenium: BoundingBox3D;
  sideCurtains: {
    left: BoundingBox3D;
    right: BoundingBox3D;
  };
  woodenSlats: Array<{
    id: string;
    position: [number, number, number];
    size: [number, number, number];
    rotationY: number;
  }>;
  acousticPanels: AcousticPanelDef[];
  stepLights: Array<{ id: string; position: [number, number, number] }>;
  sconces: Array<{ id: string; position: [number, number, number] }>;
  ceilingDownlights: Array<{ id: string; position: [number, number, number] }>;
  atmosSpeakers: Array<{ id: string; position: [number, number, number]; channel: string }>;
  exitSigns: Array<{ id: string; position: [number, number, number]; label: string }>;
  carpetRunners: Array<{ name: string; bounds: BoundingBox3D }>;
  balconyStructure?: {
    platform: BoundingBox3D;
    fascia: BoundingBox3D;
    railing: BoundingBox3D;
    coveLightBounds: BoundingBox3D;
  };
  cameraBounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  };
  targetBounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  };
  defaultCameraPos: [number, number, number];
  defaultCameraTarget: [number, number, number];
  cameraPresets?: Record<string, { position: [number, number, number]; target: [number, number, number]; caption: string }>;
}

export interface ProceduralAuditoriumResult {
  seatLayout: SeatLayoutFile;
  walkNav: WalkNavFile;
  geometry: ProceduralGeometryData;
}

export const SEAT_PITCH = 1.2;
export const EXTRA_AISLE_GAP = 1.2;
export const ROW_PITCH = 1.5;
export const TIER_RISE = 0.22;
export const ROW_A_Z = -8.032;
export const ROW_A_Y = 1.365;
export const SCREEN_Z = -1.255;

/**
 * Computes exact X coordinates for a row with aisles.
 * Seat 01 is on Audience Left (+X) facing +Z.
 */
export function computeRowXPositions(
  seatsPerRow: number,
  aisles: number[],
  seatPitch: number = SEAT_PITCH,
  extraAisleGap: number = EXTRA_AISLE_GAP
): number[] {
  const xRel: number[] = new Array(seatsPerRow).fill(0);
  for (let i = 1; i < seatsPerRow; i++) {
    const prevSeatNum = i; // 1-based seat number of the previous seat
    const isAisleAfter = aisles.includes(prevSeatNum);
    const step = seatPitch + (isAisleAfter ? extraAisleGap : 0);
    xRel[i] = xRel[i - 1] + step;
  }
  const span = xRel[seatsPerRow - 1];
  const halfSpan = span / 2.0;

  // Seat 01 is at +halfSpan, Seat N is at -halfSpan
  return xRel.map((xr) => Math.round((halfSpan - xr) * 1000) / 1000);
}

/**
 * Procedurally generates the full 3D auditorium from layout data.
 */
export function generateProceduralAuditorium(
  input: AuditoriumLayoutInput
): ProceduralAuditoriumResult {
  const rows = input.rows && input.rows.length > 0 ? input.rows : ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  const seatsPerRow = input.seats_per_row || 10;
  
  // For the standard 100-seat hall, ensure single central aisle if not specified
  let aisles = input.aisles || [];
  if (aisles.length === 0) {
    aisles = [Math.floor(seatsPerRow / 2)];
  }

  const _accessibleSeats = new Set(input.accessible_seats || ['A01', `A${String(seatsPerRow).padStart(2, '0')}`]);
  const basePrice = input.base_price || 280;
  const screenType = input.screen_type || 'IMAX 3D';
  const isFlagship = (input.total_seats || rows.length * seatsPerRow) >= 350;
  const isCurved = screenType.includes('IMAX') || isFlagship;

  // 1. Calculate Row X Coordinates
  const xPositions = computeRowXPositions(seatsPerRow, aisles);
  const maxSeatAbsX = Math.abs(xPositions[0]);

  // 2. Hall Dimensions
  const halfWidth = Math.max(11.11, maxSeatAbsX + 4.2);
  const totalRows = rows.length;
  const zBack = ROW_A_Z - (totalRows - 1) * ROW_PITCH - 4.5;
  const topTierY = totalRows * TIER_RISE;
  const ceilingHeight = Math.max(11.2, topTierY + 8.2);

  // 3. Screen Scaling
  let screenWidth = 15.6;
  let screenHeight = 7.25;
  let screenCenterY = 5.55;

  if (seatsPerRow <= 12 && totalRows <= 8) {
    // Small luxury hall (60-90 seats)
    screenWidth = 13.5;
    screenHeight = 6.28;
    screenCenterY = 5.0;
  } else if (seatsPerRow >= 24 || totalRows >= 14) {
    // Flagship Big Hall (380-450 seats)
    screenWidth = Math.min(27.0, Math.max(18.0, halfWidth * 1.35));
    screenHeight = screenWidth / 2.15;
    screenCenterY = 5.55 + (screenWidth - 15.6) * 0.22;
  } else if (seatsPerRow >= 16) {
    // Large hall (240-320 seats)
    screenWidth = 21.0;
    screenHeight = 9.77;
    screenCenterY = 6.6;
  }

  const screenCenter: [number, number, number] = [0.0, screenCenterY, SCREEN_Z];

  // 4. Generate Category Lookup
  const categoryBands = input.category_bands || [
    { category: 'Front', rows: rows.slice(0, Math.max(2, Math.floor(totalRows * 0.3))), price_multiplier: 0.8 },
    { category: 'Prime', rows: rows.slice(Math.max(2, Math.floor(totalRows * 0.3)), Math.max(4, Math.floor(totalRows * 0.7))), price_multiplier: 1.0 },
    { category: 'Premier', rows: rows.slice(Math.max(4, Math.floor(totalRows * 0.7))), price_multiplier: 1.35 },
  ];

  function getSeatCategory(rowLetter: string): { cat: SeatCategory; mult: number } {
    for (const band of categoryBands) {
      if (band.rows.includes(rowLetter)) {
        const norm = band.category.toLowerCase() as SeatCategory;
        return {
          cat: norm === 'front' || norm === 'premier' ? norm : 'prime',
          mult: band.price_multiplier ?? 1.0,
        };
      }
    }
    return { cat: 'prime', mult: 1.0 };
  }

  // 5. Balcony & Curve configuration
  const hasBalcony = !!(input.has_balcony || (input.balcony_rows && input.balcony_rows.length > 0) || (input.levels?.balcony && input.levels.balcony.rows.length > 0));
  const balconyRowsList: string[] = input.balcony_rows || (input.levels?.balcony?.rows) || (hasBalcony ? rows.slice(Math.max(rows.length - 3, 8)) : []);
  const balconyRowSet = new Set(balconyRowsList);
  const stallsRowsList = rows.filter((r) => !balconyRowSet.has(r));
  const stallsCount = stallsRowsList.length;
  const curveRadius = input.curve_radius;

  // 6. Build Seat Records
  const seatRecords: SeatRecord[] = [];
  const colliders: ColliderAABB[] = [];
  const reclinerPairMap = new Map<string, string>();

  // If explicit recliner pairs passed, index them
  if (input.recliner_pairs) {
    for (const [s1, s2] of input.recliner_pairs) {
      reclinerPairMap.set(s1, s2);
      reclinerPairMap.set(s2, s1);
    }
  }

  // Pre-calculate pairs for premier rows if not explicitly provided
  const premierRows = categoryBands.find((b) => b.category.toLowerCase() === 'premier')?.rows || [];
  if (!input.recliner_pairs) {
    for (const pRow of premierRows) {
      for (let s = 1; s <= seatsPerRow; s += 2) {
        if (s + 1 <= seatsPerRow) {
          const s1 = `${pRow}${String(s).padStart(2, '0')}`;
          const s2 = `${pRow}${String(s + 1).padStart(2, '0')}`;
          // Don't pair if accessible
          if (!_accessibleSeats.has(s1) && !_accessibleSeats.has(s2)) {
            reclinerPairMap.set(s1, s2);
            reclinerPairMap.set(s2, s1);
          }
        }
      }
    }
  }

  const motionRows = new Set(input.motion_rows || (screenType.includes('4DX') || input.features?.is_4dx ? ['D', 'E', 'F', 'G'] : []));

  for (let rIdx = 0; rIdx < rows.length; rIdx++) {
    const row = rows[rIdx];
    const isBalcony = balconyRowSet.has(row);
    let rowY: number;
    let rowZ: number;

    if (isBalcony) {
      const bIdx = balconyRowsList.indexOf(row);
      const balconyElevationJump = 2.4;
      rowY = Math.round((ROW_A_Y + stallsCount * TIER_RISE + balconyElevationJump + bIdx * 0.35) * 1000) / 1000;
      rowZ = Math.round((ROW_A_Z - (stallsCount + bIdx) * ROW_PITCH - 0.5) * 1000) / 1000;
    } else {
      rowY = Math.round((ROW_A_Y + rIdx * TIER_RISE) * 1000) / 1000;
      rowZ = Math.round((ROW_A_Z - rIdx * ROW_PITCH) * 1000) / 1000;
    }

    const { cat, mult } = getSeatCategory(row);
    const price = Math.round(basePrice * mult);

    for (let sIdx = 0; sIdx < seatsPerRow; sIdx++) {
      const num = sIdx + 1;
      const seatId = `${row}${String(num).padStart(2, '0')}`;
      const posX = xPositions[sIdx];
      const posY = rowY;
      const sagZ = curveRadius ? Math.round(((posX * posX) / (2 * curveRadius)) * 1000) / 1000 : 0.0;
      const posZ = Math.round((rowZ + sagZ) * 1000) / 1000;

      const bounds: BoundingBox3D = {
        min: [
          Math.round((posX - 0.64) * 1000) / 1000,
          Math.round((posY - 0.995) * 1000) / 1000,
          Math.round((posZ - 0.492) * 1000) / 1000,
        ],
        max: [
          Math.round((posX + 0.64) * 1000) / 1000,
          Math.round((posY + 0.995) * 1000) / 1000,
          Math.round((posZ + 0.491) * 1000) / 1000,
        ],
      };

      const eye = eyePosition(bounds.min, bounds.max);
      // Round eye coordinates to 3 decimals to match reference GLB precision
      const eyePos: [number, number, number] = [
        Math.round(eye[0] * 1000) / 1000,
        Math.round(eye[1] * 1000) / 1000,
        Math.round(eye[2] * 1000) / 1000,
      ];

      const sDist = screenDistance(eyePos, screenCenter);
      const hAngle = horizontalAngle(eyePos, screenCenter);
      const vAngle = verticalAngle(eyePos, screenCenter);
      const fov = screenFov(eyePos, screenWidth, screenHeight, screenCenter);

      const isAccessible = _accessibleSeats.has(seatId);
      const isCompanion = (input.companion_seats && input.companion_seats.includes(seatId)) ||
        (isAccessible === false && _accessibleSeats.has(`${row}${String(num - 1).padStart(2, '0')}`));
      const pairPartner = reclinerPairMap.get(seatId);
      const seatType = isAccessible ? 'accessible' : (isCompanion ? 'companion' : (pairPartner ? 'recliner_pair' : 'standard'));

      const seatRec: SeatRecord = {
        seat_id: seatId,
        node_name: `seat_${row}_${String(num).padStart(2, '0')}`,
        row,
        number: num,
        category: cat,
        price,
        position_gltf_y_up: [posX, posY, posZ],
        bounds_gltf_y_up: bounds,
        eye_position_gltf_y_up: eyePos,
        screen_distance: Math.round(sDist * 1000) / 1000,
        screen_distance_m_est: Math.round(sDist * DEFAULT_UNIT_TO_METERS * 10) / 10,
        horizontal_offset_deg: Math.round(hAngle * 100) / 100,
        vertical_angle_deg: Math.round(vAngle * 100) / 100,
        screen_h_fov_deg: Math.round(fov.hFov * 10) / 10,
        screen_v_fov_deg: Math.round(fov.vFov * 10) / 10,
        seat_type: seatType,
        pair_partner_id: pairPartner,
        level: isBalcony ? 'balcony' : 'stalls',
        section: isBalcony ? 'Balcony' : 'Stalls',
        in_motion_zone: motionRows.has(row),
      };

      seatRecords.push(seatRec);

      // Seat obstacle collider for Walk Mode
      colliders.push({
        name: `seat_${seatId}_collider`,
        type: 'seat',
        bounds,
      });
    }
  }

  // 6. Walkable Surfaces (Floor + Tiers + Aisle Treads)
  const walkableSurfaces: WalkableSurface[] = [];

  // Main room floor
  walkableSurfaces.push({
    name: 'room_floor',
    type: 'floor',
    bounds: {
      min: [-halfWidth, -0.575, zBack],
      max: [halfWidth, -0.025, 0.0],
    },
    top_y: -0.025,
  });

  // Tier platforms
  const tierGeometries: Array<{ name: string; row: string; bounds: BoundingBox3D; topY: number; level?: 'stalls' | 'balcony' }> = [];
  for (let rIdx = 0; rIdx < rows.length; rIdx++) {
    const row = rows[rIdx];
    const isBalcony = balconyRowSet.has(row);
    let rowZ = ROW_A_Z - rIdx * ROW_PITCH;
    let tierTopY: number;
    let tierBottomY: number;

    if (isBalcony) {
      const bIdx = balconyRowsList.indexOf(row);
      const balconyElevationJump = 2.4;
      tierTopY = Math.round((ROW_A_Y + stallsCount * TIER_RISE + balconyElevationJump + (bIdx + 1) * 0.35) * 1000) / 1000;
      tierBottomY = Math.round((ROW_A_Y + stallsCount * TIER_RISE + balconyElevationJump + bIdx * 0.35) * 1000) / 1000;
      rowZ = ROW_A_Z - (stallsCount + bIdx) * ROW_PITCH - 0.5;
    } else {
      tierTopY = Math.round((rIdx + 1) * TIER_RISE * 1000) / 1000;
      tierBottomY = Math.round(rIdx * TIER_RISE * 1000) / 1000;
    }

    const tierBounds: BoundingBox3D = {
      min: [-halfWidth + 2.0, tierBottomY, Math.round((rowZ - 0.818) * 1000) / 1000],
      max: [halfWidth - 2.0, tierTopY, Math.round((rowZ + 0.682) * 1000) / 1000],
    };

    const tierObj = {
      name: `tier_platform_${row}`,
      row,
      bounds: tierBounds,
      topY: tierTopY,
      level: isBalcony ? ('balcony' as const) : ('stalls' as const),
    };

    tierGeometries.push(tierObj);
    walkableSurfaces.push({
      name: `tier_platform_${row}`,
      type: 'tier',
      row,
      bounds: tierBounds,
      top_y: tierTopY,
    });
  }

  // Aisle stairs and treads
  const aisleSteps: Array<{ name: string; bounds: BoundingBox3D; topY: number }> = [];
  const aisleCenters: number[] = [];

  for (const aIdx of aisles) {
    if (aIdx >= 1 && aIdx < seatsPerRow) {
      const leftSeatX = xPositions[aIdx - 1];
      const rightSeatX = xPositions[aIdx];
      const aisleCenterX = (leftSeatX + rightSeatX) / 2.0;
      aisleCenters.push(aisleCenterX);

      for (let rIdx = 0; rIdx < rows.length; rIdx++) {
        const row = rows[rIdx];
        const isBalcony = balconyRowSet.has(row);
        let rowZ = ROW_A_Z - rIdx * ROW_PITCH;
        let treadY: number;

        if (isBalcony) {
          const bIdx = balconyRowsList.indexOf(row);
          const balconyElevationJump = 2.4;
          treadY = Math.round((ROW_A_Y + stallsCount * TIER_RISE + balconyElevationJump + (bIdx + 1) * 0.35) * 1000) / 1000;
          rowZ = ROW_A_Z - (stallsCount + bIdx) * ROW_PITCH - 0.5;
        } else {
          treadY = Math.round((rIdx + 1) * TIER_RISE * 1000) / 1000;
        }

        const stepBounds: BoundingBox3D = {
          min: [
            Math.round((aisleCenterX - 0.6) * 1000) / 1000,
            treadY - 0.05,
            Math.round((rowZ - 0.75) * 1000) / 1000,
          ],
          max: [
            Math.round((aisleCenterX + 0.6) * 1000) / 1000,
            treadY,
            Math.round((rowZ + 0.75) * 1000) / 1000,
          ],
        };

        const stepObj = {
          name: `aisle_tread_${aIdx}_${row}`,
          bounds: stepBounds,
          topY: treadY,
        };

        aisleSteps.push(stepObj);
        walkableSurfaces.push({
          name: `aisle_tread_${aIdx}_${row}`,
          type: 'tread',
          bounds: stepBounds,
          top_y: treadY,
        });
      }
    }
  }

  // 7. Wall Colliders & Enclosure
  const walls = {
    front: {
      min: [-halfWidth, 0.0, -0.31] as [number, number, number],
      max: [halfWidth, ceilingHeight, 0.11] as [number, number, number],
    },
    back: {
      min: [-halfWidth, 0.0, zBack - 0.2] as [number, number, number],
      max: [halfWidth, ceilingHeight, zBack + 0.31] as [number, number, number],
    },
    left: {
      min: [halfWidth - 0.3, 0.0, zBack] as [number, number, number],
      max: [halfWidth + 0.3, ceilingHeight, 0.0] as [number, number, number],
    },
    right: {
      min: [-halfWidth - 0.3, 0.0, zBack] as [number, number, number],
      max: [-halfWidth + 0.3, ceilingHeight, 0.0] as [number, number, number],
    },
  };

  colliders.push({ name: 'front_wall', type: 'wall', bounds: walls.front });
  colliders.push({ name: 'back_wall', type: 'wall', bounds: walls.back });
  colliders.push({ name: 'left_wall', type: 'wall', bounds: walls.left });
  colliders.push({ name: 'right_wall', type: 'wall', bounds: walls.right });

  // Screen Structure Collider
  const screenStructure: ColliderAABB = {
    name: 'screen_structure',
    type: 'screen_structure',
    bounds: {
      min: [-screenWidth / 2 - 0.6, 0.0, SCREEN_Z - 0.6],
      max: [screenWidth / 2 + 0.6, screenCenterY + screenHeight / 2 + 0.6, SCREEN_Z + 0.5],
    },
  };
  colliders.push(screenStructure);

  // Stage Lip Collider
  const stageLip: BoundingBox3D = {
    min: [-screenWidth / 2 - 1.5, 0.0, -4.5],
    max: [screenWidth / 2 + 1.5, 0.85, SCREEN_Z - 0.1],
  };
  colliders.push({ name: 'stage_lip', type: 'screen_structure', bounds: stageLip });

  // 8. Architectural Features (Wood Slats, Curtains, Proscenium, Exit Signs, Runners)
  const acousticPanels: AcousticPanelDef[] = [];
  const sconces: Array<{ id: string; position: [number, number, number] }> = [];
  const stepLights: Array<{ id: string; position: [number, number, number] }> = [];
  const woodenSlats: Array<{ id: string; position: [number, number, number]; size: [number, number, number]; rotationY: number }> = [];

  const panelCount = Math.max(5, Math.floor(Math.abs(zBack) / 2.8));
  const zStep = (Math.abs(zBack) - 3.0) / panelCount;

  for (let pIdx = 0; pIdx < panelCount; pIdx++) {
    const pZ = Math.round((-2.5 - pIdx * zStep) * 1000) / 1000;

    // Left wall panel (+X)
    acousticPanels.push({
      id: `panel_left_${pIdx}`,
      position: [halfWidth - 0.06, 5.0, pZ],
      size: [0.12, 4.5, 1.8],
      rotationY: 0,
    });
    sconces.push({
      id: `sconce_left_${pIdx}`,
      position: [halfWidth - 0.22, 5.2, pZ],
    });

    // Right wall panel (-X)
    acousticPanels.push({
      id: `panel_right_${pIdx}`,
      position: [-halfWidth + 0.06, 5.0, pZ],
      size: [0.12, 4.5, 1.8],
      rotationY: 0,
    });
    sconces.push({
      id: `sconce_right_${pIdx}`,
      position: [-halfWidth + 0.22, 5.2, pZ],
    });
  }

  // Wooden vertical slats spaced on side walls
  const slatSpacing = 0.55;
  const slatCount = Math.floor((Math.abs(zBack) - 4.0) / slatSpacing);
  for (let i = 0; i < slatCount; i++) {
    const sZ = Math.round((-2.2 - i * slatSpacing) * 1000) / 1000;
    // Left side wall
    woodenSlats.push({
      id: `slat_left_${i}`,
      position: [halfWidth - 0.08, 4.2, sZ],
      size: [0.06, 6.2, 0.12],
      rotationY: 0,
    });
    // Right side wall
    woodenSlats.push({
      id: `slat_right_${i}`,
      position: [-halfWidth + 0.08, 4.2, sZ],
      size: [0.06, 6.2, 0.12],
      rotationY: 0,
    });
  }

  // Step illumination accents on each aisle
  for (const acX of aisleCenters) {
    for (let rIdx = 0; rIdx < rows.length; rIdx++) {
      const rowZ = ROW_A_Z - rIdx * ROW_PITCH;
      const stepY = (rIdx + 1) * TIER_RISE;
      stepLights.push({
        id: `steplight_${acX.toFixed(1)}_${rIdx}`,
        position: [acX - 0.55, stepY + 0.02, rowZ],
      });
      stepLights.push({
        id: `steplight_${acX.toFixed(1)}_${rIdx}_r`,
        position: [acX + 0.55, stepY + 0.02, rowZ],
      });
    }
  }

  // Ceiling downlights along aisles
  const ceilingDownlights: Array<{ id: string; position: [number, number, number] }> = [];
  for (const acX of aisleCenters) {
    for (let z = -4.0; z >= zBack + 1.0; z -= 3.2) {
      ceilingDownlights.push({
        id: `downlight_${acX.toFixed(1)}_${Math.abs(z).toFixed(0)}`,
        position: [acX, ceilingHeight - 0.2, z],
      });
    }
  }

  // Dolby Atmos overhead & surround speaker coordinates
  const atmosSpeakers: Array<{ id: string; position: [number, number, number]; channel: string }> = [
    // Overhead rows (6 speakers)
    { id: 'atmos_top_l1', position: [-halfWidth * 0.45, ceilingHeight - 0.4, -6.5], channel: 'top_left_front' },
    { id: 'atmos_top_r1', position: [halfWidth * 0.45, ceilingHeight - 0.4, -6.5], channel: 'top_right_front' },
    { id: 'atmos_top_l2', position: [-halfWidth * 0.45, ceilingHeight - 0.4, -13.0], channel: 'top_left_middle' },
    { id: 'atmos_top_r2', position: [halfWidth * 0.45, ceilingHeight - 0.4, -13.0], channel: 'top_right_middle' },
    { id: 'atmos_top_l3', position: [-halfWidth * 0.45, ceilingHeight - 0.4, zBack + 3.0], channel: 'top_left_rear' },
    { id: 'atmos_top_r3', position: [halfWidth * 0.45, ceilingHeight - 0.4, zBack + 3.0], channel: 'top_right_rear' },
    // Side surround (6 speakers)
    { id: 'atmos_surr_l1', position: [halfWidth - 0.25, 6.2, -7.0], channel: 'surround_left_front' },
    { id: 'atmos_surr_r1', position: [-halfWidth + 0.25, 6.2, -7.0], channel: 'surround_right_front' },
    { id: 'atmos_surr_l2', position: [halfWidth - 0.25, 6.6, -14.0], channel: 'surround_left_middle' },
    { id: 'atmos_surr_r2', position: [-halfWidth + 0.25, 6.6, -14.0], channel: 'surround_right_middle' },
    { id: 'atmos_surr_l3', position: [halfWidth - 0.25, 7.0, zBack + 3.0], channel: 'surround_left_rear' },
    { id: 'atmos_surr_r3', position: [-halfWidth + 0.25, 7.0, zBack + 3.0], channel: 'surround_right_rear' },
  ];

  // Side curtains flanking the screen
  const sideCurtains = {
    left: {
      min: [screenWidth / 2 + 0.1, 0.0, SCREEN_Z - 0.25] as [number, number, number],
      max: [halfWidth - 0.5, screenCenterY + screenHeight / 2 + 1.2, SCREEN_Z + 0.35] as [number, number, number],
    },
    right: {
      min: [-halfWidth + 0.5, 0.0, SCREEN_Z - 0.25] as [number, number, number],
      max: [-screenWidth / 2 - 0.1, screenCenterY + screenHeight / 2 + 1.2, SCREEN_Z + 0.35] as [number, number, number],
    },
  };

  // Subtle proscenium arch around screen
  const proscenium: BoundingBox3D = {
    min: [-screenWidth / 2 - 0.8, 0.0, SCREEN_Z - 0.22],
    max: [screenWidth / 2 + 0.8, screenCenterY + screenHeight / 2 + 0.85, SCREEN_Z - 0.04],
  };

  // Illuminated EXIT signs
  const exitSigns: Array<{ id: string; position: [number, number, number]; label: string }> = [
    { id: 'exit_front_left', position: [halfWidth - 1.2, 4.0, SCREEN_Z + 1.6], label: 'EXIT' },
    { id: 'exit_rear_right', position: [-halfWidth + 1.2, topTierY + 3.5, zBack + 1.4], label: 'EXIT' },
  ];

  // Carpet runners along aisles
  const carpetRunners: Array<{ name: string; bounds: BoundingBox3D }> = aisleCenters.map((acX, idx) => ({
    name: `carpet_runner_${idx}`,
    bounds: {
      min: [acX - 0.5, -0.02, zBack + 0.5],
      max: [acX + 0.5, topTierY + 0.02, -5.0],
    },
  }));

  // Balcony cantilevered structure if hall has balcony
  let balconyStructure: ProceduralGeometryData['balconyStructure'];
  if (hasBalcony && balconyRowsList.length > 0) {
    const balconyFrontZ = ROW_A_Z - stallsCount * ROW_PITCH - 0.2;
    const bBaseY = ROW_A_Y + stallsCount * TIER_RISE + 2.4;
    balconyStructure = {
      platform: {
        min: [-halfWidth + 1.2, bBaseY - 0.65, zBack],
        max: [halfWidth - 1.2, bBaseY, balconyFrontZ + 1.4],
      },
      fascia: {
        min: [-halfWidth + 1.2, bBaseY - 0.65, balconyFrontZ + 1.3],
        max: [halfWidth - 1.2, bBaseY + 0.05, balconyFrontZ + 1.45],
      },
      railing: {
        min: [-halfWidth + 1.2, bBaseY, balconyFrontZ + 1.38],
        max: [halfWidth - 1.2, bBaseY + 0.88, balconyFrontZ + 1.45],
      },
      coveLightBounds: {
        min: [-halfWidth + 1.4, bBaseY - 0.72, balconyFrontZ + 1.25],
        max: [halfWidth - 1.4, bBaseY - 0.62, balconyFrontZ + 1.35],
      },
    };
  }

  // 9. Camera Boundaries and Safe Limits
  const cameraBounds = {
    minX: -halfWidth + 1.8,
    maxX: halfWidth - 1.8,
    minY: 1.1,
    maxY: ceilingHeight - 1.4,
    minZ: zBack + 1.8,
    maxZ: -2.2,
  };

  const targetBounds = {
    minX: -maxSeatAbsX * 0.8,
    maxX: maxSeatAbsX * 0.8,
    minY: 1.5,
    maxY: Math.min(8.0, ceilingHeight - 3.0),
    minZ: ROW_A_Z - (totalRows - 1) * ROW_PITCH + 2.0,
    maxZ: -3.0,
  };

  const defaultCameraPos: [number, number, number] = [
    0.0,
    Math.min(9.5, topTierY + 6.2),
    zBack + 3.8,
  ];
  const defaultCameraTarget: [number, number, number] = [
    0.0,
    screenCenterY * 0.68,
    -8.0,
  ];

  // Camera Presets (§ Product Polish)
  const cameraPresets: Record<string, { position: [number, number, number]; target: [number, number, number]; caption: string }> = {
    overview: {
      position: defaultCameraPos,
      target: defaultCameraTarget,
      caption: 'Auditorium Overview',
    },
    front: {
      position: [0.0, 3.2, -6.8],
      target: [0.0, screenCenterY, SCREEN_Z],
      caption: 'Front Stalls View',
    },
    back: {
      position: [0.0, Math.min(topTierY + 4.2, ceilingHeight - 1.8), zBack + 1.5],
      target: [0.0, screenCenterY, SCREEN_Z],
      caption: 'Premier Centre View',
    },
    balcony: {
      position: [0.0, hasBalcony ? topTierY + 4.8 : topTierY + 3.5, zBack + 1.2],
      target: [0.0, screenCenterY * 0.9, SCREEN_Z],
      caption: 'Balcony Tier View',
    },
    screen: {
      position: [0.0, 2.5, SCREEN_Z + 1.8],
      target: [0.0, topTierY * 0.5 + 2.0, (ROW_A_Z + zBack) / 2],
      caption: 'Near Screen Facing Seating',
    },
    top: {
      position: [0.0, ceilingHeight - 1.4, (ROW_A_Z + zBack) / 2],
      target: [0.0, 1.0, (ROW_A_Z + zBack) / 2],
      caption: 'Top-down Plan View',
    },
    picker: {
      position: [0.0, 6.8, -14.5],
      target: [0.0, 2.5, -11.5],
      caption: 'Seat Picker View',
    },
  };

  // 10. Assemble Output Data Structures
  const categoriesRecord: Record<SeatCategory, CategoryInfo> = {
    front: { label: 'Front', rows: 'A-C', price: Math.round(basePrice * 0.8), color: '#7c2d12' },
    prime: { label: 'Prime', rows: 'D-G', price: basePrice, color: '#881337' },
    premier: { label: 'Premier', rows: 'H-J', price: Math.round(basePrice * 1.35), color: '#9f1239' },
  };

  const seatLayout: SeatLayoutFile = {
    version: 2,
    generated_from: `procedural_generator_${input.screen_type || 'default'}`,
    coordinate_system: 'glTF Y-up (+Y up, +X audience left, -X audience right, +Z screenward)',
    units: {
      scene_unit: 'procedural model unit',
      unit_to_meters_estimate: DEFAULT_UNIT_TO_METERS,
      note: '1.28 model units ≈ 0.55m seat width',
    },
    auditorium: {
      bounds_min: [-halfWidth, -0.57, zBack],
      note: `Procedural ${input.screen_type || 'Cinema'} Hall with ${seatRecords.length} seats`,
    },
    screen: {
      center_gltf_y_up: screenCenter,
      width: screenWidth,
      height: screenHeight,
      aspect: Math.round((screenWidth / screenHeight) * 1000) / 1000,
      mesh: 'cinema_screen_surface',
    },
    eye_model: {
      cushion_top_above_seat_min_units: 0.8,
      eye_above_cushion_m: 0.65,
      eye_forward_of_backrest_units: 0.45,
      disclaimer: 'Viewing angles and sightlines are geometric estimates based on SMPTE standards. Procedural halls are idealized acoustic and architectural models and not physical laser scans.',
    },
    categories: categoriesRecord,
    levels: {
      stalls: { label: 'Stalls', height: 0.0, rows: stallsRowsList },
      ...(hasBalcony ? { balcony: { label: 'Balcony', height: 2.4, rows: balconyRowsList } } : {}),
    },
    has_balcony: hasBalcony,
    features: {
      is_4dx: screenType.includes('4DX') || !!input.features?.is_4dx,
      motion_seats: screenType.includes('4DX') || !!input.features?.motion_seats || !!input.features?.is_4dx,
      wind: screenType.includes('4DX') || !!input.features?.wind || !!input.features?.is_4dx,
      water: screenType.includes('4DX') || !!input.features?.water || !!input.features?.is_4dx,
      fog: screenType.includes('4DX') || !!input.features?.fog || !!input.features?.is_4dx,
      scent: screenType.includes('4DX') || !!input.features?.scent || !!input.features?.is_4dx,
      strobe: screenType.includes('4DX') || !!input.features?.strobe || !!input.features?.is_4dx,
      ticklers: screenType.includes('4DX') || !!input.features?.ticklers || !!input.features?.is_4dx,
      dolby_atmos: screenType.includes('Atmos') || screenType.includes('4DX') || !!input.features?.dolby_atmos,
    },
    seats: seatRecords,
  };

  const primaryAisleX = aisleCenters.length > 0 ? aisleCenters[0] : 0.0;
  const playerConfig: PlayerConfig = {
    radius: 0.3,
    standing_eye_height: 3.77,
    crouch_eye_height: 2.5,
    seated_eye_height: 1.9,
    max_step_up: 0.3,
    max_step_down: 0.4,
    walk_speed: 3.0,
    run_speed: 6.0,
    spawn_position: [primaryAisleX, 0.22, -6.5],
    spawn_yaw: 0.0, // Facing +Z screenward
    fov: 70.0,
  };

  const walkNav: WalkNavFile = {
    version: 2,
    generated_from: 'procedural_generator',
    coordinate_system: 'glTF Y-up',
    units: {
      scene_unit: 'procedural model unit',
      unit_to_meters_estimate: DEFAULT_UNIT_TO_METERS,
    },
    player: playerConfig,
    aisles: {
      central: {
        x_min: primaryAisleX - 0.6,
        x_max: primaryAisleX + 0.6,
        width: 1.2,
      },
      side_left: { x_min: halfWidth - 3.8, x_max: halfWidth - 0.5 },
      side_right: { x_min: -halfWidth + 0.5, x_max: -halfWidth + 3.8 },
    },
    walkable_count: walkableSurfaces.length,
    collider_count: colliders.length,
    walkable: walkableSurfaces,
    colliders,
  };

  const geometry: ProceduralGeometryData = {
    dimensions: {
      width: halfWidth * 2,
      depth: Math.abs(zBack),
      height: ceilingHeight,
      halfWidth,
      zBack,
      topTierY,
    },
    roomFloor: walkableSurfaces[0].bounds,
    tiers: tierGeometries,
    aisleSteps,
    walls,
    ceiling: {
      min: [-halfWidth, ceilingHeight - 0.3, zBack],
      max: [halfWidth, ceilingHeight + 0.3, 0.0],
    },
    screenMesh: {
      center: screenCenter,
      width: screenWidth,
      height: screenHeight,
      curved: isCurved,
      curveRadius: isCurved ? screenWidth * 1.8 : undefined,
    },
    screenFrame: {
      min: [-screenWidth / 2 - 0.4, screenCenterY - screenHeight / 2 - 0.4, SCREEN_Z - 0.08],
      max: [screenWidth / 2 + 0.4, screenCenterY + screenHeight / 2 + 0.4, SCREEN_Z - 0.01],
    },
    stageLip,
    proscenium,
    sideCurtains,
    woodenSlats,
    acousticPanels,
    stepLights,
    sconces,
    ceilingDownlights,
    atmosSpeakers,
    exitSigns,
    carpetRunners,
    balconyStructure,
    cameraBounds,
    targetBounds,
    defaultCameraPos,
    defaultCameraTarget,
    cameraPresets,
  };

  return {
    seatLayout,
    walkNav,
    geometry,
  };
}

