import { create } from 'zustand';
import type {
  SeatStatus,
  CameraMode,
  CameraPreset,
  HouseLightsMode,
  QualityTier,
  CineverseStateExport,
} from '@/lib/types';
import type { TierSummaryItem } from '@/services/api';
import layoutData from '@/public/models/seat_layout_v2.json';
import walkNavData from '@/public/models/walk_nav_v2.json';

export const MAX_SELECTED_SEATS = 8;
export const DEFAULT_CAMERA_POS: [number, number, number] = [0.0, 8.5, -22.5];
export const DEFAULT_CAMERA_TARGET: [number, number, number] = [0.0, 4.0, -8.0];

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
  qualityTier: QualityTier;
  useHqModel: boolean;

  // Comparison
  isComparing: boolean;
  compareSeats: string[];

  // Phase 11 Viewing Comfort Heatmap
  isHeatmapActive: boolean;
  toggleHeatmap: () => void;
  setHeatmapActive: (active: boolean) => void;

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
  theatreLook: (typeof window !== 'undefined' ? (new URLSearchParams(window.location.search).get('look') as 'a' | 'b' | 'c') || 'a' : 'a'),
  setTheatreLook: (look) => set({ theatreLook: look }),
  qualityTier: 'high',
  useHqModel: false,

  isComparing: false,
  compareSeats: [],

  isHeatmapActive: false,
  toggleHeatmap: () => set((state) => ({ isHeatmapActive: !state.isHeatmapActive })),
  setHeatmapActive: (active) => set({ isHeatmapActive: active }),

  toastMessage: null,
  lastBoundaryNoticeTime: 0,
  triggerBoundaryNotice: () => {
    const now = Date.now();
    if (now - get().lastBoundaryNoticeTime > 1400) {
      set({ lastBoundaryNoticeTime: now });
    }
  },

  rendererInfo: {
    triangles: 0,
    calls: 0,
    fps: 60,
    geometries: 0,
    textures: 0,
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
    const { seatStatuses, selectedSeats, showToast } = get();
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
    const { selectedSeats } = get();
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
      set({
        mode: 'walk',
        cameraMode: 'walk',
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
        position = [0.0, 4.0, -11.0];
        break;
      case 'back':
        position = [0.0, 8.5, -24.5];
        break;
      case 'aerial':
        position = [0.0, 10.2, -15.0];
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
    const seat = (layoutData as any).seats.find((s: any) => s.seat_id === seatId);
    if (!seat) return;

    set({
      mode: 'seated',
      cameraMode: 'pov',
      activeSeatId: seatId,
      autoWalkTarget: null,
      cameraPosition: seat.eye_position_gltf_y_up,
      cameraTarget: (layoutData as any).screen.center_gltf_y_up,
    });
  },

  // Stand Up: returns to Walk Mode in aisle next to current seat row
  standUp: () => {
    const active = get().activeSeatId || 'E05';
    const row = active.charAt(0);
    const rowIndex = 'ABCDEFGHIJ'.indexOf(row);
    const rowZ = -8.85 - (rowIndex >= 0 ? rowIndex : 4) * 1.5;
    const groundY = 0.22 * (rowIndex >= 0 ? rowIndex : 4);

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
    const r = row.toUpperCase();
    const rowIndex = 'ABCDEFGHIJ'.indexOf(r);
    if (rowIndex === -1) return;

    const rowZ = -8.85 - rowIndex * 1.5;
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
    const { activeSeatId } = get();
    if (!activeSeatId) return;

    const row = activeSeatId.charAt(0);
    const num = parseInt(activeSeatId.slice(1), 10);
    const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    const rowIndex = rows.indexOf(row);

    let nextRow = row;
    let nextNum = num;

    if (direction === 'next') {
      if (num < 10) nextNum = num + 1;
    } else if (direction === 'prev') {
      if (num > 1) nextNum = num - 1;
    } else if (direction === 'nextRow') {
      if (rowIndex < rows.length - 1) nextRow = rows[rowIndex + 1];
    } else if (direction === 'prevRow') {
      if (rowIndex > 0) nextRow = rows[rowIndex - 1];
    }

    const newSeatId = `${nextRow}${nextNum.toString().padStart(2, '0')}`;
    if (newSeatId !== activeSeatId) {
      get().sitAt(newSeatId);
    }
  },

  setHouseLights: (mode) => set({ houseLights: mode }),

  setQualityTier: (tier) => set({ qualityTier: tier }),

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
