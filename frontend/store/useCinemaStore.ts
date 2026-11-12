import { create } from 'zustand';
import type {
  SeatStatus,
  CameraMode,
  CameraPreset,
  HouseLightsMode,
  QualityTier,
  QualityMode,
  CineverseStateExport,
} from '@/lib/types';
import type { TierSummaryItem } from '@/services/api';
import layoutData from '@/public/models/seat_layout_v2.json';
import walkNavData from '@/public/models/walk_nav_v2.json';
import type { SeatLayoutFile, WalkNavFile } from '@/lib/types';
import type { ProceduralAuditoriumResult } from '@/lib/proceduralAuditorium';

export const MAX_SELECTED_SEATS = 8;
export const DEFAULT_CAMERA_POS: [number, number, number] = [0.0, 8.5, -22.5];
export const DEFAULT_CAMERA_TARGET: [number, number, number] = [0.0, 4.0, -8.0];

export const DEFAULT_AUDITORIUM_BOUNDS = {
  minX: -9.2,
  maxX: 9.2,
  minY: 1.1,
  maxY: 9.6,
  minZ: -24.2,
  maxZ: -2.2,
};

export const DEFAULT_TARGET_BOUNDS = {
  minX: -6.0,
  maxX: 6.0,
  minY: 1.5,
  maxY: 6.5,
  minZ: -19.0,
  maxZ: -3.0,
};

export interface WalkPlayerState {
  position: [number, number, number];
  eyeHeight: number;
  yaw: number;
  pitch: number;
  isRunning: boolean;
  isGrounded: boolean;
}

export interface WalkSettings {
  sensitivity: number;
  invertY: boolean;
  fov: number;
  headBob: boolean;
}

export interface TrailerState {
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  trailerUrl: string;
  posterUrl?: string;
  movieTitle?: string;
  hasSpill: boolean;
}

export interface CinemaState {
  // Seat state
  seatStatuses: Record<string, SeatStatus>;
  seatPrices: Record<string, { price: number; category: string; currency?: string; quote_id?: string }>;
  tiers: TierSummaryItem[];
  selectedSeats: string[];
  activeSeatId: string | null;
  hoveredSeatId: string | null;

  // Camera & 3-Mode Navigation (§5b)
  mode: 'overview' | 'walk' | 'seated';
  cameraMode: CameraMode; // backwards compatible mirror
  cameraPreset: CameraPreset;
  cameraPosition: [number, number, number];
  cameraTarget: [number, number, number];
  previousOrbitPose: {
    position: [number, number, number];
    target: [number, number, number];
  };
  fov: number; // 50 | 60 | 70 | 75

  // First-person Walk state
  walkPlayer: WalkPlayerState;
  walkSettings: WalkSettings;
  autoWalkTarget: string | null; // seatId for scripted walk-to-seat

  // Cinema Screen Trailer (§5c)
  trailer: TrailerState;

  // Environment & Realism
  houseLights: HouseLightsMode;
  lightIntensity: 'normal' | 'brighter';
  setLightIntensity: (intensity: 'normal' | 'brighter') => void;
  qualityTier: QualityTier;
  qualityMode: QualityMode;
  useHqModel: boolean;
  isContinuousRendering: boolean;

  // Comparison
  isComparing: boolean;
  compareSeats: string[];

  // Phase 11 Viewing Comfort Heatmap
  isHeatmapActive: boolean;
  toggleHeatmap: () => void;
  setHeatmapActive: (active: boolean) => void;

  // Audience Simulation (§ 4)
  showPeople: boolean;
  setShowPeople: (show: boolean) => void;
  toggleShowPeople: () => void;

  // 4DX Experience Simulation (§ 8)
  experience4dxActive: boolean;
  setExperience4dxActive: (active: boolean) => void;
  experience4dxIntensity: 'off' | 'light' | 'medium' | 'full';
  setExperience4dxIntensity: (intensity: 'off' | 'light' | 'medium' | 'full') => void;

  // Guided Tour & Presets (§ 9)
  tourActive: boolean;
  setTourActive: (active: boolean) => void;
  tourStepIndex: number;
  setTourStepIndex: (index: number) => void;

