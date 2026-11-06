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
  category_bands?: Array<{
    category: string;
    rows: string[];
    price_multiplier?: number;
  }>;
  screen_type?: string;
  total_seats?: number;
  base_price?: number;
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
  acousticPanels: AcousticPanelDef[];
  stepLights: Array<{ id: string; position: [number, number, number] }>;
  sconces: Array<{ id: string; position: [number, number, number] }>;
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

  // 5. Build Seat Records
  const seatRecords: SeatRecord[] = [];
  const colliders: ColliderAABB[] = [];

  for (let rIdx = 0; rIdx < rows.length; rIdx++) {
    const row = rows[rIdx];
    const rowY = Math.round((ROW_A_Y + rIdx * TIER_RISE) * 1000) / 1000;
    const rowZ = Math.round((ROW_A_Z - rIdx * ROW_PITCH) * 1000) / 1000;
    const { cat, mult } = getSeatCategory(row);
    const price = Math.round(basePrice * mult);

    for (let sIdx = 0; sIdx < seatsPerRow; sIdx++) {
      const num = sIdx + 1;
      const seatId = `${row}${String(num).padStart(2, '0')}`;
      const posX = xPositions[sIdx];
      const posY = rowY;
      const posZ = rowZ;

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
  const tierGeometries: Array<{ name: string; row: string; bounds: BoundingBox3D; topY: number }> = [];
  for (let rIdx = 0; rIdx < rows.length; rIdx++) {
    const row = rows[rIdx];
    const rowZ = ROW_A_Z - rIdx * ROW_PITCH;
    const tierTopY = Math.round((rIdx + 1) * TIER_RISE * 1000) / 1000;
    const tierBottomY = Math.round(rIdx * TIER_RISE * 1000) / 1000;

    const tierBounds: BoundingBox3D = {
      min: [-halfWidth + 2.0, tierBottomY, Math.round((rowZ - 0.818) * 1000) / 1000],
      max: [halfWidth - 2.0, tierTopY, Math.round((rowZ + 0.682) * 1000) / 1000],
    };

    const tierObj = {
      name: `tier_platform_${row}`,
      row,
      bounds: tierBounds,
      topY: tierTopY,
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
        const rowZ = ROW_A_Z - rIdx * ROW_PITCH;
        const treadY = Math.round((rIdx + 1) * TIER_RISE * 1000) / 1000;

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

  // 8. Acoustic Wall Panels & Lighting Accents
  const acousticPanels: AcousticPanelDef[] = [];
  const sconces: Array<{ id: string; position: [number, number, number] }> = [];
  const stepLights: Array<{ id: string; position: [number, number, number] }> = [];

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
    acousticPanels,
    stepLights,
    sconces,
    cameraBounds,
    targetBounds,
    defaultCameraPos,
    defaultCameraTarget,
  };

  return {
    seatLayout,
    walkNav,
    geometry,
  };
}

