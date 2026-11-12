'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Compass, ArrowLeft, X,
  Ticket, AlertCircle, Loader2,
  Flame, Sparkles, Bell, ShieldCheck, UserCheck, ZoomIn, ZoomOut, RotateCcw, Users
} from 'lucide-react';
import { useCinemaStore } from '@/store/useCinemaStore';
import { useSeatData } from '@/hooks/useSeatData';
import { useSeatSocket } from '@/hooks/useSeatSocket';
import { holdSeats, updateHoldAddons, getShowtimeSeats, apiFetch, type ShowtimeSeatsResponse, type SeatInventoryItem } from '@/services/api';
import { FnbAddonModal } from '@/components/FnbAddonModal';
import layoutDataFallback from '@/public/models/seat_layout_v2.json';
import obstructionsData from '@/public/models/seat_obstructions.json';
import { getTheatreTypeDefinition } from '@/lib/theatreTypeRegistry';
import { viewScore, bestAvailable, type PreferenceType, type ScoredSeatInput } from '@/lib/seatScoring';
import { GroupBookingModal } from '@/components/group/GroupBookingModal';
import { GroupRoomBanner } from '@/components/group/GroupRoomBanner';
import { useFeatureFlags } from '@/store/useFeatureFlags';
import { Guided3DTour } from '@/components/extras/Guided3DTour';
import { SeatCompareModal } from '@/components/extras/SeatCompareModal';
import { ShareMyViewModal } from '@/components/extras/ShareMyViewModal';
import { HearItFromHereModal } from '@/components/extras/HearItFromHereModal';
import { VrSeatPreviewModal } from '@/components/extras/VrSeatPreviewModal';
import { MoviePoster } from '@/components/MoviePoster';
import type { SeatLayoutFile, SeatRecord } from '@/lib/types';

interface SeatMap2DProps {
  cinemaId?: string;
  auditoriumId?: string;
  showtimeId: string;
  onSwitchTo3D?: () => void;
  onSwitchToPOV?: (seatId: string) => void;
  has3DAsset?: boolean;
}

interface HoveredSeatInfo {
  seat_id: string;
  row: string;
  number: number;
  category: string;
  price: number;
  status: string;
  is_accessible?: boolean;
}