  // Multilingual Support (§ 9)
  selectedLanguage: 'en' | 'hi' | 'kn' | 'ta' | 'te';
  setSelectedLanguage: (lang: 'en' | 'hi' | 'kn' | 'ta' | 'te') => void;

  // Settings Modal (§ 9)
  settingsModalOpen: boolean;
  setSettingsModalOpen: (open: boolean) => void;

  // Phase 10 Group Booking
  activeGroup: any | null;
  groupMemberMap: Record<string, { userId: number; userName: string; initials: string; color: string; proposedSeats: string[]; assignedSeats: string[]; role: string }>;
  setActiveGroup: (group: any | null) => void;
  updateGroupMemberSeats: (userId: number, seats: string[]) => void;

  // Feedback & Toast
  toastMessage: string | null;
  lastBoundaryNoticeTime: number;
  triggerBoundaryNotice: () => void;

  // Stats
  rendererInfo: {
    triangles: number;
    calls: number;
    fps: number;
    geometries: number;
    textures: number;
  };

  // Dynamic Auditorium Layout & Procedural 3D
  auditoriumId: string;
  auditoriumName?: string;
  screenType?: string;
  auditoriumLayout: SeatLayoutFile;
  auditoriumWalkNav: WalkNavFile;
  cameraBounds: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
  targetBounds: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
  proceduralResult: ProceduralAuditoriumResult | null;
  setAuditoriumData: (
    auditoriumId: string,
    result: ProceduralAuditoriumResult | null,
    meta?: { name?: string; screenType?: string }
  ) => void;

  // Actions
  setSeatStatuses: (statuses: Record<string, SeatStatus>) => void;
  setSeatPrices: (prices: Record<string, { price: number; category: string; currency?: string; quote_id?: string }>) => void;
  setTiers: (tiers: TierSummaryItem[]) => void;
  updateSeatStatus: (seatId: string, status: SeatStatus) => void;
  selectSeat: (seatId: string) => boolean;
  deselectSeat: (seatId: string) => void;
  toggleSeat: (seatId: string) => boolean;
  clearSelection: () => void;
  setActiveSeat: (seatId: string | null) => void;
  setHoveredSeat: (seatId: string | null) => void;

  // Mode and Camera actions
  setMode: (mode: 'overview' | 'walk' | 'seated') => void;
  setCameraMode: (mode: CameraMode) => void;
  setCameraPreset: (preset: CameraPreset) => void;
  setCameraPose: (position: [number, number, number], target: [number, number, number]) => void;
  setFOV: (fov: number) => void;

  // First-Person Walk & Seated actions (§5b)
  sitAt: (seatId: string) => void;
  standUp: () => void;
  walkToSeat: (seatId: string) => void;
  teleportToRow: (row: string) => void;
  updateWalkPose: (pos: [number, number, number], eyeHeight: number, yaw: number, pitch: number) => void;
  setWalkSettings: (settings: Partial<WalkSettings>) => void;

  // Trailer controls (§5c)
  setTrailerState: (state: Partial<TrailerState>) => void;
  toggleTrailerPlay: () => void;
  toggleTrailerMute: () => void;

  enterPOV: (seatId: string) => void;
  exitPOV: () => void;
  navigatePOV: (direction: 'next' | 'prev' | 'nextRow' | 'prevRow') => void;

  setHouseLights: (mode: HouseLightsMode) => void;
  theatreLook: 'a' | 'b' | 'c';
  setTheatreLook: (look: 'a' | 'b' | 'c') => void;
  setQualityTier: (tier: QualityTier) => void;
  setQualityMode: (mode: QualityMode) => void;
  setContinuousRendering: (continuous: boolean) => void;
  setUseHqModel: (useHq: boolean) => void;

  toggleCompare: () => void;
  addToCompare: (seatId: string) => void;
  removeFromCompare: (seatId: string) => void;

  showToast: (message: string) => void;
  clearToast: () => void;
  setRendererInfo: (info: Partial<CinemaState['rendererInfo']>) => void;

  exportState: () => CineverseStateExport;
}

let toastTimer: any = null;

function getInitialQualityMode(): QualityMode {
  if (typeof window === 'undefined') return 'beautiful';
  try {
    const saved = localStorage.getItem('cineverse_quality_mode');
    if (saved === 'smooth' || saved === 'beautiful') return saved;
    if (window.innerWidth < 768 || ((navigator as any).hardwareConcurrency && (navigator as any).hardwareConcurrency <= 4)) {
      return 'smooth';
    }
  } catch (e) {}
  return 'beautiful';
}

