export type SeatStatus = 'available' | 'booked' | 'held' | 'selected';

export type SeatCategory = 'front' | 'prime' | 'premier';

export type CameraMode = 'orbit' | 'pov' | 'walk' | 'overview' | 'seated' | 'transitioning';

export type HouseLightsMode = 'full' | 'dim' | 'show';

export type QualityTier = 'high' | 'medium' | 'low';

export type QualityMode = 'smooth' | 'beautiful';

export type CameraPreset = 'overview' | 'front' | 'back' | 'aerial';

export interface BoundingBox3D {
  min: [number, number, number];
  max: [number, number, number];
}

export interface SeatRecord {
  seat_id: string; // e.g. "A05"
  node_name: string; // e.g. "seat_A_05"
  row: string; // "A"
  number: number; // 5
  category: SeatCategory;
  price: number;
  position_gltf_y_up: [number, number, number];
  bounds_gltf_y_up: BoundingBox3D;
  eye_position_gltf_y_up: [number, number, number];
  screen_distance: number;
  screen_distance_m_est: number;
  horizontal_offset_deg: number;
  vertical_angle_deg: number;
  screen_h_fov_deg: number;
  screen_v_fov_deg: number;
}

export interface CategoryInfo {
  label: string;
  rows: string;
  price: number;
  color: string;
}

export interface ScreenConfig {
  center_gltf_y_up: [number, number, number];
  width: number;
  height: number;
  aspect: number;
  mesh: string;
}

export interface SeatLayoutFile {
  version: number;
  generated_from: string;
  coordinate_system: string;
  units: {
    scene_unit: string;
    unit_to_meters_estimate: number;
    note: string;
  };
  auditorium: {
    bounds_min: [number, number, number];
    note: string;
  };
  screen: ScreenConfig;
  eye_model: {
    cushion_top_above_seat_min_units: number;
    eye_above_cushion_m: number;
    eye_forward_of_backrest_units: number;
    disclaimer: string;
  };
  categories: Record<SeatCategory, CategoryInfo>;
  seats: SeatRecord[];
}

export interface WalkableSurface {
  name: string;
  type: string;
  row?: string;
  bounds: BoundingBox3D;
  top_y: number;
}

export interface ColliderAABB {
  name: string;
  type: string;
  bounds: BoundingBox3D;
}

export interface PlayerConfig {
  radius: number;
  standing_eye_height: number;
  crouch_eye_height: number;
  seated_eye_height: number;
  max_step_up: number;
  max_step_down: number;
  walk_speed: number;
  run_speed: number;
  spawn_position: [number, number, number];
  spawn_yaw: number;
  fov: number;
}

export interface WalkNavFile {
  version: number;
  generated_from: string;
  coordinate_system: string;
  units: {
    scene_unit: string;
    unit_to_meters_estimate: number;
  };
  player: PlayerConfig;
  aisles: {
    central: { x_min: number; x_max: number; width: number };
    side_left: { x_min: number; x_max: number };
    side_right: { x_min: number; x_max: number };
  };
  walkable_count: number;
  collider_count: number;
  walkable: WalkableSurface[];
  colliders: ColliderAABB[];
}

export interface SeatStatusUpdate {
  seatId: string;
  status: 'available' | 'booked' | 'held';
}

/**
 * Interface for prospective obstruction modeling (sightline occlusions from
 * patrons in front rows, handrails, architectural columns, or tier rakes).
 * 
 * TODO: Phase 4+ — Implement raymarching / convex hull shadow projection
 * against human avatar proxies and stage lip bounds.
 */
export interface ObstructionEstimator {
  calculateObstruction(
    seatEyePosition: [number, number, number],
    screenCorners: [number, number, number][]
  ): {
    obstructionRatio: number; // 0.0 = clear sightline, 1.0 = completely blocked
    occludingObjects: string[];
    note: string;
  };
}

export interface CineverseStateExport {
  mode?: 'overview' | 'walk' | 'seated';
  theatreLook?: 'a' | 'b' | 'c';
  cameraMode: CameraMode;
  cameraPreset?: CameraPreset;
  isHeatmapActive?: boolean;
  cameraPosition: [number, number, number];
  cameraTarget: [number, number, number];
  fov: number;
  activeSeatId: string | null;
  selectedSeats: string[];
  hoveredSeatId: string | null;
  houseLights: HouseLightsMode;
  qualityTier: QualityTier;
  qualityMode?: QualityMode;
  useHqModel: boolean;
  walkPlayer?: {
    position: [number, number, number];
    eyeHeight: number;
    yaw: number;
    pitch: number;
  };
  rendererInfo?: {
    triangles: number;
    calls: number;
    fps: number;
    geometries: number;
    textures: number;
  };
}

declare global {
  interface Window {
    __cineverse?: {
      getState: () => CineverseStateExport;
      selectSeat: (seatId: string) => boolean;
      enterPOV: (seatId: string) => void;
      exitPOV: () => void;
      setMode: (mode: 'overview' | 'walk' | 'seated') => void;
      sitAt: (seatId: string) => void;
      standUp: () => void;
      teleportToRow: (row: string) => void;
      walkToSeat: (seatId: string) => void;
      setCameraPreset: (preset: CameraPreset) => void;
      toggleCompare: () => void;
      simulateHold: (seatId: string) => void;
      updateSeatStatus: (seatId: string, status: SeatStatus) => void;
      setHouseLights: (mode: HouseLightsMode) => void;
      setTheatreLook: (look: 'a' | 'b' | 'c') => void;
      setQualityTier: (tier: QualityTier) => void;
      setQualityMode: (mode: QualityMode) => void;
      setFOV: (fov: number) => void;
      setHoveredSeat: (seatId: string | null) => void;
      getStore: () => any;
      getVisibleProxiesCount: () => number;
    };
  }
}
