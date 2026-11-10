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
import {
  THEATRE_TYPE_REGISTRY,
  getTheatreTypeDefinition,
  METERS_TO_SCENE,
  SCENE_TO_METERS,
  type TheatreTypeId,
} from './theatreTypeRegistry';

export interface RowDefinition {
  row: string;
  seats_count: number;
  blocks?: number[];
  seat_types?: Record<number, string>;
}

export interface AuditoriumLayoutInput {
  rows: string[];
  seats_per_row: number;
  aisles: number[];
  theatre_type?: TheatreTypeId;
  arrangement_pattern?: string;
  blocks_pattern?: number[];
  sweet_spot?: {
    rows: string[];
    seat_numbers: number[];
    label?: string;
    price_multiplier?: number;
  };
  row_definitions?: RowDefinition[];
  documented_scale?: {
    meters_to_scene: number;
    seat_width_m: number;
    row_pitch_m: number;
    rake_step_m: number;
    aisle_width_m: number;
    ceiling_height_m: number;
  };
  seat_pitch?: number;
  row_pitch?: number;
  tier_rise?: number;
  aisle_gap?: number;
  ceiling_height?: number;
  screen_width?: number;
  screen_height?: number;
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
  sofa_pairs?: Array<[string, string]>;
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
  ceilingClouds: Array<{
    id: string;
    bounds: BoundingBox3D;
    style?: string;
  }>;
  roofTrusses: Array<{
    id: string;
    bounds: BoundingBox3D;
  }>;
  ventilationDucts: Array<{
    id: string;
    bounds: BoundingBox3D;
  }>;
  coveLightStrips: Array<{
    id: string;
    bounds: BoundingBox3D;
    color?: string;
  }>;
  skirtingLights: Array<{
    id: string;
    bounds: BoundingBox3D;
  }>;
  doorFrames: Array<{
    id: string;
    frameBounds: BoundingBox3D;
    doorBounds: BoundingBox3D;
  }>;
  projectionBooth: {
    housing: BoundingBox3D;
    centerWindow: BoundingBox3D;
    sideWindows: Array<BoundingBox3D>;
    projectorAperture: [number, number, number];
    screenTarget: [number, number, number];
  };
  effectRigs?: Array<{
    id: string;
    trussBounds: BoundingBox3D;
    nozzles: Array<[number, number, number]>;
    fans: Array<[number, number, number]>;
  }>;
  acousticBaffles?: Array<{
    id: string;
    bounds: BoundingBox3D;
  }>;
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
  if (seatsPerRow <= 0) return [];
  if (seatsPerRow === 1) return [0.0];

  const xRel: number[] = new Array(seatsPerRow).fill(0);
  for (let i = 1; i < seatsPerRow; i++) {
    const prevSeatNum = i; // 1-based seat number of the previous seat
    const isAisleAfter = aisles.includes(prevSeatNum);
    const step = seatPitch + (isAisleAfter ? extraAisleGap : 0);
    xRel[i] = xRel[i - 1] + step;
  }
  const span = xRel[seatsPerRow - 1];
  const halfSpan = span / 2.0;

  // Seat 01 is at +halfSpan (Audience Left), Seat N is at -halfSpan (Audience Right)
  return xRel.map((xr) => Math.round((halfSpan - xr) * 1000) / 1000);
}

/**
 * Procedurally generates the full 3D auditorium from layout data.
 */
