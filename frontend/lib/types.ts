export type SeatStatus = 'available' | 'booked' | 'held' | 'selected';

export type SeatCategory = 'front' | 'prime' | 'premier';

export type SeatType = 'standard' | 'recliner' | 'recliner_pair' | 'sofa' | 'accessible' | 'companion';

export type HallLevel = 'stalls' | 'balcony';

export type CameraMode = 'drone' | 'orbit' | 'pov' | 'walk' | 'overview' | 'seated' | 'transitioning';

export type HouseLightsMode = 'full' | 'dim' | 'show';

export type QualityTier = 'high' | 'medium' | 'low';

export type QualityMode = 'smooth' | 'beautiful';

export type CameraPreset = 'overview' | 'front' | 'back' | 'aerial' | 'screen' | 'balcony' | 'top' | 'picker';

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
  seat_type?: SeatType;
  pair_partner_id?: string;
  level?: HallLevel;
  section?: string;
  in_motion_zone?: boolean;
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
  theatre_type?: string;
  theatre_type_name?: string;
  theatre_type_label?: string;
  arrangement_pattern?: string;
  blocks_pattern?: number[];
  sweet_spot?: {
    rows: string[];
    seat_numbers: number[];
    label?: string;
    price_multiplier?: number;
  };
  documented_scale?: {
    meters_to_scene: number;
    scene_to_meters: number;
    seat_width_m: number;
    row_pitch_m: number;
    rake_step_m: number;
    aisle_width_m: number;
    ceiling_height_m: number;
    screen_width_m: number;
    screen_height_m: number;
  };
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
  levels?: {
    stalls?: { label: string; height: number; rows: string[] };
    balcony?: { label: string; height: number; rows: string[] };
  };
  has_balcony?: boolean;
  recliner_pairs?: Array<[string, string]>;
  sofa_pairs?: Array<[string, string]>;
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
    aisle_centers?: number[];
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

export interface CinemaItem {
  id: number;
  city_id: number;
  name: string;
  slug: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  cancellation_policy: string;
  facilities: string[];
  images: string[];
  pincode?: string | null;
  landmark?: string | null;
  parking?: string | null;
  transit_stop?: string | null;
  phone?: string | null;
  opening_hours?: string | null;
  is_demo_data?: boolean;
  distance_km?: number | null;
  directions_url?: string | null;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export type MapProviderType = 'leaflet-osm' | 'google-maps' | 'mapbox';

export interface MapProviderConfig {
  provider: MapProviderType;
  tileUrl?: string;
  attribution?: string;
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
      setLightIntensity: (intensity: 'normal' | 'brighter') => void;
      sampleLuminance: () => {
        meanLuminance: number;
        nearBlackPercent: number;
        highlightPercent: number;
        width: number;
        height: number;
      };
      setTheatreLook: (look: 'a' | 'b' | 'c') => void;
      setQualityTier: (tier: QualityTier) => void;
      setQualityMode: (mode: QualityMode) => void;
      setFOV: (fov: number) => void;
      setHoveredSeat: (seatId: string | null) => void;
      getStore: () => any;
      getVisibleProxiesCount: () => number;
      getShadowCastersCount: () => number;
    };
  }
}