const initialQuality = getInitialQualityMode();

function getInitialLightIntensity(): 'normal' | 'brighter' {
  if (typeof window !== 'undefined') {
    const fromStorage = localStorage.getItem('cineverse_light_intensity');
    if (fromStorage === 'normal' || fromStorage === 'brighter') {
      return fromStorage;
    }
  }
  return 'normal';
}

const initialLightIntensity = getInitialLightIntensity();

export const useCinemaStore = create<CinemaState>((set, get) => ({
  seatStatuses: {},
  seatPrices: {},
  tiers: [],
  selectedSeats: [],
  activeSeatId: null,
  hoveredSeatId: null,

  mode: 'overview',
  cameraMode: 'orbit',
  cameraPreset: 'overview',
  cameraPosition: DEFAULT_CAMERA_POS,
  cameraTarget: DEFAULT_CAMERA_TARGET,
  previousOrbitPose: {
    position: DEFAULT_CAMERA_POS,
    target: DEFAULT_CAMERA_TARGET,
  },
  fov: 60,

  walkPlayer: {
    position: [0.0, -0.025, -5.5],
    eyeHeight: 3.77,
    yaw: Math.PI, // Facing -Z toward seats
    pitch: 0.0,
    isRunning: false,
    isGrounded: true,
  },

  walkSettings: {
    sensitivity: 0.0022,
    invertY: false,
    fov: 70,
    headBob: false,
  },

  autoWalkTarget: null,

  trailer: {
    isPlaying: false,
    isMuted: true,
    volume: 0.75,
    trailerUrl: '',
    hasSpill: true,
  },

  houseLights: 'full',
  lightIntensity: initialLightIntensity,
  setLightIntensity: (intensity) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('cineverse_light_intensity', intensity);
      } catch (e) {}
    }
    set({ lightIntensity: intensity });
  },
  theatreLook: (typeof window !== 'undefined' ? (new URLSearchParams(window.location.search).get('look') as 'a' | 'b' | 'c') || 'a' : 'a'),
  setTheatreLook: (look) => set({ theatreLook: look }),
  qualityTier: initialQuality === 'smooth' ? 'low' : 'high',
  qualityMode: initialQuality,
  useHqModel: false,
  isContinuousRendering: false,

  isComparing: false,
  compareSeats: [],

  isHeatmapActive: false,
  toggleHeatmap: () => set((state) => ({ isHeatmapActive: !state.isHeatmapActive })),
  setHeatmapActive: (active) => set({ isHeatmapActive: active }),

  activeGroup: null,
  groupMemberMap: {},
  setActiveGroup: (group) => {
    if (!group) {
      set({ activeGroup: null, groupMemberMap: {} });
      return;
    }
    const memberMap: Record<string, any> = {};
    for (const m of group.members || []) {
      memberMap[m.user_id] = {
        userId: m.user_id,
        userName: m.user_name,
        initials: m.initials,
        color: m.color,
        proposedSeats: m.proposed_seats || [],
        assignedSeats: m.assigned_seats || [],
        role: m.role,
      };
    }
    set({ activeGroup: group, groupMemberMap: memberMap });
  },
  updateGroupMemberSeats: (userId, seats) => {
    set((state) => {
      const current = state.groupMemberMap[userId];
      if (!current) return state;
      return {
        groupMemberMap: {
          ...state.groupMemberMap,
          [userId]: {
            ...current,
            proposedSeats: seats,
          },
        },
      };
    });
  },

  toastMessage: null,
  lastBoundaryNoticeTime: 0,
  triggerBoundaryNotice: () => {
    const now = Date.now();
    if (now - get().lastBoundaryNoticeTime > 1400) {
      set({ lastBoundaryNoticeTime: now });
    }
  },

  // Audience Simulation (§ 4)
  showPeople: true,
  setShowPeople: (show) => set({ showPeople: show }),
  toggleShowPeople: () => set((state) => ({ showPeople: !state.showPeople })),

  // 4DX Experience Simulation (§ 8)
  experience4dxActive: false,
  setExperience4dxActive: (active) => set({ experience4dxActive: active }),
  experience4dxIntensity: 'medium',
  setExperience4dxIntensity: (intensity) => set({ experience4dxIntensity: intensity }),

  // Guided Tour & Presets (§ 9)
  tourActive: false,
  setTourActive: (active) => set({ tourActive: active }),
  tourStepIndex: 0,
  setTourStepIndex: (index) => set({ tourStepIndex: index }),

  // Multilingual Support (§ 9)
  selectedLanguage: 'en',
  setSelectedLanguage: (lang) => set({ selectedLanguage: lang }),

  // Settings Modal (§ 9)
  settingsModalOpen: false,
  setSettingsModalOpen: (open) => set({ settingsModalOpen: open }),

  rendererInfo: {
    triangles: 0,
    calls: 0,
    fps: 60,
    geometries: 0,
    textures: 0,
  },

  // Dynamic Auditorium Layout
  auditoriumId: '1',
  auditoriumName: 'Auditorium 1',
  screenType: 'Standard Flat',
  auditoriumLayout: layoutData as unknown as SeatLayoutFile,
  auditoriumWalkNav: walkNavData as unknown as WalkNavFile,
  cameraBounds: DEFAULT_AUDITORIUM_BOUNDS,
  targetBounds: DEFAULT_TARGET_BOUNDS,
  proceduralResult: null,

  setAuditoriumData: (auditoriumId, result, meta) => {
    if (!result) {
      set({
        auditoriumId,
        auditoriumName: meta?.name || `Auditorium ${auditoriumId}`,
        screenType: meta?.screenType || 'Standard Flat',
        proceduralResult: null,
        auditoriumLayout: layoutData as unknown as SeatLayoutFile,
        auditoriumWalkNav: walkNavData as unknown as WalkNavFile,
        cameraBounds: DEFAULT_AUDITORIUM_BOUNDS,
        targetBounds: DEFAULT_TARGET_BOUNDS,
      });
      return;
    }

    set({
      auditoriumId,
      auditoriumName: meta?.name || result.seatLayout.theatre_type_label || `Auditorium ${auditoriumId}`,
      screenType: meta?.screenType || result.seatLayout.screen?.name || 'Standard Flat',
      proceduralResult: result,
      auditoriumLayout: result.seatLayout,
      auditoriumWalkNav: result.walkNav,
      cameraBounds: result.geometry.cameraBounds,
      targetBounds: result.geometry.targetBounds,
      cameraPosition: result.geometry.defaultCameraPos,
      cameraTarget: result.geometry.defaultCameraTarget,
      walkPlayer: {
        ...get().walkPlayer,
        position: result.walkNav.player.spawn_position,
      },
    });
  },

  setSeatStatuses: (statuses) => set({ seatStatuses: statuses }),
  setSeatPrices: (prices) => set({ seatPrices: prices }),
  setTiers: (tiers) => set({ tiers }),

  updateSeatStatus: (seatId, status) =>
    set((state) => ({
      seatStatuses: {
        ...state.seatStatuses,
        [seatId]: status,
      },
    })),

  selectSeat: (seatId) => {
    const { seatStatuses, selectedSeats, showToast, auditoriumLayout } = get();
    const status = seatStatuses[seatId] || 'available';

    if (status === 'booked') {
      showToast(`Seat ${seatId} is already booked.`);
      return false;
    }

    if (status === 'held') {
      showToast(`Seat ${seatId} is currently held by another patron.`);
      return false;
    }

    if (selectedSeats.includes(seatId)) {
      return false;
    }

    // Check recliner pair
    const seatRec = auditoriumLayout?.seats?.find((s) => s.seat_id === seatId);
    const partnerId = seatRec?.pair_partner_id;

    if (partnerId && !selectedSeats.includes(partnerId)) {
      const partnerStatus = seatStatuses[partnerId] || 'available';
      if (partnerStatus === 'booked' || partnerStatus === 'held') {
        showToast(`Recliner ${seatId} requires partner ${partnerId}, which is currently ${partnerStatus}.`);
        return false;
      }
      if (selectedSeats.length + 2 > MAX_SELECTED_SEATS) {
        showToast(`Selecting this recliner pair exceeds the maximum ${MAX_SELECTED_SEATS} seats allowed.`);
        return false;
      }
      set({
        selectedSeats: [...selectedSeats, seatId, partnerId],
        activeSeatId: seatId,
      });
      showToast(`Recliners come in pairs, so ${partnerId} was added too`);
      return true;
    }

    if (selectedSeats.length >= MAX_SELECTED_SEATS) {
      showToast(`Maximum ${MAX_SELECTED_SEATS} seats allowed per booking.`);
      return false;
    }

    set({
      selectedSeats: [...selectedSeats, seatId],
      activeSeatId: seatId,
    });
    return true;
  },

  deselectSeat: (seatId) => {
    const { selectedSeats, auditoriumLayout, showToast } = get();
    const seatRec = auditoriumLayout?.seats?.find((s) => s.seat_id === seatId);
    const partnerId = seatRec?.pair_partner_id;

    if (partnerId && selectedSeats.includes(partnerId)) {
      set({
        selectedSeats: selectedSeats.filter((id) => id !== seatId && id !== partnerId),
      });
      showToast(`Deselected recliner pair ${seatId} and ${partnerId}`);
      return;
    }

    set({
      selectedSeats: selectedSeats.filter((id) => id !== seatId),
    });
  },

  toggleSeat: (seatId) => {
    const { selectedSeats, selectSeat, deselectSeat } = get();
    if (selectedSeats.includes(seatId)) {
      deselectSeat(seatId);
      return false;
    } else {
      return selectSeat(seatId);
    }
  },

  clearSelection: () => set({ selectedSeats: [] }),

  setActiveSeat: (seatId) => set({ activeSeatId: seatId }),

  setHoveredSeat: (seatId) => set({ hoveredSeatId: seatId }),

  setMode: (mode) => {
    const currentMode = get().mode;
    if (currentMode === mode) return;

    if (mode === 'overview') {
      set({
        mode: 'overview',
        cameraMode: 'orbit',
      });
    } else if (mode === 'walk') {
      const camPos = get().cameraPosition;
      const bounds = get().cameraBounds || DEFAULT_AUDITORIUM_BOUNDS;
      const targetX = 0.0; // center main aisle
      let targetZ = camPos ? camPos[2] : -12.0;
      targetZ = Math.max(bounds.minZ + 1.5, Math.min(bounds.maxZ - 1.5, targetZ));

      set({
        mode: 'walk',
        cameraMode: 'walk',
        walkPlayer: {
          ...get().walkPlayer,
          position: [targetX, 0.0, targetZ],
          yaw: 0.0, // facing screen
          pitch: 0.0,
        },
      });
    } else if (mode === 'seated') {
      const active = get().activeSeatId || 'E05';
      get().sitAt(active);
    }
  },

  setCameraMode: (camMode) => {
    if (camMode === 'orbit' || camMode === 'overview') {
      set({ mode: 'overview', cameraMode: 'orbit' });
    } else if (camMode === 'pov' || camMode === 'seated') {
      const active = get().activeSeatId || 'E05';
      get().sitAt(active);
    } else if (camMode === 'walk') {
      set({ mode: 'walk', cameraMode: 'walk' });
    }
  },

  setCameraPreset: (preset) => {
    let position: [number, number, number] = DEFAULT_CAMERA_POS;
    const target: [number, number, number] = DEFAULT_CAMERA_TARGET;

    switch (preset) {
      case 'overview':
        position = DEFAULT_CAMERA_POS;
        break;
      case 'front':
      case 'screen':
        position = [0.0, 4.0, -11.0];
        break;
      case 'back':
        position = [0.0, 8.5, -24.5];
        break;
      case 'aerial':
        position = [0.0, 10.2, -15.0];
        break;
      case 'balcony':
        position = [0.0, 9.8, -26.0];
        break;
      case 'top':
        position = [0.0, 15.0, -15.0];
        break;
      case 'picker':
        position = [0.0, 12.0, -21.0];
        break;
    }

    set({
      mode: 'overview',
      cameraMode: 'orbit',
      cameraPreset: preset,
      cameraPosition: position,
      cameraTarget: target,
    });
  },

  setCameraPose: (position, target) =>
    set({
      cameraPosition: position,
      cameraTarget: target,
    }),

  setFOV: (fov) => set({ fov }),

  // Seated Mode: transitions directly to exact seat eye position
  sitAt: (seatId) => {
    const layout = get().auditoriumLayout;
    const seat = layout.seats.find((s) => s.seat_id === seatId);
    if (!seat) return;

    set({
      mode: 'seated',
      cameraMode: 'pov',
      activeSeatId: seatId,
      autoWalkTarget: null,
      cameraPosition: seat.eye_position_gltf_y_up,
      cameraTarget: layout.screen.center_gltf_y_up,
    });
  },

  // Stand Up: returns to Walk Mode in aisle next to current seat row
  standUp: () => {
    const layout = get().auditoriumLayout;
    const active = get().activeSeatId || (layout.seats[0] ? layout.seats[0].seat_id : 'E05');
    const row = active.charAt(0);
    const allRows = Array.from(new Set(layout.seats.map((s) => s.row))).sort();
    const rowIndex = allRows.indexOf(row);
    const effectiveRowIdx = rowIndex >= 0 ? rowIndex : Math.floor(allRows.length / 2);
    const rowZ = -8.032 - effectiveRowIdx * 1.5;
    const groundY = 0.22 * effectiveRowIdx;

    set({
      mode: 'walk',
      cameraMode: 'walk',
      walkPlayer: {
        ...get().walkPlayer,
        position: [0.0, groundY, rowZ],
        eyeHeight: 3.77,
        yaw: 0.0, // facing screen (+Z)
        pitch: 0.0,
      },
    });
  },

  walkToSeat: (seatId) => {
    set({
      autoWalkTarget: seatId,
      activeSeatId: seatId,
    });
  },

  teleportToRow: (row) => {
    const layout = get().auditoriumLayout;
    const r = row.toUpperCase();
    const allRows = Array.from(new Set(layout.seats.map((s) => s.row))).sort();
    const rowIndex = allRows.indexOf(r);
    if (rowIndex === -1) return;

    const rowZ = -8.032 - rowIndex * 1.5;
    const groundY = 0.22 * rowIndex;

    set({
      mode: 'walk',
      cameraMode: 'walk',
      walkPlayer: {
        ...get().walkPlayer,
        position: [0.0, groundY, rowZ],
        eyeHeight: 3.77,
        yaw: 0.0, // facing +Z toward screen
      },
    });
  },

  updateWalkPose: (pos, eyeHeight, yaw, pitch) =>
    set((state) => ({
      walkPlayer: {
        ...state.walkPlayer,
        position: pos,
        eyeHeight,
        yaw,
        pitch,
      },
    })),

  setWalkSettings: (settings) =>
    set((state) => ({
      walkSettings: {
        ...state.walkSettings,
        ...settings,
      },
    })),

  setTrailerState: (state) =>
    set((s) => ({
      trailer: {
        ...s.trailer,
        ...state,
      },
    })),

  toggleTrailerPlay: () =>
    set((s) => ({
      trailer: { ...s.trailer, isPlaying: !s.trailer.isPlaying },
    })),

  toggleTrailerMute: () =>
    set((s) => ({
      trailer: { ...s.trailer, isMuted: !s.trailer.isMuted },
    })),

  enterPOV: (seatId) => {
    const currentMode = get().cameraMode;
    const currentPos = get().cameraPosition;
    const currentTarget = get().cameraTarget;

    if (currentMode === 'orbit') {
      set({
        previousOrbitPose: {
          position: currentPos,
          target: currentTarget,
        },
      });
    }

    get().sitAt(seatId);
  },

  exitPOV: () => {
    const prev = get().previousOrbitPose;
    set({
      mode: 'overview',
      cameraMode: 'orbit',
      cameraPosition: prev.position,
      cameraTarget: prev.target,
    });
  },

  navigatePOV: (direction) => {
    const { activeSeatId, selectedSeats, auditoriumLayout } = get();
    if (!activeSeatId) return;

    // If multiple seats are selected, cycle through user's selected seats first
    if (selectedSeats.length > 1 && (direction === 'next' || direction === 'prev')) {
      const selIdx = selectedSeats.indexOf(activeSeatId);
      if (selIdx !== -1) {
        const nextSelIdx =
          direction === 'next'
            ? (selIdx + 1) % selectedSeats.length
            : (selIdx - 1 + selectedSeats.length) % selectedSeats.length;
        get().sitAt(selectedSeats[nextSelIdx]);
        return;
      }
    }

    const row = activeSeatId.charAt(0);
    const num = parseInt(activeSeatId.slice(1), 10);
    const allRows = Array.from(new Set(auditoriumLayout.seats.map((s) => s.row))).sort();
    const rowIndex = allRows.indexOf(row);
    const rowSeats = auditoriumLayout.seats.filter((s) => s.row === row);
    const maxNumInRow = Math.max(...rowSeats.map((s) => s.number));

    let nextRow = row;
    let nextNum = num;

    if (direction === 'next') {
      if (num < maxNumInRow) nextNum = num + 1;
    } else if (direction === 'prev') {
      if (num > 1) nextNum = num - 1;
    } else if (direction === 'nextRow') {
      if (rowIndex < allRows.length - 1) nextRow = allRows[rowIndex + 1];
    } else if (direction === 'prevRow') {
      if (rowIndex > 0) nextRow = allRows[rowIndex - 1];
    }

    const newSeatId = `${nextRow}${nextNum.toString().padStart(2, '0')}`;
    if (newSeatId !== activeSeatId) {
      get().sitAt(newSeatId);
    }
  },

  setHouseLights: (mode) => set({ houseLights: mode }),

  setQualityTier: (tier) =>
    set({
      qualityTier: tier,
      qualityMode: tier === 'low' ? 'smooth' : 'beautiful',
    }),

  setQualityMode: (mode) => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('cineverse_quality_mode', mode);
      }
    } catch (e) {}
    set({
      qualityMode: mode,
      qualityTier: mode === 'smooth' ? 'low' : 'high',
    });
  },

  setContinuousRendering: (continuous) => {
    if (get().isContinuousRendering !== continuous) {
      set({ isContinuousRendering: continuous });
    }
  },

  setUseHqModel: (useHq) => set({ useHqModel: useHq }),

  toggleCompare: () => {
    const { isComparing, activeSeatId, compareSeats } = get();
    if (!isComparing) {
      const initial = compareSeats.length > 0 ? compareSeats : (activeSeatId ? [activeSeatId] : []);
      set({ isComparing: true, compareSeats: initial });
    } else {
      set({ isComparing: false });
    }
  },

  addToCompare: (seatId) => {
    const { compareSeats, showToast } = get();
    if (compareSeats.includes(seatId)) return;
    if (compareSeats.length >= 3) {
      showToast('Compare supports up to 3 seats at a time.');
      return;
    }
    set({ compareSeats: [...compareSeats, seatId] });
  },

  removeFromCompare: (seatId) => {
    set((state) => ({
      compareSeats: state.compareSeats.filter((id) => id !== seatId),
    }));
  },

  showToast: (message) => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toastMessage: message });
    toastTimer = setTimeout(() => {
      set({ toastMessage: null });
    }, 3200);
  },

  clearToast: () => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toastMessage: null });
  },

  setRendererInfo: (info) =>
    set((state) => ({
      rendererInfo: {
        ...state.rendererInfo,
        ...info,
      },
    })),

  exportState: () => {
    const state = get();
    return {
      mode: state.mode,
      theatreLook: state.theatreLook,
      cameraMode: state.cameraMode,
      cameraPreset: state.cameraPreset,
      isHeatmapActive: state.isHeatmapActive,
      cameraPosition: state.cameraPosition,
      cameraTarget: state.cameraTarget,
      fov: state.fov,
      activeSeatId: state.activeSeatId,
      selectedSeats: state.selectedSeats,
      hoveredSeatId: state.hoveredSeatId,
      houseLights: state.houseLights,
      qualityTier: state.qualityTier,
      qualityMode: state.qualityMode,
      useHqModel: state.useHqModel,
      walkPlayer: {
        position: state.walkPlayer.position,
        eyeHeight: state.walkPlayer.eyeHeight,
        yaw: state.walkPlayer.yaw,
        pitch: state.walkPlayer.pitch,
      },
      rendererInfo: state.rendererInfo,
    };
  },
}));

if (typeof window !== 'undefined') {
  (window as any).useCinemaStore = useCinemaStore;
}