export function generateProceduralAuditorium(
  input: AuditoriumLayoutInput
): ProceduralAuditoriumResult {
  const rows = input.rows && input.rows.length > 0 ? input.rows : ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  const defaultSeatsPerRow = input.seats_per_row || 10;
  const totalSeatsEstimate = input.total_seats || (rows.length * defaultSeatsPerRow);
  
  // Resolve theatre type definition from registry
  const hasExplicitType = !!input.theatre_type;
  const theatreDef = getTheatreTypeDefinition(input.theatre_type || (totalSeatsEstimate === 100 ? 'compact' : input.screen_type), totalSeatsEstimate);

  // If no explicit theatre_type was passed and total_seats is not 100, preserve the legacy unit tests' defaults (SEAT_PITCH=1.2, EXTRA_AISLE_GAP=1.2, etc.)
  const isLegacyMode = !hasExplicitType && totalSeatsEstimate !== 100 && !input.documented_scale;

  // Scene scaling: use input overrides if provided, otherwise legacy defaults or registry scene dimensions
  const seatPitch = input.seat_pitch ?? (isLegacyMode ? SEAT_PITCH : theatreDef.sceneDimensions.seatPitch);
  const rowPitch = input.row_pitch ?? (isLegacyMode ? ROW_PITCH : theatreDef.sceneDimensions.rowPitch);
  const tierRise = input.tier_rise ?? (isLegacyMode ? TIER_RISE : theatreDef.sceneDimensions.tierRise);
  const aisleGap = input.aisle_gap ?? (isLegacyMode ? EXTRA_AISLE_GAP : theatreDef.sceneDimensions.aisleGap);

  // Resolve aisles from blocks_pattern if not explicitly provided
  let aisles = input.aisles;
  if (!aisles && input.blocks_pattern && input.blocks_pattern.length > 1) {
    let accum = 0;
    aisles = [];
    for (let b = 0; b < input.blocks_pattern.length - 1; b++) {
      accum += input.blocks_pattern[b];
      aisles.push(accum);
    }
  } else if (!aisles) {
    if (defaultSeatsPerRow <= 10) {
      aisles = [Math.floor(defaultSeatsPerRow / 2)];
    } else if (theatreDef.arrangementPattern === 'continental') {
      aisles = [];
    } else {
      aisles = [Math.floor(defaultSeatsPerRow * 0.25), Math.floor(defaultSeatsPerRow * 0.75)];
    }
  }

  const _accessibleSeats = new Set(input.accessible_seats || ['A01', `A${String(defaultSeatsPerRow).padStart(2, '0')}`]);
  const basePrice = input.base_price || 280;
  const screenType = input.screen_type || theatreDef.name;
  const isFlagship = theatreDef.id === 'flagship' || totalSeatsEstimate >= 400;
  const isCurved = theatreDef.features.curved_screen || input.curve_radius !== undefined || isFlagship;

  // Build row definitions map if variable row widths are provided
  const rowDefMap = new Map<string, RowDefinition>();
  if (input.row_definitions) {
    for (const rd of input.row_definitions) {
      rowDefMap.set(rd.row, rd);
    }
  }

  // Pre-calculate maximum seat X span across all rows to size the hall
  let maxSeatAbsX = 0;
  for (const r of rows) {
    const rd = rowDefMap.get(r);
    const count = rd ? rd.seats_count : defaultSeatsPerRow;
    const rAisles = rd?.blocks && rd.blocks.length > 1
      ? rd.blocks.slice(0, -1).reduce((acc: number[], len, idx) => [...acc, (acc[idx - 1] || 0) + len], [])
      : aisles;
    const xs = computeRowXPositions(count, rAisles, seatPitch, aisleGap);
    if (xs.length > 0) {
      const rowMaxAbs = Math.max(Math.abs(xs[0]), Math.abs(xs[xs.length - 1]));
      if (rowMaxAbs > maxSeatAbsX) maxSeatAbsX = rowMaxAbs;
    }
  }

  // Hall Dimensions in Scene Units
  const halfWidth = Math.max(11.11, maxSeatAbsX + 4.2);
  const totalRows = rows.length;
  const zBack = ROW_A_Z - (totalRows - 1) * rowPitch - 4.5;
  const topTierY = totalRows * tierRise;
  const ceilingHeight = Math.max(input.ceiling_height ?? (isLegacyMode ? 11.2 : theatreDef.sceneDimensions.ceilingHeight), topTierY + 7.5);

  let screenWidth = input.screen_width;
  let screenHeight = input.screen_height;
  let screenCenterY = 5.55;

  if (isLegacyMode || totalSeatsEstimate === 100) {
    if (defaultSeatsPerRow <= 12 && rows.length <= 8) {
      screenWidth = screenWidth ?? 13.5;
      screenHeight = screenHeight ?? 6.28;
      screenCenterY = 5.0;
    } else if (defaultSeatsPerRow >= 24 || rows.length >= 14) {
      screenWidth = screenWidth ?? Math.min(27.0, Math.max(18.0, halfWidth * 1.35));
      screenHeight = screenHeight ?? (screenWidth / 2.15);
      screenCenterY = 5.55 + (screenWidth - 15.6) * 0.22;
    } else if (defaultSeatsPerRow >= 16) {
      screenWidth = screenWidth ?? 21.0;
      screenHeight = screenHeight ?? 9.77;
      screenCenterY = 6.6;
    } else {
      screenWidth = screenWidth ?? 15.6;
      screenHeight = screenHeight ?? 7.25;
      screenCenterY = 5.55;
    }
  } else {
    screenWidth = screenWidth ?? theatreDef.sceneDimensions.screenWidth;
    screenHeight = screenHeight ?? theatreDef.sceneDimensions.screenHeight;
    screenCenterY = Math.max(5.55, screenHeight / 2 + 1.2);
  }

  const screenCenter: [number, number, number] = [0.0, screenCenterY, SCREEN_Z];

  // Category bands
  const categoryBands = input.category_bands || [
    { category: 'Front', rows: rows.slice(0, Math.max(2, Math.floor(totalRows * 0.25))), price_multiplier: 0.75 },
    { category: 'Prime', rows: rows.slice(Math.max(2, Math.floor(totalRows * 0.25)), Math.max(4, Math.floor(totalRows * 0.7))), price_multiplier: 1.0 },
    { category: 'Premier', rows: rows.slice(Math.max(4, Math.floor(totalRows * 0.7))), price_multiplier: 1.45 },
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

  // Sweet spot configuration
  const sweetSpotRows = new Set(input.sweet_spot?.rows || []);
  const sweetSpotSeats = new Set(input.sweet_spot?.seat_numbers || []);
  const sweetSpotMultiplier = input.sweet_spot?.price_multiplier || 1.45;

  // Balcony configuration
  const hasBalcony = !!(theatreDef.features.has_balcony || input.has_balcony || (input.balcony_rows && input.balcony_rows.length > 0) || (input.levels?.balcony && input.levels.balcony.rows.length > 0));
  const balconyRowsList: string[] = input.balcony_rows || (input.levels?.balcony?.rows) || (hasBalcony ? rows.slice(Math.max(rows.length - 4, 10)) : []);
  const balconyRowSet = new Set(balconyRowsList);
  const stallsRowsList = rows.filter((r) => !balconyRowSet.has(r));
  const stallsCount = stallsRowsList.length;
  const curveRadius = input.curve_radius ?? (isCurved ? 28.0 : undefined);

  // Seat Records & Colliders
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

  // Pre-calculate pairs for premier rows or luxury recliner halls if not explicitly provided
  const premierRows = categoryBands.find((b) => b.category.toLowerCase() === 'premier')?.rows || [];
  const shouldAutoPair = theatreDef.features.recliner_pairs || theatreDef.id === 'luxury_recliner';

  if (!input.recliner_pairs && shouldAutoPair) {
    for (const r of rows) {
      const rd = rowDefMap.get(r);
      const count = rd ? rd.seats_count : defaultSeatsPerRow;
      for (let s = 1; s <= count; s += 2) {
        if (s + 1 <= count) {
          const s1 = `${r}${String(s).padStart(2, '0')}`;
          const s2 = `${r}${String(s + 1).padStart(2, '0')}`;
          if (!_accessibleSeats.has(s1) && !_accessibleSeats.has(s2)) {
            reclinerPairMap.set(s1, s2);
            reclinerPairMap.set(s2, s1);
          }
        }
      }
    }
  } else if (!input.recliner_pairs) {
    // Pair back rows in premier band
    for (const pRow of premierRows) {
      const rd = rowDefMap.get(pRow);
      const count = rd ? rd.seats_count : defaultSeatsPerRow;
      for (let s = 1; s <= count; s += 2) {
        if (s + 1 <= count) {
          const s1 = `${pRow}${String(s).padStart(2, '0')}`;
          const s2 = `${pRow}${String(s + 1).padStart(2, '0')}`;
          if (!_accessibleSeats.has(s1) && !_accessibleSeats.has(s2)) {
            reclinerPairMap.set(s1, s2);
            reclinerPairMap.set(s2, s1);
          }
        }
      }
    }
  }

  const motionRows = new Set(input.motion_rows || (theatreDef.features.is_4dx || input.features?.is_4dx ? ['D', 'E', 'F', 'G'] : []));

  for (let rIdx = 0; rIdx < rows.length; rIdx++) {
    const row = rows[rIdx];
    const isBalcony = balconyRowSet.has(row);
    let rowY: number;
    let rowZ: number;

    if (isBalcony) {
      const bIdx = balconyRowsList.indexOf(row);
      const balconyElevationJump = 3.6;
      rowY = Math.round((ROW_A_Y + stallsCount * tierRise + balconyElevationJump + bIdx * (tierRise + 0.12)) * 1000) / 1000;
      rowZ = Math.round((ROW_A_Z - (stallsCount + bIdx) * rowPitch - 0.5) * 1000) / 1000;
    } else {
      rowY = Math.round((ROW_A_Y + rIdx * tierRise) * 1000) / 1000;
      rowZ = Math.round((ROW_A_Z - rIdx * rowPitch) * 1000) / 1000;
    }

    const { cat, mult } = getSeatCategory(row);
    const rd = rowDefMap.get(row);
    const rowSeatsCount = rd ? rd.seats_count : defaultSeatsPerRow;
    const rAisles = rd?.blocks && rd.blocks.length > 1
      ? rd.blocks.slice(0, -1).reduce((acc: number[], len, idx) => [...acc, (acc[idx - 1] || 0) + len], [])
      : aisles;
    const xPositions = computeRowXPositions(rowSeatsCount, rAisles, seatPitch, aisleGap);

    for (let sIdx = 0; sIdx < rowSeatsCount; sIdx++) {
      const num = sIdx + 1;
      const seatId = `${row}${String(num).padStart(2, '0')}`;
      const posX = xPositions[sIdx];
      const posY = rowY;
      const sagZ = curveRadius ? Math.round(((posX * posX) / (2 * curveRadius)) * 1000) / 1000 : 0.0;
      const posZ = Math.round((rowZ + sagZ) * 1000) / 1000;

      // Check if sweet spot
      const isSweetSpot = sweetSpotRows.has(row) && sweetSpotSeats.has(num);
      const effectiveMultiplier = isSweetSpot ? sweetSpotMultiplier : mult;
      const effectiveCategory: SeatCategory = isSweetSpot ? 'premier' : cat;
      const price = Math.round(basePrice * effectiveMultiplier);

      const bounds: BoundingBox3D = {
        min: [
          Math.round((posX - seatPitch * 0.48) * 1000) / 1000,
          Math.round((posY - 0.995) * 1000) / 1000,
          Math.round((posZ - 0.492) * 1000) / 1000,
        ],
        max: [
          Math.round((posX + seatPitch * 0.48) * 1000) / 1000,
          Math.round((posY + 0.995) * 1000) / 1000,
          Math.round((posZ + 0.491) * 1000) / 1000,
        ],
      };

      const eye = eyePosition(bounds.min, bounds.max);
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

      let seatType = isAccessible
        ? 'accessible'
        : (isCompanion
          ? 'companion'
          : (theatreDef.id === 'boutique'
            ? 'sofa'
            : (pairPartner
              ? 'recliner_pair'
              : (theatreDef.id === 'luxury_recliner' ? 'recliner' : 'standard'))));

      // Override if row definition explicitly specifies seat type
      if (rd?.seat_types && rd.seat_types[num]) {
        seatType = rd.seat_types[num];
      }

      const seatRec: SeatRecord = {
        seat_id: seatId,
        node_name: `seat_${row}_${String(num).padStart(2, '0')}`,
        row,
        number: num,
        category: effectiveCategory,
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
        seat_type: seatType as any,
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
    let rowZ = ROW_A_Z - rIdx * rowPitch;
    let tierTopY: number;
    let tierBottomY: number;

    if (isBalcony) {
      const bIdx = balconyRowsList.indexOf(row);
      const balconyElevationJump = 3.6;
      tierTopY = Math.round((ROW_A_Y + stallsCount * tierRise + balconyElevationJump + (bIdx + 1) * (tierRise + 0.12)) * 1000) / 1000;
      tierBottomY = Math.round((ROW_A_Y + stallsCount * tierRise + balconyElevationJump + bIdx * (tierRise + 0.12)) * 1000) / 1000;
      rowZ = ROW_A_Z - (stallsCount + bIdx) * rowPitch - 0.5;
    } else {
      tierTopY = Math.round((rIdx + 1) * tierRise * 1000) / 1000;
      tierBottomY = Math.round(rIdx * tierRise * 1000) / 1000;
    }

    const tierBounds: BoundingBox3D = {
      min: [-halfWidth + 2.0, tierBottomY, Math.round((rowZ - rowPitch * 0.54) * 1000) / 1000],
      max: [halfWidth - 2.0, tierTopY, Math.round((rowZ + rowPitch * 0.46) * 1000) / 1000],
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

  const defaultRowXPositions = computeRowXPositions(defaultSeatsPerRow, aisles, seatPitch, aisleGap);
  for (const aIdx of aisles) {
    if (aIdx >= 1 && aIdx < defaultSeatsPerRow) {
      const leftSeatX = defaultRowXPositions[aIdx - 1];
      const rightSeatX = defaultRowXPositions[aIdx];
      const aisleCenterX = (leftSeatX + rightSeatX) / 2.0;
      aisleCenters.push(aisleCenterX);

      for (let rIdx = 0; rIdx < rows.length; rIdx++) {
        const row = rows[rIdx];
        const isBalcony = balconyRowSet.has(row);
        let rowZ = ROW_A_Z - rIdx * rowPitch;
        let treadY: number;

        if (isBalcony) {
          const bIdx = balconyRowsList.indexOf(row);
          const balconyElevationJump = 3.6;
          treadY = Math.round((ROW_A_Y + stallsCount * tierRise + balconyElevationJump + (bIdx + 1) * (tierRise + 0.12)) * 1000) / 1000;
          rowZ = ROW_A_Z - (stallsCount + bIdx) * rowPitch - 0.5;
        } else {
          treadY = Math.round((rIdx + 1) * tierRise * 1000) / 1000;
        }

        const stepBounds: BoundingBox3D = {
          min: [
            Math.round((aisleCenterX - aisleGap * 0.45) * 1000) / 1000,
            treadY - 0.05,
            Math.round((rowZ - rowPitch * 0.5) * 1000) / 1000,
          ],
          max: [
            Math.round((aisleCenterX + aisleGap * 0.45) * 1000) / 1000,
            treadY,
            Math.round((rowZ + rowPitch * 0.5) * 1000) / 1000,
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
      const rowZ = ROW_A_Z - rIdx * rowPitch;
      const stepY = (rIdx + 1) * tierRise;
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
    const balconyFrontZ = ROW_A_Z - stallsCount * rowPitch - 0.2;
    const bBaseY = ROW_A_Y + stallsCount * tierRise + 3.6;
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

  // 8c. Suspended Acoustic Ceiling Clouds & Roof Structural Trusses
  const ceilingClouds: ProceduralGeometryData['ceilingClouds'] = [];
  const roofTrusses: ProceduralGeometryData['roofTrusses'] = [];
  const ventilationDucts: ProceduralGeometryData['ventilationDucts'] = [];
  const coveLightStrips: ProceduralGeometryData['coveLightStrips'] = [];
  const skirtingLights: ProceduralGeometryData['skirtingLights'] = [];
  const doorFrames: ProceduralGeometryData['doorFrames'] = [];

  // 1. Suspended Acoustic Clouds
  const cloudCount = theatreDef.ceilingDesign.cloudsCount || 6;
  const cloudRows = Math.max(2, Math.min(5, Math.ceil(cloudCount / 3)));
  const cloudCols = Math.max(2, Math.min(3, Math.ceil(cloudCount / cloudRows)));
  const cloudZSpan = Math.abs(zBack) - 6.0;
  const cloudZStep = cloudZSpan / (cloudRows + 1);
  const cloudWidth = (halfWidth * 1.5) / cloudCols;
  const cloudDepth = Math.max(2.5, cloudZStep * 0.75);

  let cIdx = 0;
  for (let cr = 1; cr <= cloudRows; cr++) {
    const cZ = -4.0 - cr * cloudZStep;
    for (let cc = 0; cc < cloudCols; cc++) {
      if (cIdx >= cloudCount) break;
      const cX = -halfWidth * 0.7 + (cc + 0.5) * ((halfWidth * 1.4) / cloudCols);
      ceilingClouds.push({
        id: `cloud_${cr}_${cc}`,
        bounds: {
          min: [
            Math.round((cX - cloudWidth * 0.45) * 1000) / 1000,
            Math.round((ceilingHeight - 0.75) * 1000) / 1000,
            Math.round((cZ - cloudDepth * 0.5) * 1000) / 1000,
          ],
          max: [
            Math.round((cX + cloudWidth * 0.45) * 1000) / 1000,
            Math.round((ceilingHeight - 0.50) * 1000) / 1000,
            Math.round((cZ + cloudDepth * 0.5) * 1000) / 1000,
          ],
        },
        style: theatreDef.ceilingDesign.structure,
      });
      cIdx++;
    }
  }

  // Under-balcony clouds if balcony exists
  if (hasBalcony && balconyRowsList.length > 0) {
    const bBaseY = ROW_A_Y + stallsCount * tierRise + 3.6;
    const balconyFrontZ = ROW_A_Z - stallsCount * rowPitch - 0.2;
    ceilingClouds.push({
      id: 'under_balcony_cloud_l',
      bounds: {
        min: [-halfWidth + 2.0, bBaseY - 0.65, zBack + 1.0],
        max: [-0.5, bBaseY - 0.55, balconyFrontZ + 1.0],
      },
      style: 'under_balcony',
    });
    ceilingClouds.push({
      id: 'under_balcony_cloud_r',
      bounds: {
        min: [0.5, bBaseY - 0.65, zBack + 1.0],
        max: [halfWidth - 2.0, bBaseY - 0.55, balconyFrontZ + 1.0],
      },
      style: 'under_balcony',
    });
  }

  // 2. Transverse Roof Trusses / Beams
  const trussCount = theatreDef.ceilingDesign.trussesCount || 4;
  const trussZSpan = Math.abs(zBack) - 4.5;
  const trussZStep = trussZSpan / (trussCount + 1);
  for (let t = 1; t <= trussCount; t++) {
    const tZ = Math.round((-2.5 - t * trussZStep) * 1000) / 1000;
    roofTrusses.push({
      id: `truss_${t}`,
      bounds: {
        min: [-halfWidth + 0.1, Math.round((ceilingHeight - 0.85) * 1000) / 1000, tZ - 0.2],
        max: [halfWidth - 0.1, Math.round((ceilingHeight - 0.15) * 1000) / 1000, tZ + 0.2],
      },
    });
  }

  // 3. Ventilation Ducts (HVAC)
  if (theatreDef.ceilingDesign.hasDucts) {
    const ductYMin = Math.round((ceilingHeight - 1.25) * 1000) / 1000;
    const ductYMax = Math.round((ceilingHeight - 0.65) * 1000) / 1000;
    // Left duct (+X)
    ventilationDucts.push({
      id: 'duct_left',
      bounds: {
        min: [Math.round((halfWidth * 0.65 - 0.45) * 1000) / 1000, ductYMin, zBack + 1.0],
        max: [Math.round((halfWidth * 0.65 + 0.45) * 1000) / 1000, ductYMax, -1.8],
      },
    });
    // Right duct (-X)
    ventilationDucts.push({
      id: 'duct_right',
      bounds: {
        min: [Math.round((-halfWidth * 0.65 - 0.45) * 1000) / 1000, ductYMin, zBack + 1.0],
        max: [Math.round((-halfWidth * 0.65 + 0.45) * 1000) / 1000, ductYMax, -1.8],
      },
    });
  }

  // 4. Continuous Cove Light Channels
  // Left wall cove (+X)
  coveLightStrips.push({
    id: 'cove_left_wall',
    bounds: {
      min: [halfWidth - 0.35, Math.round((ceilingHeight - 0.40) * 1000) / 1000, zBack + 0.5],
      max: [halfWidth - 0.15, Math.round((ceilingHeight - 0.20) * 1000) / 1000, -1.2],
    },
    color: theatreDef.palette.coveColor,
  });
  // Right wall cove (-X)
  coveLightStrips.push({
    id: 'cove_right_wall',
    bounds: {
      min: [-halfWidth + 0.15, Math.round((ceilingHeight - 0.40) * 1000) / 1000, zBack + 0.5],
      max: [-halfWidth + 0.35, Math.round((ceilingHeight - 0.20) * 1000) / 1000, -1.2],
    },
    color: theatreDef.palette.coveColor,
  });
  // Screen proscenium top cove
  coveLightStrips.push({
    id: 'cove_screen_header',
    bounds: {
      min: [-screenWidth / 2 - 0.8, Math.round((screenCenterY + screenHeight / 2 + 0.75) * 1000) / 1000, SCREEN_Z - 0.22],
      max: [screenWidth / 2 + 0.8, Math.round((screenCenterY + screenHeight / 2 + 0.95) * 1000) / 1000, SCREEN_Z - 0.05],
    },
    color: theatreDef.palette.coveColor,
  });
  // Rear wall cove
  coveLightStrips.push({
    id: 'cove_rear_wall',
    bounds: {
      min: [-halfWidth + 0.8, Math.round((ceilingHeight - 0.40) * 1000) / 1000, zBack + 0.12],
      max: [halfWidth - 0.8, Math.round((ceilingHeight - 0.20) * 1000) / 1000, zBack + 0.32],
    },
    color: theatreDef.palette.coveColor,
  });

  // 5. Continuous Skirting Baseboard Lights
  skirtingLights.push({
    id: 'skirting_left',
    bounds: {
      min: [halfWidth - 0.15, 0.02, zBack + 0.5],
      max: [halfWidth - 0.05, 0.14, -1.2],
    },
  });
  skirtingLights.push({
    id: 'skirting_right',
    bounds: {
      min: [-halfWidth + 0.05, 0.02, zBack + 0.5],
      max: [-halfWidth + 0.15, 0.14, -1.2],
    },
  });

  // 6. Emergency Exit Door Portals & Frames
  doorFrames.push({
    id: 'door_front_left',
    frameBounds: {
      min: [halfWidth - 0.22, 0.0, SCREEN_Z + 0.8],
      max: [halfWidth + 0.05, 3.2, SCREEN_Z + 2.5],
    },
    doorBounds: {
      min: [halfWidth - 0.12, 0.05, SCREEN_Z + 0.95],
      max: [halfWidth + 0.02, 3.1, SCREEN_Z + 2.35],
    },
  });
  doorFrames.push({
    id: 'door_rear_right',
    frameBounds: {
      min: [-halfWidth - 0.05, topTierY, zBack + 0.8],
      max: [-halfWidth + 0.22, topTierY + 3.2, zBack + 2.5],
    },
    doorBounds: {
      min: [-halfWidth - 0.02, topTierY + 0.05, zBack + 0.95],
      max: [-halfWidth + 0.12, topTierY + 3.1, zBack + 2.35],
    },
  });

  // 7. Rear Wall Projection Booth & Apertures
  const boothBaseY = Math.round(Math.max(topTierY + 1.2, ceilingHeight * 0.52) * 1000) / 1000;
  const boothTopY = Math.round(Math.min(boothBaseY + 3.4, ceilingHeight - 0.4) * 1000) / 1000;
  const boothCenterY = Math.round(((boothBaseY + boothTopY) / 2.0) * 1000) / 1000;
  const projectionBooth: ProceduralGeometryData['projectionBooth'] = {
    housing: {
      min: [-3.8, boothBaseY, zBack - 0.3],
      max: [3.8, boothTopY, zBack + 0.75],
    },
    centerWindow: {
      min: [-1.4, boothCenterY - 0.55, zBack + 0.72],
      max: [1.4, boothCenterY + 0.55, zBack + 0.80],
    },
    sideWindows: [
      {
        min: [1.8, boothCenterY - 0.4, zBack + 0.72],
        max: [3.2, boothCenterY + 0.4, zBack + 0.80],
      },
      {
        min: [-3.2, boothCenterY - 0.4, zBack + 0.72],
        max: [-1.8, boothCenterY + 0.4, zBack + 0.80],
      },
    ],
    projectorAperture: [0.0, boothCenterY, zBack + 0.85],
    screenTarget: [0.0, screenCenterY + screenHeight * 0.15, SCREEN_Z],
  };

  // 8. 4DX Effect Rigs (when applicable)
  let effectRigs: ProceduralGeometryData['effectRigs'];
  if (theatreDef.features.is_4dx || input.features?.is_4dx) {
    effectRigs = [
      {
        id: 'effect_rig_front',
        trussBounds: {
          min: [-halfWidth * 0.65, ceilingHeight - 1.8, -6.2],
          max: [halfWidth * 0.65, ceilingHeight - 1.5, -5.8],
        },
        nozzles: [
          [-halfWidth * 0.5, ceilingHeight - 1.85, -6.0],
          [-halfWidth * 0.2, ceilingHeight - 1.85, -6.0],
          [halfWidth * 0.2, ceilingHeight - 1.85, -6.0],
          [halfWidth * 0.5, ceilingHeight - 1.85, -6.0],
        ],
        fans: [
          [-halfWidth * 0.35, ceilingHeight - 1.9, -6.0],
          [0.0, ceilingHeight - 1.9, -6.0],
          [halfWidth * 0.35, ceilingHeight - 1.9, -6.0],
        ],
      },
      {
        id: 'effect_rig_mid',
        trussBounds: {
          min: [-halfWidth * 0.65, ceilingHeight - 1.8, -13.2],
          max: [halfWidth * 0.65, ceilingHeight - 1.5, -12.8],
        },
        nozzles: [
          [-halfWidth * 0.5, ceilingHeight - 1.85, -13.0],
          [-halfWidth * 0.2, ceilingHeight - 1.85, -13.0],
          [halfWidth * 0.2, ceilingHeight - 1.85, -13.0],
          [halfWidth * 0.5, ceilingHeight - 1.85, -13.0],
        ],
        fans: [
          [-halfWidth * 0.35, ceilingHeight - 1.9, -13.0],
          [0.0, ceilingHeight - 1.9, -13.0],
          [halfWidth * 0.35, ceilingHeight - 1.9, -13.0],
        ],
      },
    ];
  }

  // 9. Acoustic Baffles (Flagship & Large halls)
  let acousticBaffles: ProceduralGeometryData['acousticBaffles'];
  if (theatreDef.ceilingDesign.hasBaffles) {
    acousticBaffles = [];
    for (let b = 0; b < 6; b++) {
      const bZ = -5.0 - b * ((Math.abs(zBack) - 8.0) / 5.0);
      acousticBaffles.push({
        id: `baffle_l_${b}`,
        bounds: {
          min: [halfWidth * 0.45, ceilingHeight - 1.4, bZ - 0.08],
          max: [halfWidth * 0.47, ceilingHeight - 0.5, bZ + 0.08],
        },
      });
      acousticBaffles.push({
        id: `baffle_r_${b}`,
        bounds: {
          min: [-halfWidth * 0.47, ceilingHeight - 1.4, bZ - 0.08],
          max: [-halfWidth * 0.45, ceilingHeight - 0.5, bZ + 0.08],
        },
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
    minZ: ROW_A_Z - (totalRows - 1) * rowPitch + 2.0,
    maxZ: -3.0,
  };

  const defaultCameraPos: [number, number, number] = [
    0.0,
    Math.min(ceilingHeight - 1.8, topTierY + 7.5),
    zBack + 3.8,
  ];
  const defaultCameraTarget: [number, number, number] = [
    0.0,
    screenCenterY * 0.72,
    SCREEN_Z,
  ];

  // Camera Presets (§ Product Polish)
  const cameraPresets: Record<string, { position: [number, number, number]; target: [number, number, number]; caption: string }> = {
    overview: {
      position: defaultCameraPos,
      target: defaultCameraTarget,
      caption: 'Auditorium Overview',
    },
    front: {
      position: [0.0, 3.2, ROW_A_Z + 1.5],
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
      position: [0.0, Math.min(topTierY + 5.0, ceilingHeight - 2.5), (ROW_A_Z + zBack) / 2 - 2.0],
      target: [0.0, 2.5, (ROW_A_Z + zBack) / 2],
      caption: 'Seat Picker View',
    },
  };

  // 10. Assemble Output Data Structures
  const categoriesRecord: Record<SeatCategory, CategoryInfo> = {
    front: { label: 'Front', rows: 'A-C', price: Math.round(basePrice * 0.75), color: '#7c2d12' },
    prime: { label: 'Prime', rows: 'D-G', price: basePrice, color: '#881337' },
    premier: { label: 'Premier', rows: 'H-J', price: Math.round(basePrice * 1.45), color: '#9f1239' },
  };

  const seatLayout: SeatLayoutFile = {
    version: 2,
    generated_from: `procedural_generator_${input.screen_type || theatreDef.name}`,
    theatre_type: theatreDef.id,
    theatre_type_name: theatreDef.name,
    theatre_type_label: theatreDef.label,
    arrangement_pattern: input.arrangement_pattern || theatreDef.arrangementPattern,
    blocks_pattern: input.blocks_pattern,
    sweet_spot: input.sweet_spot,
    documented_scale: {
      meters_to_scene: METERS_TO_SCENE,
      scene_to_meters: SCENE_TO_METERS,
      seat_width_m: theatreDef.realWorldDimensions.seatWidthM,
      row_pitch_m: theatreDef.realWorldDimensions.rowPitchM,
      rake_step_m: theatreDef.realWorldDimensions.rakeStepM,
      aisle_width_m: theatreDef.realWorldDimensions.aisleWidthM,
      ceiling_height_m: theatreDef.realWorldDimensions.ceilingHeightM,
      screen_width_m: theatreDef.realWorldDimensions.screenWidthM,
      screen_height_m: theatreDef.realWorldDimensions.screenHeightM,
    },
    coordinate_system: 'glTF Y-up (+Y up, +X audience left, -X audience right, +Z screenward)',
    units: {
      scene_unit: 'procedural model unit',
      unit_to_meters_estimate: SCENE_TO_METERS,
      note: '1.0m = 2.0 scene units (documented scale)',
    },
    auditorium: {
      bounds_min: [-halfWidth, -0.57, zBack],
      note: `Procedural ${theatreDef.name} (${theatreDef.label}) with ${seatRecords.length} seats`,
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
      ...(hasBalcony ? { balcony: { label: 'Balcony', height: 3.6, rows: balconyRowsList } } : {}),
    },
    has_balcony: hasBalcony,
    recliner_pairs: input.recliner_pairs,
    sofa_pairs: input.sofa_pairs,
    features: {
      is_4dx: theatreDef.features.is_4dx || screenType.includes('4DX') || !!input.features?.is_4dx,
      motion_seats: theatreDef.features.is_4dx || screenType.includes('4DX') || !!input.features?.motion_seats || !!input.features?.is_4dx,
      wind: theatreDef.features.is_4dx || screenType.includes('4DX') || !!input.features?.wind || !!input.features?.is_4dx,
      water: theatreDef.features.is_4dx || screenType.includes('4DX') || !!input.features?.water || !!input.features?.is_4dx,
      fog: theatreDef.features.is_4dx || screenType.includes('4DX') || !!input.features?.fog || !!input.features?.is_4dx,
      scent: theatreDef.features.is_4dx || screenType.includes('4DX') || !!input.features?.scent || !!input.features?.is_4dx,
      strobe: theatreDef.features.is_4dx || screenType.includes('4DX') || !!input.features?.strobe || !!input.features?.is_4dx,
      ticklers: theatreDef.features.is_4dx || screenType.includes('4DX') || !!input.features?.ticklers || !!input.features?.is_4dx,
      dolby_atmos: theatreDef.features.dolby_atmos || screenType.includes('Atmos') || screenType.includes('4DX') || !!input.features?.dolby_atmos,
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
      unit_to_meters_estimate: SCENE_TO_METERS,
    },
    player: playerConfig,
    aisles: {
      central: {
        x_min: primaryAisleX - aisleGap * 0.45,
        x_max: primaryAisleX + aisleGap * 0.45,
        width: aisleGap,
      },
      aisle_centers: aisleCenters,
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
    ceilingClouds,
    roofTrusses,
    ventilationDucts,
    coveLightStrips,
    skirtingLights,
    doorFrames,
    projectionBooth,
    effectRigs,
    acousticBaffles,
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

