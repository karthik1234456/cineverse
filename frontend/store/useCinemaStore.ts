import { create } from 'zustand';
import type {
  SeatStatus,
  CameraMode,
  CameraPreset,
  HouseLightsMode,
  QualityTier,
  CineverseStateExport,
} from '@/lib/types';

export const MAX_SELECTED_SEATS = 8;
export const DEFAULT_CAMERA_POS: [number, number, number] = [6.5, 8.5, -23.0];
export const DEFAULT_CAMERA_TARGET: [number, number, number] = [0.0, 5.55, -1.255];

export interface CinemaState {
  // Seat state
  seatStatuses: Record<string, SeatStatus>;
  selectedSeats: string[];
  activeSeatId: string | null;
  hoveredSeatId: string | null;

  // Camera & Navigation
  cameraMode: CameraMode;
  cameraPreset: CameraPreset;
  cameraPosition: [number, number, number];
  cameraTarget: [number, number, number];
  previousOrbitPose: {
    position: [number, number, number];
    target: [number, number, number];
  };
  fov: number; // 50 | 60 | 75

  // Environment & Realism
  houseLights: HouseLightsMode;
  qualityTier: QualityTier;
  useHqModel: boolean;

  // Comparison
  isComparing: boolean;
  compareSeats: string[];

  // Feedback & Toast
  toastMessage: string | null;

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
  updateSeatStatus: (seatId: string, status: SeatStatus) => void;
  selectSeat: (seatId: string) => boolean;
  deselectSeat: (seatId: string) => void;
  toggleSeat: (seatId: string) => boolean;
  clearSelection: () => void;
  setActiveSeat: (seatId: string | null) => void;
  setHoveredSeat: (seatId: string | null) => void;

  setCameraMode: (mode: CameraMode) => void;
  setCameraPreset: (preset: CameraPreset) => void;
  setCameraPose: (position: [number, number, number], target: [number, number, number]) => void;
  setFOV: (fov: number) => void;

  enterPOV: (seatId: string) => void;
  exitPOV: () => void;
  navigatePOV: (direction: 'next' | 'prev' | 'nextRow' | 'prevRow') => void;

  setHouseLights: (mode: HouseLightsMode) => void;
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
  selectedSeats: [],
  activeSeatId: 'F05',
  hoveredSeatId: null,

  cameraMode: 'orbit',
  cameraPreset: 'overview',
  cameraPosition: DEFAULT_CAMERA_POS,
  cameraTarget: DEFAULT_CAMERA_TARGET,
  previousOrbitPose: {
    position: DEFAULT_CAMERA_POS,
    target: DEFAULT_CAMERA_TARGET,
  },
  fov: 60,

  houseLights: 'full',
  qualityTier: 'high',
  useHqModel: false,

  isComparing: false,
  compareSeats: [],

  toastMessage: null,

  rendererInfo: {
    triangles: 0,
    calls: 0,
    fps: 60,
    geometries: 0,
    textures: 0,
  },

  setSeatStatuses: (statuses) => set({ seatStatuses: statuses }),

  updateSeatStatus: (seatId, status) =>
    set((state) => ({
      seatStatuses: {
        ...state.seatStatuses,
        [seatId]: status,
      },
    })),

  selectSeat: (seatId) => {
    const { seatStatuses, selectedSeats, showToast } = get();
    const currentStatus = seatStatuses[seatId] || 'available';

    if (currentStatus === 'booked') {
      showToast(`Seat ${seatId} is already booked.`);
      return false;
    }

    if (currentStatus === 'held') {
      showToast(`Seat ${seatId} is currently held by another user.`);
      return false;
    }

    if (selectedSeats.includes(seatId)) {
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
    set((state) => ({
      selectedSeats: state.selectedSeats.filter((id) => id !== seatId),
    }));
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

  setCameraMode: (mode) => set({ cameraMode: mode }),

  setCameraPreset: (preset) => {
    let position: [number, number, number] = DEFAULT_CAMERA_POS;
    const target: [number, number, number] = DEFAULT_CAMERA_TARGET;

    switch (preset) {
      case 'overview':
        position = [6.5, 8.5, -23.0];
        break;
      case 'front':
        position = [0.0, 4.0, -11.0];
        break;
      case 'back':
        position = [0.0, 8.5, -24.5];
        break;
      case 'aerial':
        // Top-down view in real 3D scene (not a 2D diagram)
        position = [0.0, 10.2, -15.0];
        break;
    }

    set({
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

    set({
      cameraMode: 'pov',
      activeSeatId: seatId,
    });
  },

  exitPOV: () => {
    const prev = get().previousOrbitPose;
    set({
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
      set({ activeSeatId: newSeatId });
    }
  },

  setHouseLights: (mode) => set({ houseLights: mode }),

  setQualityTier: (tier) => set({ qualityTier: tier }),

  setUseHqModel: (useHq) => set({ useHqModel: useHq }),

  toggleCompare: () => {
    const { isComparing, activeSeatId, compareSeats } = get();
    if (!isComparing) {
      const initial = activeSeatId ? [activeSeatId] : [];
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
      cameraMode: state.cameraMode,
      cameraPosition: state.cameraPosition,
      cameraTarget: state.cameraTarget,
      fov: state.fov,
      activeSeatId: state.activeSeatId,
      selectedSeats: state.selectedSeats,
      hoveredSeatId: state.hoveredSeatId,
      houseLights: state.houseLights,
      qualityTier: state.qualityTier,
      useHqModel: state.useHqModel,
      rendererInfo: state.rendererInfo,
    };
  },
}));