export function SeatMap2D({
  cinemaId,
  auditoriumId = '1',
  showtimeId,
  onSwitchTo3D,
  onSwitchToPOV,
  has3DAsset,
}: SeatMap2DProps) {
  const router = useRouter();
  const showtimeNum = parseInt(showtimeId, 10) || 1;

  // Global Zustand store for shared 2D/3D state
  const selectedSeats = useCinemaStore((s) => s.selectedSeats);
  const seatStatuses = useCinemaStore((s) => s.seatStatuses);
  const selectSeat = useCinemaStore((s) => s.selectSeat);
  const deselectSeat = useCinemaStore((s) => s.deselectSeat);
  const toggleSeat = useCinemaStore((s) => s.toggleSeat);
  const clearSelection = useCinemaStore((s) => s.clearSelection);
  const updateSeatStatus = useCinemaStore((s) => s.updateSeatStatus);
  const showToast = useCinemaStore((s) => s.showToast);
  const isHeatmapActive = useCinemaStore((s) => s.isHeatmapActive);
  const toggleHeatmap = useCinemaStore((s) => s.toggleHeatmap);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);

  // Phase 10 Group Session Store & Params
  const activeGroup = useCinemaStore((s) => s.activeGroup);
  const groupMemberMap = useCinemaStore((s) => s.groupMemberMap);
  const setActiveGroup = useCinemaStore((s) => s.setActiveGroup);
  const searchParams = useSearchParams();
  const groupIdParam = searchParams ? searchParams.get('groupId') : null;

  useEffect(() => {
    if (groupIdParam && (!activeGroup || activeGroup.id !== Number(groupIdParam))) {
      apiFetch<any>(`/groups/${groupIdParam}`)
        .then((g) => setActiveGroup(g))
        .catch(() => {});
    }
  }, [groupIdParam, activeGroup, setActiveGroup]);

  // Compute seatId -> group member representation
  const seatGroupMemberMap = useMemo(() => {
    const map = new Map<string, { initials: string; color: string; userName: string; isAssigned: boolean }>();
    if (!groupMemberMap) return map;
    for (const m of Object.values(groupMemberMap)) {
      for (const s of m.proposedSeats || []) {
        map.set(s, {
          initials: m.initials,
          color: m.color || '#E50914',
          userName: m.userName,
          isAssigned: false,
        });
      }
      for (const s of m.assignedSeats || []) {
        map.set(s, {
          initials: m.initials,
          color: m.color || '#E50914',
          userName: m.userName,
          isAssigned: true,
        });
      }
    }
    return map;
  }, [groupMemberMap]);

  // TanStack Query + WebSocket sync
  useSeatData(showtimeId);
  useSeatSocket({
    showtimeId,
    onSeatStatusChange: (seatId, status) => {
      updateSeatStatus(seatId, status);
    },
  });

  const [showtimeDetails, setShowtimeDetails] = useState<ShowtimeSeatsResponse | null>(null);
  const [holding, setHolding] = useState(false);
  const [activeHoldId, setActiveHoldId] = useState<string | null>(null);
  const [isFnbModalOpen, setIsFnbModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [focusedSeatId, setFocusedSeatId] = useState<string | null>(null);
  const focusedSeatIdRef = useRef<string | null>(null);
  const [showTechDetails, setShowTechDetails] = useState(false);

  // Hover Tooltip State (Compact non-interactive)
  const [hoveredSeat, setHoveredSeat] = useState<HoveredSeatInfo | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Phase 11 Smart Engine State
  const [partySize, setPartySize] = useState<number>(2);
  const [preference, setPreference] = useState<PreferenceType>('centre');
  const [isWaitlistModalOpen, setIsWaitlistModalOpen] = useState(false);
  const [waitlistStatus, setWaitlistStatus] = useState<any>(null);
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>('');

  // Optional Feature Flags (Part 2 Extras — Off by default)
  const {
    enableGuidedTour,
    enableSeatCompare,
    enableShareView,
    enableSoundPreview,
    enableVrPreview,
  } = useFeatureFlags();

  const [isTourOpen, setIsTourOpen] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isSoundOpen, setIsSoundOpen] = useState(false);
  const [isVrOpen, setIsVrOpen] = useState(false);

  // WebGL detection for "Explore in 3D" button visibility
  const [isWebGLSupported, setIsWebGLSupported] = useState(true);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).useCinemaStore = useCinemaStore;
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        setIsWebGLSupported(!!gl);
      } catch {
        setIsWebGLSupported(false);
      }
    }
  }, []);

  // Fetch showtime metadata and layout
  useEffect(() => {
    getShowtimeSeats(showtimeNum)
      .then((data) => setShowtimeDetails(data))
      .catch((err) => console.warn('Showtime load notice:', err));
  }, [showtimeNum]);

  // Authoritative 3D capability for this auditorium
  // Every auditorium has procedural 3D capability
  const has3D = true;

  // Idle prefetching for fast 3D POV transition (< 2s on warm cache)
  useEffect(() => {
    if (typeof window === 'undefined' || !isWebGLSupported || !has3D) return;

    const conn = (navigator as any).connection;
    if (conn?.saveData || conn?.effectiveType === '2g' || conn?.effectiveType === 'slow-2g') {
      return;
    }

    const prefetchAssets = () => {
      fetch('/models/cineverse_auditorium_v2.web.glb', { priority: 'low' }).catch(() => {});
      fetch('/models/seat_layout_v2.json', { priority: 'low' }).catch(() => {});
    };

    if ('requestIdleCallback' in window) {
      const handle = (window as any).requestIdleCallback(prefetchAssets, { timeout: 3000 });
      return () => (window as any).cancelIdleCallback(handle);
    } else {
      const timer = setTimeout(prefetchAssets, 1500);
      return () => clearTimeout(timer);
    }
  }, [isWebGLSupported, has3D]);

  // Navigate directly to 3D Seated POV for a specific seat
  const handleViewPOV = useCallback(
    (seatId: string) => {
      if (!has3D) {
        showToast('3D preview not available for this hall');
        return;
      }
      if (!isWebGLSupported) {
        showToast('WebGL not supported on this browser');
        return;
      }
      useCinemaStore.getState().sitAt(seatId);
      if (onSwitchToPOV) {
        onSwitchToPOV(seatId);
      } else {
        const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
        const search = typeof window !== 'undefined' ? window.location.search : '';
        const params = new URLSearchParams(search);
        params.set('mode', 'pov');
        params.set('seat', seatId);
        router.push(`${pathname}?${params.toString()}`);
      }
    },
    [has3D, isWebGLSupported, onSwitchToPOV, router, showToast]
  );

  // Global keyboard shortcut for 'V' when a seat is focused or selected
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'v' || e.key === 'V' || e.key === 'KeyV' || e.code === 'KeyV') {
        const activeDomSeat = (document.activeElement as HTMLElement)?.getAttribute('data-seat-id');
        const targetSeat = focusedSeatIdRef.current || activeDomSeat || focusedSeatId || selectedSeats[0];
        if (targetSeat) {
          e.preventDefault();
          handleViewPOV(targetSeat);
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [focusedSeatId, selectedSeats, handleViewPOV]);

  // Total seats count and big hall detection (> 200 seats)
  const totalSeatsCount = useMemo(() => {
    if (showtimeDetails?.seats && showtimeDetails.seats.length > 0) {
      return showtimeDetails.seats.length;
    }
    return 100;
  }, [showtimeDetails]);

  const isBigHall = totalSeatsCount > 200;

  // Zoom & Pan state for large/flagship halls
  const [zoom, setZoom] = useState<number>(isBigHall ? 0.8 : 1);
  useEffect(() => {
    if (isBigHall) {
      setZoom(0.8);
    } else {
      setZoom(1);
    }
  }, [isBigHall]);

  const handleZoomIn = () => setZoom((z) => Math.min(1.6, Math.round((z + 0.15) * 100) / 100));
  const handleZoomOut = () => setZoom((z) => Math.max(0.55, Math.round((z - 0.15) * 100) / 100));
  const handleZoomReset = () => setZoom(isBigHall ? 0.8 : 1);

  // Mini-map & scroll ref for 2D Seat Map
  const mapScrollContainerRef = useRef<HTMLDivElement>(null);
  const [isMiniMapExpanded, setIsMiniMapExpanded] = useState<boolean>(true);

  const handleMiniMapClick = useCallback((targetRow: string) => {
    const el = mapScrollContainerRef.current;
    if (!el) return;
    const rowEl = el.querySelector(`[data-row-id="${targetRow}"]`);
    if (rowEl) {
      rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  // Layout parsing: Dynamically build seatsList from showtimeDetails.seats or fallback
  const seatsList: ScoredSeatInput[] = useMemo(() => {
    if (showtimeDetails?.seats && showtimeDetails.seats.length > 0) {
      return showtimeDetails.seats.map((s) => {
        const dist = s.distance_to_screen || 10.0;
        const hOffset = s.horizontal_angle_deg || 0.0;
        const vAngle = s.vertical_angle_deg || 4.0;
        const hFov = Math.round(Math.min(75, Math.max(25, 450 / dist)));
        return {
          seat_id: s.seat_id,
          row: s.row,
          number: s.number,
          category: s.category,
          horizontal_offset_deg: hOffset,
          vertical_angle_deg: vAngle,
          screen_h_fov_deg: hFov,
          position_gltf_y_up: [hOffset * 0.1, 1.2, dist],
        };
      });
    }

    // Fallback to static 100-seat model layout
    const fallback = (layoutDataFallback as unknown as SeatLayoutFile).seats || [];
    return fallback.map((s) => ({
      seat_id: s.seat_id,
      row: s.row,
      number: s.number,
      category: s.category,
      horizontal_offset_deg: s.horizontal_offset_deg,
      vertical_angle_deg: s.vertical_angle_deg,
      screen_h_fov_deg: s.screen_h_fov_deg,
      position_gltf_y_up: s.position_gltf_y_up,
    }));
  }, [showtimeDetails?.seats]);

  // Map of seat_id -> server inventory item
  const seatInventoryMap = useMemo(() => {
    const map = new Map<string, SeatInventoryItem>();
    if (showtimeDetails?.seats) {
      for (const s of showtimeDetails.seats) {
        map.set(s.seat_id, s);
      }
    }
    return map;
  }, [showtimeDetails?.seats]);

  // Seat obstructions lookup
  const seatObstructions = useMemo(() => {
    return (obstructionsData as any).seats || {};
  }, []);

  // Aisles and Accessible Seats definitions from layout_data
  const aisles = useMemo(() => {
    if (showtimeDetails?.layout_data?.aisles) {
      return showtimeDetails.layout_data.aisles;
    }
    return [3, 7]; // Default 2 aisles for 100-seat hall
  }, [showtimeDetails?.layout_data]);

  const reclinerPairMap = useMemo(() => {
    const map = new Map<string, string>();
    const pairs = showtimeDetails?.layout_data?.recliner_pairs || [];
    for (const p of pairs) {
      if (Array.isArray(p) && p.length === 2) {
        map.set(p[0], p[1]);
        map.set(p[1], p[0]);
      }
    }
    return map;
  }, [showtimeDetails?.layout_data?.recliner_pairs]);

  const hasBalconyLevel = useMemo(() => {
    return !!(showtimeDetails?.layout_data?.has_balcony || showtimeDetails?.layout_data?.levels?.balcony);
  }, [showtimeDetails?.layout_data]);

  const balconyRowsSet = useMemo(() => {
    const bRows = showtimeDetails?.layout_data?.levels?.balcony?.rows || [];
    return new Set(bRows);
  }, [showtimeDetails?.layout_data]);

  const isRowCurved = useMemo(() => {
    return !!(showtimeDetails?.layout_data?.curve_radius);
  }, [showtimeDetails?.layout_data]);

  const isMotionHall = useMemo(() => {
    return Boolean(
      showtimeDetails?.layout_data?.is_motion_hall ||
      showtimeDetails?.layout_data?.motion_zone === 'all' ||
      showtimeDetails?.layout_data?.layout_signature === 'motion_pods' ||
      (showtimeDetails?.layout_data?.theatre_type && getTheatreTypeDefinition(showtimeDetails.layout_data.theatre_type).features.motion_seats) ||
      showtimeDetails?.layout_data?.theatre_type_label?.toLowerCase().includes('motion') ||
      showtimeDetails?.auditorium_name?.toLowerCase().includes('motion') ||
      showtimeDetails?.screen_type?.toLowerCase().includes('motion') ||
      showtimeDetails?.screen_type?.toLowerCase().includes('4dx')
    );
  }, [showtimeDetails]);

  const seatToPodMap = useMemo(() => {
    const map = new Map<string, string>();
    if (showtimeDetails?.layout_data?.pods) {
      for (const p of showtimeDetails.layout_data.pods) {
        for (const sId of p.seat_ids || []) {
          map.set(sId, p.pod_id);
        }
      }
    }
    if (showtimeDetails?.seats) {
      for (const s of showtimeDetails.seats) {
        if ((s as any).pod_id) {
          map.set(s.seat_id, (s as any).pod_id);
        }
      }
    }
    return map;
  }, [showtimeDetails]);

  const accessibleSeatsList = useMemo(() => {
    if (showtimeDetails?.layout_data?.accessible_seats) {
      return showtimeDetails.layout_data.accessible_seats;
    }
    return ['A01', 'A02'];
  }, [showtimeDetails?.layout_data]);

  // Build Dynamic Category Tiers from layout_data.category_bands or showtimeDetails.tiers
  const categoryTiers = useMemo(() => {
    // 1. If layout_data category_bands is present
    if (showtimeDetails?.layout_data?.category_bands && showtimeDetails.layout_data.category_bands.length > 0) {
      const bands = showtimeDetails.layout_data.category_bands;
      // We display tiers from furthest from screen (Premier) down to nearest (Front)
      // Reverse copy so Premier is at the top
      return [...bands].reverse().map((b) => {
        const catLower = b.category.toLowerCase();
        let name = b.category;
        if (catLower === 'premier') name = isMotionHall ? 'Premier Motion' : 'Premier Recliner';
        else if (catLower === 'prime') name = isMotionHall ? 'Prime Motion' : 'Prime Standard';
        else if (catLower === 'front') name = isMotionHall ? 'Front Motion' : 'Front Row';

        // Find price from first seat in this category
        let price = 380;
        const matchingSeat = showtimeDetails.seats.find((s) => s.category.toLowerCase() === catLower);
        if (matchingSeat) {
          price = matchingSeat.price;
        } else {
          const tierMatch = showtimeDetails.tiers?.find((t) => t.category.toLowerCase() === catLower);
          if (tierMatch) price = tierMatch.price;
        }

        const colorClass =
          catLower === 'premier'
            ? 'text-[#9F1239] border-[#9F1239]/30 bg-rose-50'
            : catLower === 'front'
            ? 'text-[#8D5B28] border-[#8D5B28]/30 bg-amber-50'
            : 'text-[#1E40AF] border-[#1E40AF]/30 bg-blue-50';

        const badgeColor =
          catLower === 'premier'
            ? 'bg-[#9F1239] text-white'
            : catLower === 'front'
            ? 'bg-[#8D5B28] text-white'
            : 'bg-[#1E40AF] text-white';

        // Order rows descending inside the tier (e.g. J, I, H)
        const sortedRows = [...b.rows].sort().reverse();

        return {
          name,
          category: catLower,
          price,
          colorClass,
          badgeColor,
          rows: sortedRows,
        };
      });
    }

    // 2. If showtimeDetails.tiers is present
    if (showtimeDetails?.tiers && showtimeDetails.tiers.length > 0) {
      return showtimeDetails.tiers.map((t) => {
        const cat = t.category.toLowerCase();
        let name = t.name;
        if (cat === 'premier') name = 'Premier Recliner';
        else if (cat === 'prime') name = 'Prime Standard';
        else if (cat === 'front') name = 'Front Row';

        const colorClass =
          cat === 'premier'
            ? 'text-[#9F1239] border-[#9F1239]/30 bg-rose-50'
            : cat === 'front'
            ? 'text-[#8D5B28] border-[#8D5B28]/30 bg-amber-50'
            : 'text-[#1E40AF] border-[#1E40AF]/30 bg-blue-50';

        const badgeColor =
          cat === 'premier'
            ? 'bg-[#9F1239] text-white'
            : cat === 'front'
            ? 'bg-[#8D5B28] text-white'
            : 'bg-[#1E40AF] text-white';

        return {
          name,
          category: cat,
          price: t.price,
          colorClass,
          badgeColor,
          rows: [...t.rows].reverse(),
        };
      });
    }

    // 3. Canonical database bands fallback
    return [
      {
        name: 'Premier Recliner',
        category: 'premier',
        price: 520,
        colorClass: 'text-[#9F1239] border-[#9F1239]/30 bg-rose-50',
        badgeColor: 'bg-[#9F1239] text-white',
        rows: ['J', 'I', 'H'],
      },
      {
        name: 'Prime Standard',
        category: 'prime',
        price: 380,
        colorClass: 'text-[#1E40AF] border-[#1E40AF]/30 bg-blue-50',
        badgeColor: 'bg-[#1E40AF] text-white',
        rows: ['G', 'F', 'E', 'D'],
      },
      {
        name: 'Front Row',
        category: 'front',
        price: 280,
        colorClass: 'text-[#8D5B28] border-[#8D5B28]/30 bg-amber-50',
        badgeColor: 'bg-[#8D5B28] text-white',
        rows: ['C', 'B', 'A'],
      },
    ];
  }, [showtimeDetails?.layout_data?.category_bands, showtimeDetails?.tiers, showtimeDetails?.seats]);

  // Group seats by row
  const rowSeats = useMemo(() => {
    const map: Record<string, ScoredSeatInput[]> = {};
    for (const seat of seatsList) {
      if (!map[seat.row]) {
        map[seat.row] = [];
      }
      map[seat.row].push(seat);
    }
    for (const r of Object.keys(map)) {
      map[r].sort((a, b) => a.number - b.number);
    }
    return map;
  }, [seatsList]);

  // Total price calculated server-authoritatively
  const totalPrice = useMemo(() => {
    return selectedSeats.reduce((acc, sId) => {
      const inv = seatInventoryMap.get(sId);
      const price = inv?.price ?? 380;
      return acc + price;
    }, 0);
  }, [selectedSeats, seatInventoryMap]);

  // Smart Best Available Engine (Phase 11) supporting 1 to 8 guests
  const handleSelectBestAvailable = useCallback(
    (count: number, pref: PreferenceType = preference) => {
      try {
        const result = bestAvailable(
          seatsList,
          seatStatuses,
          count,
          { preference: pref, aisleAfterNumbers: aisles }
        );

        if (!result || result.seatIds.length < count) {
          showToast('Could not find enough contiguous seats for this preference.');
          return;
        }

        clearSelection();
        result.seatIds.forEach((sId) => selectSeat(sId));
        const reasonsStr = result.reasons.join(', ');
        showToast(`Selected ${count} best seats: ${result.seatIds.join(', ')} (${reasonsStr})`);
      } catch (err: any) {
        showToast('Unable to find best seats at this time.');
      }
    },
    [seatsList, seatStatuses, preference, aisles, clearSelection, selectSeat, showToast]
  );

  const allRowsOrdered = useMemo(() => {
    return categoryTiers.flatMap((t) => t.rows);
  }, [categoryTiers]);

  const handleSeatToggle = useCallback((seatId: string) => {
    const inv = seatInventoryMap.get(seatId);
    const rawStatus = (seatStatuses[seatId] || inv?.status || 'AVAILABLE').toString().toLowerCase();
    const status = rawStatus === 'payment_pending' ? 'held' : rawStatus;
    const isBooked = status === 'booked';
    const isHeld = status === 'held';

    if (isBooked || isHeld) {
      const msg = `Seat ${seatId} is ${status} and cannot be selected. You can still preview its sightline.`;
      showToast(msg);
      setLiveAnnouncement(msg);
      return;
    }

    const partnerId = reclinerPairMap.get(seatId);
    if (partnerId) {
      const partnerStatus = (seatStatuses[partnerId] || seatInventoryMap.get(partnerId)?.status || 'AVAILABLE').toString().toLowerCase();
      if ((partnerStatus === 'booked' || partnerStatus === 'held') && !selectedSeats.includes(seatId)) {
        showToast(`Recliners come in pairs, but partner ${partnerId} is ${partnerStatus}.`);
        return;
      }
    }

    const s = seatsList.find((st) => st.seat_id === seatId);
    const currentlySelected = selectedSeats.includes(seatId);
    toggleSeat(seatId);

    const partnerOffset = partnerId ? (currentlySelected ? -2 : 2) : (currentlySelected ? -1 : 1);
    const newCount = Math.max(0, selectedSeats.length + partnerOffset);
    if (!currentlySelected && s) {
      setLiveAnnouncement(`Selected Row ${s.row}, seat ${s.number}${partnerId ? ` and pair partner ${partnerId}` : ''}. ${newCount} seat${newCount === 1 ? '' : 's'} selected.`);
    } else if (s) {
      setLiveAnnouncement(`Deselected Row ${s.row}, seat ${s.number}${partnerId ? ` and pair partner ${partnerId}` : ''}. ${newCount} seat${newCount === 1 ? '' : 's'} selected.`);
    }
  }, [seatInventoryMap, seatStatuses, reclinerPairMap, seatsList, selectedSeats, showToast, toggleSeat]);

  const handleGridArrowNavigation = useCallback((
    e: React.KeyboardEvent,
    s: ScoredSeatInput,
    seatsInRow: ScoredSeatInput[],
    seatId: string
  ) => {
    if (e.key === 'v' || e.key === 'V' || e.key === 'KeyV' || e.code === 'KeyV') {
      e.preventDefault();
      handleViewPOV(seatId);
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSeatToggle(seatId);
      return;
    }

    const idxInRow = seatsInRow.findIndex((item) => item.seat_id === seatId);
    const currentRowIdx = allRowsOrdered.indexOf(s.row);

    let targetSeatId: string | null = null;

    if (e.key === 'ArrowRight' && idxInRow < seatsInRow.length - 1) {
      e.preventDefault();
      targetSeatId = seatsInRow[idxInRow + 1].seat_id;
    } else if (e.key === 'ArrowLeft' && idxInRow > 0) {
      e.preventDefault();
      targetSeatId = seatsInRow[idxInRow - 1].seat_id;
    } else if (e.key === 'ArrowDown' && currentRowIdx < allRowsOrdered.length - 1) {
      e.preventDefault();
      const nextRow = allRowsOrdered[currentRowIdx + 1];
      const seatsInNext = rowSeats[nextRow] || [];
      if (seatsInNext.length > 0) {
        const closest = seatsInNext.reduce((prev, curr) =>
          Math.abs(curr.number - s.number) < Math.abs(prev.number - s.number) ? curr : prev
        );
        targetSeatId = closest.seat_id;
      }
    } else if (e.key === 'ArrowUp' && currentRowIdx > 0) {
      e.preventDefault();
      const prevRow = allRowsOrdered[currentRowIdx - 1];
      const seatsInPrev = rowSeats[prevRow] || [];
      if (seatsInPrev.length > 0) {
        const closest = seatsInPrev.reduce((prev, curr) =>
          Math.abs(curr.number - s.number) < Math.abs(prev.number - s.number) ? curr : prev
        );
        targetSeatId = closest.seat_id;
      }
    } else if (e.key === 'Home') {
      e.preventDefault();
      targetSeatId = seatsInRow[0].seat_id;
    } else if (e.key === 'End') {
      e.preventDefault();
      targetSeatId = seatsInRow[seatsInRow.length - 1].seat_id;
    }

    if (targetSeatId) {
      focusedSeatIdRef.current = targetSeatId;
      setFocusedSeatId(targetSeatId);
      const targetEl = document.querySelector<HTMLButtonElement>(`[data-testid="seat-2d-${targetSeatId}"]`);
      targetEl?.focus();
    }
  }, [allRowsOrdered, handleSeatToggle, handleViewPOV, rowSeats]);

  const handleFindAccessibleSeats = useCallback(() => {
    const accessibleSeats = seatsList.filter((s) => {
      const inv = seatInventoryMap.get(s.seat_id);
      const rawStatus = (seatStatuses[s.seat_id] || inv?.status || 'AVAILABLE').toString().toLowerCase();
      const isAvail = rawStatus === 'available';
      return (s.is_accessible || accessibleSeatsList.includes(s.seat_id) || inv?.is_accessible) && isAvail;
    });

    const anyAccessible = accessibleSeats.length > 0
      ? accessibleSeats[0]
      : seatsList.find((s) => s.is_accessible || accessibleSeatsList.includes(s.seat_id));

    if (anyAccessible) {
      const target = anyAccessible;
      focusedSeatIdRef.current = target.seat_id;
      setFocusedSeatId(target.seat_id);
      setHoveredSeat({
        seat_id: target.seat_id,
        row: target.row,
        number: target.number,
        category: target.category || 'Wheelchair Space',
        price: seatInventoryMap.get(target.seat_id)?.price ?? 280,
        status: 'available',
        is_accessible: true,
      });
      const companion = seatsList.find((s) => s.row === target.row && Math.abs(s.number - target.number) === 1);
      setLiveAnnouncement(
        `Found accessible seats. Focused on Row ${target.row}, seat ${target.number} (Wheelchair space). ${
          companion ? `Companion seat ${companion.row}${companion.number} is adjacent.` : ''
        }`
      );
      setTimeout(() => {
        const el = document.querySelector<HTMLButtonElement>(`[data-testid="seat-2d-${target.seat_id}"]`);
        el?.focus();
      }, 50);
      showToast(`Focused on accessible seat ${target.seat_id}. Companion seat available adjacent.`);
    } else {
      setLiveAnnouncement('No wheelchair accessible seats currently available for this showtime.');
      showToast('No wheelchair accessible seats currently available for this showtime.');
    }
  }, [accessibleSeatsList, seatInventoryMap, seatStatuses, seatsList, showToast]);

  // Handle Waitlist Join
  const handleJoinWaitlist = async () => {
    setWaitlistLoading(true);
    try {
      const res = await fetch(`/api/v1/showtimes/${showtimeNum}/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ desired_seats_count: partySize }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to join waitlist');
      }
      setWaitlistStatus(data);
      showToast(data.message || 'Joined waitlist successfully!');
    } catch (err: any) {
      showToast(err.message || 'Could not join waitlist. Please check login.');
    } finally {
      setWaitlistLoading(false);
    }
  };

  // Hold Seats & Proceed
  async function handleProceed() {
    if (selectedSeats.length === 0) return;
    setHolding(true);
    setErrorMessage(null);
    try {
      const res = await holdSeats(showtimeNum, selectedSeats);
      setActiveHoldId(res.hold_id);
      setIsFnbModalOpen(true);
    } catch (err: any) {
      console.warn('Hold error:', err);
      setErrorMessage(err.message || 'Failed to hold seats. Someone may have just reserved them.');
    } finally {
      setHolding(false);
    }
  }

  async function handleCompleteCheckout(selectedAddons: { fnb_item_id: number; quantity: number }[]) {
    setIsFnbModalOpen(false);
    if (!activeHoldId) return;
    try {
      if (selectedAddons.length > 0) {
        await updateHoldAddons(activeHoldId, selectedAddons);
      }
    } catch (err) {
      console.warn('Failed to update hold addons:', err);
    }
    router.push(`/checkout?hold_id=${activeHoldId}`);
  }

  // Focused seat for inspection card
  const focusedSeat = focusedSeatId ? seatsList.find((s) => s.seat_id === focusedSeatId) : null;
  const serverFocusedSeat = focusedSeatId ? seatInventoryMap.get(focusedSeatId) : null;
  const focusedPrice = serverFocusedSeat?.price ?? 380;
  const focusedCategory = (serverFocusedSeat?.category ?? focusedSeat?.category ?? 'Prime').toUpperCase();
  const focusedScore = focusedSeat ? viewScore(focusedSeat) : null;
  const focusedObstruction = focusedSeatId ? seatObstructions[focusedSeatId] : null;

  return (
    <div
      className="min-h-screen bg-[#FFF8F1] text-[#1B1320] p-4 sm:p-8 pb-48 select-none focus:outline-none"
      data-testid="seatmap-2d-container"
      tabIndex={0}
    >
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Numbered 3-Step Flow at top */}
        <div className="rounded-2xl border border-[#E6DCD2] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between max-w-xl mx-auto">
            {/* Step 1 */}
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                ✓
              </span>
              <span className="text-sm font-semibold text-slate-700">1. Show</span>
            </div>

            <div className="h-0.5 flex-1 mx-3 bg-[#E6DCD2]" />

            {/* Step 2 */}
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#C8102E] text-xs font-bold text-white shadow-sm">
                2
              </span>
              <span className="text-sm font-bold text-[#C8102E]">2. Seats</span>
            </div>

            <div className="h-0.5 flex-1 mx-3 bg-[#E6DCD2]" />

            {/* Step 3 */}
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">
                3
              </span>
              <span className="text-sm font-medium text-slate-500">3. Pay</span>
            </div>
          </div>
        </div>

        {/* Header navigation bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#E6DCD2] pb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E6DCD2] bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:text-[#1B1320] hover:bg-slate-50 transition shadow-sm"
              aria-label="Back to showtimes"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </button>

            {/* Movie Poster thumbnail on Seat Page */}
            <div className="h-16 w-12 rounded-xl overflow-hidden shrink-0 border border-[#E6DCD2] shadow-sm bg-[#FDEBD8] hidden sm:block">
              <MoviePoster
                src={showtimeDetails?.poster_url || '/posters/quantum-odyssey.webp'}
                alt={showtimeDetails?.movie_title || 'Movie Poster'}
                title={showtimeDetails?.movie_title || 'Movie'}
                className="h-full w-full object-cover"
                containerClassName="h-full w-full"
              />
            </div>

            <div>
              <h1 className="text-2xl font-black text-[#1B1320] flex items-center gap-3">
                <span>{showtimeDetails?.movie_title || 'Quantum Odyssey'}</span>
                <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-rose-100 text-[#9F1239] border border-rose-200">
                  {showtimeDetails?.screen_type || 'IMAX 3D Laser'}
                </span>
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                {showtimeDetails?.cinema_name || 'CineVerse Astral Koramangala'} • {showtimeDetails?.auditorium_name || 'Auditorium 1'} ({totalSeatsCount} seats)
              </p>
            </div>
          </div>

          {/* Action Tools: Heatmap Toggle & Explore in 3D */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Find Accessible Seats Shortcut (WCAG 2.2 AA) */}
            <button
              onClick={handleFindAccessibleSeats}
              data-testid="find-accessible-seats-btn"
              className="flex min-h-[44px] items-center gap-2 rounded-xl border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-900 shadow-sm hover:bg-blue-100 transition active:scale-95"
              aria-label="Find Accessible Seats: wheelchair and companion spaces"
            >
              <span className="text-base" aria-hidden="true">♿</span>
              <span>Find Accessible Seats</span>
            </button>

            {/* Book With Friends Button (Phase 10) */}
            <button
              onClick={() => setIsGroupModalOpen(true)}
              data-testid="book-with-friends-btn"
              className="flex min-h-[44px] items-center gap-2 rounded-xl bg-gradient-to-r from-[#C8102E] to-rose-700 px-4 py-2 text-sm font-bold text-white shadow-md hover:from-rose-700 hover:to-rose-800 transition active:scale-95"
            >
              <Users className="h-4 w-4" />
              <span>Book with friends</span>
            </button>

            {/* Comfort Heatmap Toggle */}
            <button
              onClick={toggleHeatmap}
              className={`flex min-h-[44px] items-center gap-2 rounded-xl border-2 px-4 py-2 text-sm font-bold shadow-sm transition ${
                isHeatmapActive
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-400/50'
                  : 'bg-white text-slate-700 border-[#E6DCD2] hover:bg-slate-50'
              }`}
              data-testid="toggle-heatmap-btn"
              aria-label="Toggle Viewing Comfort Heatmap"
            >
              <Flame className={`h-4 w-4 ${isHeatmapActive ? 'text-amber-200 fill-amber-200' : 'text-emerald-600'}`} />
              <span>{isHeatmapActive ? 'Comfort Heatmap: ON' : 'Comfort Heatmap'}</span>
            </button>

            {/* Explore in 3D Button */}
            {onSwitchTo3D && (
              <button
                onClick={onSwitchTo3D}
                className="flex min-h-[44px] items-center gap-2 rounded-xl bg-amber-500/10 border-2 border-amber-500 px-5 py-2 text-sm font-bold text-amber-900 shadow hover:bg-amber-500/20 transition"
                data-testid="explore-in-3d-button"
                aria-label="Explore in 3D: Switch to 3D Auditorium Sightline View"
              >
                <Compass className="h-4 w-4 text-amber-600 animate-spin-slow" />
                <span>Explore in 3D</span>
              </button>
            )}

            {/* Optional Extras (Part 2) behind Feature Flags */}
            {enableGuidedTour && (
              <button
                type="button"
                onClick={() => setIsTourOpen(true)}
                data-testid="guided-tour-btn"
                className="flex min-h-[44px] items-center gap-2 rounded-xl border border-purple-300 bg-purple-50 px-4 py-2 text-sm font-bold text-purple-900 shadow-sm hover:bg-purple-100 transition active:scale-95"
              >
                <span>3D Tour (30s)</span>
              </button>
            )}

            {enableSeatCompare && (
              <button
                type="button"
                onClick={() => setIsCompareOpen(true)}
                data-testid="seat-compare-btn"
                className="flex min-h-[44px] items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-900 shadow-sm hover:bg-amber-100 transition active:scale-95"
              >
                <span>Compare Seats</span>
              </button>
            )}

            {enableShareView && (
              <button
                type="button"
                onClick={() => setIsShareOpen(true)}
                data-testid="share-view-btn"
                className="flex min-h-[44px] items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-bold text-[#C8102E] shadow-sm hover:bg-rose-100 transition active:scale-95"
              >
                <span>Share View</span>
              </button>
            )}

            {enableSoundPreview && (
              <button
                type="button"
                onClick={() => setIsSoundOpen(true)}
                data-testid="sound-preview-btn"
                className="flex min-h-[44px] items-center gap-2 rounded-xl border border-purple-300 bg-purple-50 px-4 py-2 text-sm font-bold text-purple-900 shadow-sm hover:bg-purple-100 transition active:scale-95"
              >
                <span>Hear From Here</span>
              </button>
            )}

            {enableVrPreview && (
              <button
                type="button"
                onClick={() => setIsVrOpen(true)}
                data-testid="vr-preview-btn"
                className="flex min-h-[44px] items-center gap-2 rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-900 shadow-sm hover:bg-indigo-100 transition active:scale-95"
              >
                <span>VR Preview</span>
              </button>
            )}
          </div>
        </div>

        {/* Phase 11: Best Available Smart Engine & Preference Bar (1–8 seats) */}
        <div className="rounded-3xl border border-[#E6DCD2] bg-white p-5 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-[#E6DCD2] pb-4">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-2xl bg-rose-100 flex items-center justify-center text-[#C8102E]">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-[#1B1320]">Pick best seats for me</h3>
                <p className="text-xs text-slate-500">Picks optimal contiguous same-row seats based on viewing angle & distance</p>
              </div>
            </div>

            {/* Party Size (1 to 8) & Preference Controls */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1 bg-[#FAF6F0] p-1 rounded-xl border border-[#E6DCD2]">
                <span className="text-xs font-bold text-slate-500 px-2">Guests:</span>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((cnt) => (
                  <button
                    key={cnt}
                    onClick={() => {
                      setPartySize(cnt);
                      handleSelectBestAvailable(cnt, preference);
                    }}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                      partySize === cnt
                        ? 'bg-[#C8102E] text-white shadow-sm'
                        : 'text-slate-700 hover:bg-rose-50'
                    }`}
                    data-testid={`btn-best-${cnt}`}
                    aria-label={`Select ${cnt} best seats`}
                  >
                    {cnt}
                  </button>
                ))}
              </div>

              {/* Preference Dropdown */}
              <div className="flex items-center gap-2">
                <select
                  value={preference}
                  onChange={(e) => {
                    const pref = e.target.value as PreferenceType;
                    setPreference(pref);
                    handleSelectBestAvailable(partySize, pref);
                  }}
                  className="rounded-xl border border-[#E6DCD2] bg-[#FAF6F0] px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
                  data-testid="seat-preference-select"
                  aria-label="Seat Selection Viewing Preference"
                >
                  <option value="centre">Direct Centre View</option>
                  <option value="balanced">Balanced Viewing Angle</option>
                  <option value="sit_back">Sit Back (Distance)</option>
                  <option value="no_neck_strain">Low Elevation / No Neck Strain</option>
                  <option value="aisle">Aisle Seats Preferred</option>
                  <option value="accessible">Accessible / Front Lane</option>
                </select>
              </div>

              {/* FIFO Waitlist Trigger */}
              <button
                onClick={() => setIsWaitlistModalOpen(true)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm"
                data-testid="open-waitlist-btn"
                title="Join FIFO waitlist for sold-out showtimes"
              >
                <Bell className="h-3.5 w-3.5 text-[#C8102E]" />
                <span>Notify / Waitlist</span>
              </button>
            </div>
          </div>
        </div>

        {/* Phase 10: Group Booking Active Session Room Banner */}
        <GroupRoomBanner showtimeId={Number(showtimeId)} />

        {/* Motion-seat Hall Indicator & Features Banner */}
        {isMotionHall && (
          <div
            data-testid="motion-seats-banner"
            className="flex items-center justify-between gap-3 px-5 py-3 rounded-2xl bg-gradient-to-r from-cyan-950 via-slate-900 to-cyan-950 text-cyan-200 border border-cyan-800/60 shadow-lg text-xs md:text-sm font-semibold mb-2"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-2.5 w-2.5 rounded-full bg-cyan-400 animate-ping" />
              <span className="text-white font-black tracking-wide uppercase">Motion seats</span>
              <span className="text-cyan-300 hidden sm:inline">— Synchronized motion pods &amp; environmental effects (wind, mist, scent)</span>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-cyan-900/80 text-cyan-200 border border-cyan-700/50 text-[11px] font-bold uppercase tracking-wider">
              {showtimeDetails?.auditorium_name || 'Motion-seat Hall'}
            </span>
          </div>
        )}

        {/* Curved Screen Banner with ambient glow */}
        <div className="pt-2 pb-6 flex flex-col items-center">
          <div className="h-2.5 w-4/5 max-w-xl rounded-full bg-gradient-to-r from-transparent via-[#C8102E] to-transparent shadow-lg shadow-rose-200/60" />
          <span className="text-xs uppercase tracking-widest text-slate-500 font-black mt-3">
            ▔▔▔▔▔ SCREEN THIS WAY ▔▔▔▔▔
          </span>
        </div>

        {/* Legend */}
        {isHeatmapActive ? (
          <div
            className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 text-xs text-slate-700 border-2 border-emerald-500/40 bg-emerald-50/60 rounded-3xl shadow-sm"
            data-testid="heatmap-legend"
          >
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                <Flame className="h-4 w-4 text-emerald-600 fill-emerald-600" />
                Viewing Comfort Heatmap:
              </span>
              <div className="flex items-center gap-1.5">
                <span className="h-4 w-4 rounded-md bg-emerald-600 text-white flex items-center justify-center font-bold text-[9px]">90</span>
                <span className="font-semibold text-emerald-900">80–100 High Comfort</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-4 w-4 rounded-md bg-amber-500 text-white flex items-center justify-center font-bold text-[9px]">70</span>
                <span className="font-semibold text-amber-900">65–79 Good Sightline</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-4 w-4 rounded-md bg-orange-500 text-white flex items-center justify-center font-bold text-[9px]">55</span>
                <span className="font-semibold text-orange-900">&lt;65 Standard Angle</span>
              </div>
            </div>
            <div className="text-[11px] text-slate-500 italic max-w-md text-right">
              Viewing comfort estimate based on geometric angles and screen field of view. Not a physical cinema measurement.
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4 py-3 px-6 text-sm text-slate-700 border border-[#E6DCD2] bg-white rounded-2xl shadow-sm">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded-lg border-2 border-[#E6DCD2] bg-[#FAF6F0]" />
                <span className="font-medium text-xs sm:text-sm">Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded-lg bg-[#C8102E] text-white flex items-center justify-center text-xs font-bold shadow-sm">
                  ✓
                </div>
                <span className="font-bold text-xs sm:text-sm text-[#C8102E]">Selected</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded-lg border-2 border-amber-400 bg-amber-100" />
                <span className="font-semibold text-xs sm:text-sm text-amber-800">Held</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded-lg bg-slate-300 opacity-60 cursor-not-allowed" />
                <span className="text-xs sm:text-sm text-slate-400">Sold</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-blue-100 text-blue-700 border border-blue-300 text-xs font-bold">
                  ♿
                </span>
                <span className="text-xs sm:text-sm text-blue-900 font-semibold">Accessible</span>
              </div>
            </div>

            {/* Zoom Controls for large auditoriums */}
            <div className="flex items-center gap-1.5 bg-[#FAF6F0] p-1 rounded-xl border border-[#E6DCD2]" data-testid="zoom-controls">
              <span className="text-xs font-bold text-slate-500 px-1.5">Zoom: {Math.round(zoom * 100)}%</span>
              <button
                onClick={handleZoomOut}
                aria-label="Zoom Out"
                title="Zoom Out"
                className="h-7 w-7 rounded-lg bg-white border border-[#E6DCD2] hover:bg-slate-100 flex items-center justify-center font-black text-slate-700 shadow-xs"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={handleZoomReset}
                aria-label="Reset Zoom"
                title="Reset Zoom"
                className="px-2 h-7 rounded-lg bg-white border border-[#E6DCD2] hover:bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-700 shadow-xs"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                <span>Reset</span>
              </button>
              <button
                onClick={handleZoomIn}
                aria-label="Zoom In"
                title="Zoom In"
                className="h-7 w-7 rounded-lg bg-white border border-[#E6DCD2] hover:bg-slate-100 flex items-center justify-center font-black text-slate-700 shadow-xs"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* 2D Seat Matrix (Zoomable & Pannable for large halls) */}
        <div ref={mapScrollContainerRef} className="relative w-full overflow-x-auto pb-6 pt-2">
          {/* Multi-Block Header Bar for triple block / multi-aisle arrangements */}
          {showtimeDetails?.layout_data?.blocks_pattern && showtimeDetails.layout_data.blocks_pattern.length > 1 && (
            <div className="flex items-center justify-center gap-3 sm:gap-6 text-[11px] font-black uppercase tracking-wider text-slate-500 py-2 mb-2" data-testid="block-headers">
              {showtimeDetails.layout_data.blocks_pattern.map((count: number, bIdx: number) => {
                const totalBlocks = showtimeDetails.layout_data?.blocks_pattern?.length ?? 0;
                const label = totalBlocks === 3
                  ? (bIdx === 0 ? 'Left Wing' : bIdx === 1 ? 'Centre Stalls' : 'Right Wing')
                  : `Section ${String.fromCharCode(65 + bIdx)}`;
                return (
                  <span key={bIdx} className="px-3 py-1 rounded-xl bg-slate-100 border border-slate-200 shadow-xs">
                    {label} ({count} seats)
                  </span>
                );
              })}
            </div>
          )}

          <div
            role="grid"
            data-testid="seatmap-grid"
            aria-label="2D Auditorium Seat Selection Map"
            className="space-y-8 py-2 min-w-max mx-auto flex flex-col items-center transition-transform duration-150 origin-top"
            style={{ transform: zoom !== 1 ? `scale(${zoom})` : undefined }}
          >
            {categoryTiers.map((tier) => (
              <div
                key={tier.name}
                className="w-full space-y-3 rounded-3xl border border-[#E6DCD2] bg-white p-6 shadow-sm"
              >
                {/* Category Header with Authentic Pricing */}
                <div className="flex items-center justify-between border-b border-[#E6DCD2] pb-3 px-2">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-base text-[#1B1320]">{tier.name}</span>
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                      (Rows {tier.rows[tier.rows.length - 1]}–{tier.rows[0]})
                    </span>
                    {hasBalconyLevel && tier.rows.some((r) => balconyRowsSet.has(r)) && (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-black uppercase tracking-wider">
                        Balcony Tier
                      </span>
                    )}
                  </div>
                  <span className="font-black text-lg text-[#C8102E]">₹{Math.round(tier.price)}</span>
                </div>

                {/* Rows */}
                <div className="space-y-3 pt-2">
                  {tier.rows.map((row) => {
                    const seatsInRow = rowSeats[row] || [];
                    const isBalconyRow = balconyRowsSet.has(row);
                    const midIndex = (seatsInRow.length + 1) / 2;
                    return (
                      <div key={row} role="row" data-row-id={row} className="flex items-center justify-center gap-2 sm:gap-3">
                        {/* Left Row Label */}
                        <span className="w-8 shrink-0 text-center text-sm font-black text-slate-500 flex items-center justify-center gap-1">
                          {row}
                          {isBalconyRow && <span className="text-[9px] text-amber-700 font-black">B</span>}
                        </span>

                        {/* Seats in Row (curved as an arc when curve_radius is active) */}
                        <div className="flex items-center">
                          {seatsInRow.map((s) => {
                            const seatId = s.seat_id;
                            const inv = seatInventoryMap.get(seatId);
                            const rawStatus = (seatStatuses[seatId] || inv?.status || 'AVAILABLE').toString().toLowerCase();
                            const status = rawStatus === 'payment_pending' ? 'held' : rawStatus;
                            const isSelected = selectedSeats.includes(seatId);
                            const isHeld = status === 'held';
                            const isBooked = status === 'booked';
                            const isFocused = focusedSeatId === seatId;
                            const isAccessible = s.seat_id in accessibleSeatsList || accessibleSeatsList.includes(s.seat_id) || inv?.is_accessible;
                            const partnerId = reclinerPairMap.get(seatId);
                            const isRecliner = !!partnerId;

                            // Compute comfort score for this seat
                            const scored = viewScore(s);
                            const score = scored.score;
                            const seatPrice = inv?.price ?? tier.price;

                            let bgClass = 'border-[#E6DCD2] bg-[#FAF6F0] text-[#1B1320] hover:border-[#C8102E] hover:bg-rose-50';
                            if (isSelected) {
                              bgClass = 'border-[#C8102E] bg-[#C8102E] text-white shadow-md scale-105 font-black ring-2 ring-rose-300';
                            } else if (isHeatmapActive) {
                              if (score >= 80) {
                                bgClass = 'border-emerald-700 bg-emerald-600 text-white font-black shadow-sm';
                              } else if (score >= 65) {
                                bgClass = 'border-amber-600 bg-amber-500 text-white font-black shadow-sm';
                              } else {
                                bgClass = 'border-orange-600 bg-orange-500 text-white font-black shadow-sm';
                              }
                            } else if (isHeld) {
                              bgClass = 'border-amber-400 bg-amber-100 text-amber-900 cursor-not-allowed opacity-80';
                            } else if (isBooked) {
                              bgClass = 'border-slate-200 bg-slate-200 text-slate-400 cursor-not-allowed opacity-60';
                            }

                            // Curved arc vertical sag (dipping down at edges for realism)
                            const arcOffset = isRowCurved && midIndex > 0 ? Math.round(Math.pow((s.number - midIndex) / midIndex, 2) * 14) : 0;

                            // Aisle gap margin
                            const hasAisleAfter = aisles.includes(s.number);

                            // Motion pod grouping
                            const podId = isMotionHall ? seatToPodMap.get(seatId) : null;
                            const sIndexInRow = seatsInRow.indexOf(s);
                            const nextSeat = sIndexInRow < seatsInRow.length - 1 ? seatsInRow[sIndexInRow + 1] : null;
                            const nextPodId = nextSeat && isMotionHall ? seatToPodMap.get(nextSeat.seat_id) : null;
                            const isPodEnd = Boolean(podId && nextPodId && podId !== nextPodId);

                            const groupMember = seatGroupMemberMap.get(seatId);

                            const statusWord = isSelected ? 'selected' : (isBooked ? 'booked' : (isHeld ? 'held' : 'available'));
                            const accessibleKind = isAccessible ? ', accessible wheelchair space' : (s.is_companion ? ', companion seat' : '');
                            const reclinerKind = isRecliner ? `, recliner pair with ${partnerId}` : '';
                            const motionKind = podId ? `, Motion pod ${podId}` : '';
                            const accessibleName = `Row ${s.row}, seat ${s.number}, ${tier.name}, ${Math.round(seatPrice)} rupees, ${statusWord}${accessibleKind}${reclinerKind}${motionKind}`;

                            return (
                              <div
                                key={seatId}
                                role="gridcell"
                                aria-selected={isSelected}
                                style={arcOffset ? { transform: `translateY(${arcOffset}px)` } : undefined}
                                className={`relative flex items-center justify-center p-1 ${
                                  hasAisleAfter
                                    ? 'mr-5 sm:mr-8 md:mr-10'
                                    : isPodEnd
                                      ? 'mr-3.5 sm:mr-5 md:mr-6'
                                      : ''
                                } ${isMotionHall && podId ? 'rounded-lg bg-cyan-950/5' : ''}`}
                              >
                                <button
                                  type="button"
                                  aria-pressed={isSelected}
                                  aria-disabled={isBooked || isHeld}
                                  aria-label={accessibleName}
                                  onClick={() => {
                                    focusedSeatIdRef.current = seatId;
                                    setFocusedSeatId(seatId);
                                    handleSeatToggle(seatId);
                                  }}
                                  onFocus={(e) => {
                                    focusedSeatIdRef.current = seatId;
                                    setFocusedSeatId(seatId);
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
                                    setHoveredSeat({
                                      seat_id: seatId,
                                      row: s.row,
                                      number: s.number,
                                      category: s.category || tier.name,
                                      price: seatPrice,
                                      status: status,
                                      is_accessible: isAccessible,
                                    });
                                  }}
                                  onMouseEnter={(e) => {
                                    focusedSeatIdRef.current = seatId;
                                    setFocusedSeatId(seatId);
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
                                    setHoveredSeat({
                                      seat_id: seatId,
                                      row: s.row,
                                      number: s.number,
                                      category: s.category || tier.name,
                                      price: seatPrice,
                                      status: status,
                                      is_accessible: isAccessible,
                                    });
                                  }}
                                  onMouseLeave={() => setHoveredSeat(null)}
                                  onKeyDown={(e) => handleGridArrowNavigation(e, s, seatsInRow, seatId)}
                                  className={`h-9 w-9 sm:h-10 sm:w-10 min-w-[36px] min-h-[36px] rounded-xl border-2 text-sm font-bold flex items-center justify-center transition-all duration-150 relative touch-manipulation before:absolute before:-inset-1 before:min-w-[44px] before:min-h-[44px] before:content-[''] focus-visible:ring-4 focus-visible:ring-[#C8102E] focus-visible:ring-offset-2 outline-none ${bgClass} ${
                                    isFocused ? 'ring-2 ring-[#C8102E]' : ''
                                  } ${tier.category === 'premier' ? 'rounded-2xl' : ''}`}
                                  data-testid={`seat-2d-${seatId}`}
                                  data-seat-id={seatId}
                                  data-status={isSelected ? 'selected' : status}
                                  data-score={score}
                                >
                                  {isSelected ? '✓' : (isBooked ? '✕' : (isHeld ? '⏳' : (isHeatmapActive ? Math.round(score) : s.number)))}
                                  {isAccessible && !isSelected && (
                                    <span
                                      title="Wheelchair Accessible Seat"
                                      className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white font-bold ring-1 ring-white"
                                    >
                                      ♿
                                    </span>
                                  )}
                                  {isRecliner && !isAccessible && !isSelected && (
                                    <span
                                      title={`Recliner Pair with ${partnerId}`}
                                      className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#9F1239] text-[8px] text-white font-black ring-1 ring-white"
                                    >
                                      2
                                    </span>
                                  )}
                                  {s.is_companion && !isSelected && (
                                    <span
                                      title="Companion Seat"
                                      className="absolute -top-1.5 -left-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-purple-600 text-[9px] text-white font-bold ring-1 ring-white"
                                    >
                                      C
                                    </span>
                                  )}
                                  {groupMember && (
                                    <span
                                      title={`Seat selected by ${groupMember.userName}`}
                                      data-testid={`group-seat-badge-${seatId}`}
                                      className="absolute -bottom-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black text-white ring-1 ring-white shadow-sm"
                                      style={{ backgroundColor: groupMember.color }}
                                    >
                                      {groupMember.initials}
                                    </span>
                                  )}
                                </button>
                              </div>
                            );
                          })}
                        </div>

                        {/* Right Row Label */}
                        <span className="w-8 shrink-0 text-center text-sm font-black text-slate-500">
                          {row}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Interactive Floating Mini-Map for rapid navigation across large halls */}
        <div
          data-testid="interactive-minimap"
          className="fixed bottom-24 right-6 z-30 hidden lg:flex flex-col rounded-2xl border-2 border-[#E6DCD2] bg-white/95 p-3 shadow-xl backdrop-blur-md transition-all duration-200"
          style={{ width: isMiniMapExpanded ? 200 : 48 }}
        >
          <div className="flex items-center justify-between gap-2 border-b border-[#E6DCD2] pb-1.5 mb-1.5">
            {isMiniMapExpanded && (
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-700">Hall Mini-Map</span>
            )}
            <button
              onClick={() => setIsMiniMapExpanded((prev) => !prev)}
              className="ml-auto text-slate-500 hover:text-slate-800 text-xs font-bold p-1 rounded-lg hover:bg-slate-100"
              title={isMiniMapExpanded ? 'Minimize Mini-Map' : 'Expand Mini-Map'}
              data-testid="toggle-minimap-btn"
            >
              {isMiniMapExpanded ? '−' : '🗺️'}
            </button>
          </div>

          {isMiniMapExpanded && (
            <div className="space-y-1.5">
              {/* Screen arc representation */}
              <div className="h-1.5 w-full rounded-full bg-slate-300 mx-auto" title="Screen" />
              <span className="block text-center text-[9px] font-bold text-slate-400 uppercase tracking-widest">Screen</span>

              {/* Rows thumbnail */}
              <div className="relative py-1 flex flex-col gap-1 items-center max-h-52 overflow-y-auto">
                {allRowsOrdered.map((rowName) => {
                  const seats = rowSeats[rowName] || [];
                  const isBalcony = balconyRowsSet.has(rowName);
                  return (
                    <div
                      key={rowName}
                      onClick={() => handleMiniMapClick(rowName)}
                      className={`flex items-center justify-center gap-0.5 cursor-pointer hover:bg-rose-50 px-1 py-0.5 rounded transition w-full ${
                        isBalcony ? 'border-t border-amber-200' : ''
                      }`}
                      title={`Jump to Row ${rowName}${isBalcony ? ' (Balcony)' : ''}`}
                    >
                      <span className="text-[8px] font-mono font-bold text-slate-400 w-3 text-right mr-1">
                        {rowName}
                      </span>
                      <div className="flex items-center gap-0.5 flex-wrap justify-center max-w-[130px]">
                        {seats.map((st) => {
                          const isSel = selectedSeats.includes(st.seat_id);
                          const inv = seatInventoryMap.get(st.seat_id);
                          const isBk = (seatStatuses[st.seat_id] || inv?.status || '').toString().toLowerCase() === 'booked';
                          return (
                            <div
                              key={st.seat_id}
                              className={`h-1.5 w-1.5 rounded-full ${
                                isSel ? 'bg-[#C8102E]' : isBk ? 'bg-slate-400' : 'bg-slate-200'
                              }`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="text-[9px] text-center text-slate-400 font-medium pt-1 border-t border-[#E6DCD2]">
                Click row to pan
              </div>
            </div>
          )}
        </div>

        {/* Compact Non-Interactive Hover Tooltip */}
        {hoveredSeat && (
          <div
            role="tooltip"
            data-testid="seat-tooltip"
            className="pointer-events-none fixed z-50 rounded-xl bg-[#1B1320] text-white px-3.5 py-2 shadow-2xl text-xs border border-white/10 -translate-x-1/2 -translate-y-full mb-2 animate-in fade-in zoom-in-95 duration-100"
            style={{ top: tooltipPos.y - 8, left: tooltipPos.x }}
          >
            <div className="font-bold text-sm text-white flex items-center gap-1.5">
              <span>Seat {hoveredSeat.seat_id}</span>
              <span className="text-slate-400">•</span>
              <span className="text-rose-300 font-semibold">{hoveredSeat.category}</span>
              {hoveredSeat.is_accessible && <span className="text-blue-400">♿</span>}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-300">
              <span className="font-bold text-white">₹{Math.round(hoveredSeat.price)}</span>
              <span>•</span>
              <span className="capitalize font-semibold">{hoveredSeat.status}</span>
            </div>
          </div>
        )}

        {/* Phase 11: Seat Inspection & Obstruction Details Card */}
        {focusedSeat && (
          <div
            className="rounded-3xl border border-[#E6DCD2] bg-white p-5 shadow-sm space-y-3"
            data-testid="seat-inspection-card"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#E6DCD2] pb-3">
              <div className="flex items-center gap-3">
                <span className="text-xl font-black text-[#1B1320]">
                  Seat {focusedSeat.seat_id} ({focusedCategory})
                </span>
                <span className="text-sm font-bold text-[#C8102E]">
                  ₹{Math.round(focusedPrice)}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200">
                  {((seatStatuses[focusedSeat.seat_id] || serverFocusedSeat?.status || 'available').toString().toLowerCase() === 'payment_pending' ? 'held' : (seatStatuses[focusedSeat.seat_id] || serverFocusedSeat?.status || 'available')).toString().toLowerCase()}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => handleViewPOV(focusedSeat.seat_id)}
                  data-testid="see-view-from-seat-btn"
                  className="flex min-h-[44px] items-center gap-2 rounded-xl border-2 border-[#1B1320] bg-white px-4 py-2 text-sm font-bold text-[#1B1320] shadow-sm hover:bg-slate-50 transition active:scale-95"
                  title={`See 3D Seated POV from seat ${focusedSeat.seat_id}`}
                >
                  <Compass className="h-4 w-4 text-[#C8102E]" />
                  <span>See view from this seat</span>
                </button>

                {enableShareView && (
                  <button
                    type="button"
                    onClick={() => setIsShareOpen(true)}
                    data-testid="open-share-view-btn"
                    className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2 text-sm font-bold text-[#C8102E] shadow-sm hover:bg-rose-100 transition active:scale-95"
                  >
                    <span>Share View</span>
                  </button>
                )}

                {enableSoundPreview && (
                  <button
                    type="button"
                    onClick={() => setIsSoundOpen(true)}
                    data-testid="open-sound-preview-btn"
                    className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-purple-300 bg-purple-50 px-3.5 py-2 text-sm font-bold text-purple-900 shadow-sm hover:bg-purple-100 transition active:scale-95"
                  >
                    <span>Hear From Here</span>
                  </button>
                )}
              </div>
            </div>

            {/* Geometry & Viewing Comfort Inspection */}
            {focusedScore && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                <div className="rounded-2xl bg-[#FAF6F0] p-3 border border-[#E6DCD2]">
                  <span className="text-slate-500 block font-semibold">Sightline Comfort Score</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      data-testid="seat-comfort-score-badge"
                      className="text-lg font-black text-[#1B1320]"
                    >
                      {Math.round(focusedScore.score)}/100
                    </span>
                    <span className="text-xs text-slate-500">
                      ({focusedScore.score >= 80 ? 'Optimal' : focusedScore.score >= 65 ? 'Good' : 'Standard'})
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl bg-[#FAF6F0] p-3 border border-[#E6DCD2]">
                  <span className="text-slate-500 block font-semibold">Distance & Angles</span>
                  <p className="font-bold text-[#1B1320] mt-1">
                    Screen dist: {Math.round(focusedSeat.position_gltf_y_up?.[2] || 10)}m • Offset: {Math.round(Math.abs(focusedSeat.horizontal_offset_deg))}°
                  </p>
                </div>

                <div className="rounded-2xl bg-[#FAF6F0] p-3 border border-[#E6DCD2]">
                  <span className="text-slate-500 block font-semibold">Screen Visibility</span>
                  <p className="font-bold text-[#1B1320] mt-1" data-testid="seat-visibility-pct">
                    {focusedObstruction ? `${focusedObstruction.clear_view_pct}% unobstructed` : '100% Unobstructed view'}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1 leading-tight">
                    Geometric raycast estimate against static theatre geometry only. No audience members or physical heads modelled.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error notification banner */}
        {errorMessage && (
          <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Sticky Summary & Checkout Footer */}
        {selectedSeats.length > 0 && (
          <div
            className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-3xl px-4 z-40"
            data-testid="seatmap-2d-summary-footer"
          >
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-3xl border border-[#E6DCD2] bg-white p-5 shadow-2xl backdrop-blur-md">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <Ticket className="h-5 w-5 text-[#C8102E]" />
                  <span>Selected ({selectedSeats.length}):</span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {selectedSeats.map((id) => (
                    <span
                      key={id}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-bold text-[#9F1239] flex items-center gap-1.5"
                    >
                      <span>{id}</span>
                      {has3D && isWebGLSupported && (
                        <button
                          onClick={() => handleViewPOV(id)}
                          data-testid={`view-pov-${id}`}
                          className="flex items-center gap-0.5 rounded px-1 text-[11px] font-semibold text-[#C8102E] hover:bg-rose-100 hover:underline transition"
                          title={`View from seat ${id}`}
                          aria-label={`View 3D perspective from seat ${id}`}
                        >
                          <Compass className="h-3 w-3" />
                          <span>View</span>
                        </button>
                      )}
                      <button
                        onClick={() => deselectSeat(id)}
                        className="text-rose-500 hover:text-rose-800 ml-0.5"
                        aria-label={`Remove seat ${id}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-5 w-full sm:w-auto justify-between sm:justify-end">
                <div className="text-right">
                  <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">Total</span>
                  <div className="text-2xl font-black text-[#C8102E]">₹{Math.round(totalPrice)}</div>
                </div>

                <button
                  onClick={handleProceed}
                  disabled={holding}
                  className="min-h-[48px] rounded-2xl bg-[#C8102E] px-6 py-3 text-base font-bold text-white shadow-xl hover:bg-[#A60D26] transition flex items-center gap-2 disabled:opacity-50"
                  data-testid="proceed-to-checkout-btn"
                >
                  {holding ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Holding Seats...</span>
                    </>
                  ) : (
                    <span>Proceed to Pay</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Waitlist Modal */}
        {isWaitlistModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-3xl border border-[#E6DCD2] bg-white p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#E6DCD2] pb-3">
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-[#C8102E]" />
                  <h3 className="text-lg font-black text-[#1B1320]">Fair FIFO Waitlist</h3>
                </div>
                <button
                  onClick={() => setIsWaitlistModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                  aria-label="Close Waitlist"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="text-xs text-slate-600">
                When seats are released due to cancellation or hold expiration, subscribers are notified in strict first-come order with a 10-minute claim window.
              </p>

              {waitlistStatus ? (
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-900 space-y-2">
                  <div className="font-bold flex items-center gap-1.5 text-sm text-emerald-800">
                    <UserCheck className="h-4 w-4" />
                    <span>Registered on Waitlist</span>
                  </div>
                  <p>• Queue Position: <span className="font-bold">{waitlistStatus.queue_position || 1}</span></p>
                  <p>• Desired Seats: <span className="font-bold">{waitlistStatus.desired_seats_count}</span></p>
                  <p>• Status: <span className="font-bold">{waitlistStatus.status}</span></p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Number of Seats Desired
                    </label>
                    <select
                      value={partySize}
                      onChange={(e) => setPartySize(parseInt(e.target.value, 10))}
                      className="w-full rounded-xl border border-[#E6DCD2] bg-[#FAF6F0] p-2 text-sm font-bold text-slate-800"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                        <option key={n} value={n}>
                          {n} {n === 1 ? 'Seat' : 'Seats'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={handleJoinWaitlist}
                    disabled={waitlistLoading}
                    className="w-full min-h-[44px] rounded-xl bg-[#C8102E] py-2.5 text-sm font-bold text-white shadow hover:bg-[#A60D26] transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {waitlistLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Join FIFO Waitlist'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* F&B Addons Modal */}
        <FnbAddonModal
          isOpen={isFnbModalOpen}
          onClose={() => setIsFnbModalOpen(false)}
          onProceed={handleCompleteCheckout}
        />

        {/* Group Booking Modal (Phase 10) */}
        <GroupBookingModal
          isOpen={isGroupModalOpen}
          onClose={() => setIsGroupModalOpen(false)}
          showtimeId={Number(showtimeId)}
        />

        {/* Optional Extras (Part 2) Modals */}
        {enableGuidedTour && (
          <Guided3DTour
            isOpen={isTourOpen}
            onClose={() => setIsTourOpen(false)}
            cinemaName={showtimeDetails?.cinema_name}
            auditoriumName={showtimeDetails?.auditorium_name}
          />
        )}

        {enableSeatCompare && (
          <SeatCompareModal
            isOpen={isCompareOpen}
            onClose={() => setIsCompareOpen(false)}
            availableSeats={seatsList.map((s) => s.seat_id)}
            initialSeats={selectedSeats.length > 0 ? selectedSeats : ['E05', 'F06', 'A02']}
            onSelectSeat={(sId) => handleSeatToggle(sId)}
          />
        )}

        {enableShareView && (focusedSeat || seatsList[0]) && (
          <ShareMyViewModal
            isOpen={isShareOpen}
            onClose={() => setIsShareOpen(false)}
            seatId={(focusedSeat || seatsList[0]).seat_id}
            movieTitle={showtimeDetails?.movie_title}
            cinemaName={showtimeDetails?.cinema_name}
            auditoriumName={showtimeDetails?.auditorium_name}
          />
        )}

        {enableSoundPreview && (focusedSeat || seatsList[0]) && (
          <HearItFromHereModal
            isOpen={isSoundOpen}
            onClose={() => setIsSoundOpen(false)}
            seatId={(focusedSeat || seatsList[0]).seat_id}
            distanceMeters={Math.round((focusedSeat || seatsList[0]).position_gltf_y_up?.[2] || 12)}
            offsetDeg={Math.round((focusedSeat || seatsList[0]).horizontal_offset_deg || 0)}
          />
        )}

        {enableVrPreview && (focusedSeat || seatsList[0]) && (
          <VrSeatPreviewModal
            isOpen={isVrOpen}
            onClose={() => setIsVrOpen(false)}
            seatId={(focusedSeat || seatsList[0]).seat_id}
          />
        )}

        {/* Screen Reader Live Announcements (WCAG 4.1.3 Status Messages) */}
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
          data-testid="seat-map-announcer"
        >
          {liveAnnouncement}
        </div>
      </div>
    </div>
  );
}
