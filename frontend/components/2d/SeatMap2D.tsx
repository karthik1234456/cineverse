'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Compass, ArrowLeft, X,
  Ticket, AlertCircle, Loader2, ChevronDown, ChevronUp,
  Flame, Sparkles, Bell, Info, ShieldCheck, UserCheck
} from 'lucide-react';
import { useCinemaStore } from '@/store/useCinemaStore';
import { useSeatData } from '@/hooks/useSeatData';
import { useSeatSocket } from '@/hooks/useSeatSocket';
import { holdSeats, getShowtimeSeats, type ShowtimeSeatsResponse } from '@/services/api';
import { FnbAddonModal } from '@/components/FnbAddonModal';
import layoutData from '@/public/models/seat_layout_v2.json';
import obstructionsData from '@/public/models/seat_obstructions.json';
import { viewScore, bestAvailable, type PreferenceType } from '@/lib/seatScoring';
import type { SeatLayoutFile, SeatRecord } from '@/lib/types';

interface SeatMap2DProps {
  cinemaId?: string;
  auditoriumId?: string;
  showtimeId: string;
  onSwitchTo3D?: () => void;
  has3DAsset?: boolean;
}

export function SeatMap2D({
  showtimeId,
  onSwitchTo3D,
  has3DAsset = true,
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
  const [showTechDetails, setShowTechDetails] = useState(false);

  // Phase 11 Smart Engine State
  const [partySize, setPartySize] = useState<number>(2);
  const [preference, setPreference] = useState<PreferenceType>('centre');
  const [isWaitlistModalOpen, setIsWaitlistModalOpen] = useState(false);
  const [waitlistStatus, setWaitlistStatus] = useState<any>(null);
  const [waitlistLoading, setWaitlistLoading] = useState(false);

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

  // Idle prefetching for fast 3D POV transition (< 2s on warm cache)
  useEffect(() => {
    if (typeof window === 'undefined' || !isWebGLSupported) return;

    // Honor user data preferences
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
  }, [isWebGLSupported]);

  // Navigate directly to 3D Seated POV for a specific seat
  const handleViewPOV = useCallback(
    (seatId: string) => {
      if (!isWebGLSupported) return;
      const params = new URLSearchParams(window.location.search);
      params.set('mode', 'pov');
      params.set('seat', seatId);
      router.push(`?${params.toString()}`);
    },
    [isWebGLSupported, router]
  );

  // Fetch showtime metadata
  useEffect(() => {
    getShowtimeSeats(showtimeNum)
      .then((data) => setShowtimeDetails(data))
      .catch((err) => console.warn('Showtime load notice:', err));
  }, [showtimeNum]);

  // Layout parsing via authoritative geometric seatMapLayout
  const seatsList = useMemo(() => (layoutData as unknown as SeatLayoutFile).seats || [], []);
  const seatMap = useMemo(() => {
    const map = new Map<string, SeatRecord>();
    for (const s of seatsList) {
      map.set(s.seat_id, s);
    }
    return map;
  }, [seatsList]);

  // Group seats by rows: J (back) to A (front)
  const rows = useMemo(() => ['J', 'I', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'], []);
  const rowSeats = useMemo(() => {
    const map: Record<string, SeatRecord[]> = {};
    for (const r of rows) map[r] = [];
    for (const seat of seatsList) {
      if (map[seat.row]) {
        map[seat.row].push(seat);
      }
    }
    for (const r of rows) {
      map[r].sort((a, b) => a.number - b.number);
    }
    return map;
  }, [rows, seatsList]);

  // Obstruction estimates per seat
  const seatObstructions = useMemo(() => {
    return (obstructionsData as any).seats || {};
  }, []);

  // Tier categorisation with rich theme colors, driven dynamically by server tiers
  const categoryTiers = useMemo(() => {
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

    // Canonical database bands fallback
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
  }, [showtimeDetails?.tiers]);

  // Total calculated price
  const totalPrice = useMemo(() => {
    return selectedSeats.reduce((acc, sId) => {
      const rec = seatMap.get(sId);
      const serverSeat = showtimeDetails?.seats.find((s) => s.seat_id === sId);
      const price = serverSeat?.price || rec?.price || 380;
      return acc + price;
    }, 0);
  }, [selectedSeats, seatMap, showtimeDetails]);

  // Phase 11 Smart Best Available Engine
  const handleSelectBestAvailable = useCallback(
    (count: number, pref: PreferenceType = preference) => {
      try {
        const result = bestAvailable(
          seatsList as any,
          seatStatuses,
          count,
          { preference: pref }
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
    [seatsList, seatStatuses, preference, clearSelection, selectSeat, showToast]
  );

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

  function handleCompleteCheckout(selectedAddons: { fnb_item_id: number; quantity: number }[]) {
    setIsFnbModalOpen(false);
    const holdQuery = activeHoldId ? `&hold_id=${activeHoldId}` : '';
    const addonsQuery = selectedAddons.length > 0 ? `&addons=${encodeURIComponent(JSON.stringify(selectedAddons))}` : '';
    router.push(
      `/checkout?showtime=${showtimeNum}&seats=${selectedSeats.join(',')}&total=${totalPrice}${holdQuery}${addonsQuery}`
    );
  }

  const focusedSeat = focusedSeatId ? seatMap.get(focusedSeatId) : null;
  const serverFocusedSeat = focusedSeatId ? showtimeDetails?.seats.find((s) => s.seat_id === focusedSeatId) : null;
  const focusedPrice = serverFocusedSeat?.price ?? focusedSeat?.price ?? 380;
  const focusedCategory = (serverFocusedSeat?.category ?? focusedSeat?.category ?? 'Prime').toUpperCase();
  const focusedScore = focusedSeat ? viewScore(focusedSeat as any) : null;
  const focusedObstruction = focusedSeatId ? seatObstructions[focusedSeatId] : null;

  return (
    <div
      className="min-h-screen bg-[#FFF8F1] text-[#1B1320] p-4 sm:p-8 select-none focus:outline-none"
      data-testid="seatmap-2d-container"
      tabIndex={0}
    >
      <div className="mx-auto max-w-5xl space-y-8">
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

            <div>
              <h1 className="text-2xl font-black text-[#1B1320] flex items-center gap-3">
                <span>{showtimeDetails?.movie_title || 'Quantum Odyssey'}</span>
                <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-rose-100 text-[#9F1239] border border-rose-200">
                  {showtimeDetails?.screen_type || 'IMAX 3D Laser'}
                </span>
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                {showtimeDetails?.cinema_name || 'CineVerse IMAX Koramangala'} • {showtimeDetails?.auditorium_name || 'Auditorium 1'}
              </p>
            </div>
          </div>

          {/* Action Tools: Heatmap Toggle & Explore in 3D */}
          <div className="flex items-center gap-3 flex-wrap">
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
            {has3DAsset && isWebGLSupported && onSwitchTo3D && (
              <button
                onClick={onSwitchTo3D}
                className="flex min-h-[44px] items-center gap-2 rounded-xl bg-amber-500/10 border-2 border-amber-500 px-5 py-2 text-sm font-bold text-amber-900 shadow hover:bg-amber-500/20 transition"
                data-testid="explore-in-3d-button"
                aria-label="Switch to 3D Auditorium Sightline View"
              >
                <Compass className="h-4 w-4 text-amber-600 animate-spin-slow" />
                <span>Explore in 3D</span>
              </button>
            )}
          </div>
        </div>

        {/* Phase 11: Best Available Smart Engine & Preference Bar */}
        <div className="rounded-3xl border border-[#E6DCD2] bg-white p-5 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-[#E6DCD2] pb-4">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-2xl bg-rose-100 flex items-center justify-center text-[#C8102E]">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-[#1B1320]">Smart Best-Seat Finder</h3>
                <p className="text-xs text-slate-500">Picks optimal contiguous same-row seats based on viewing angle & distance</p>
              </div>
            </div>

            {/* Party Size & Preference Controls */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1 bg-[#FAF6F0] p-1 rounded-xl border border-[#E6DCD2]">
                <span className="text-xs font-bold text-slate-500 px-2">Seats:</span>
                {[1, 2, 3, 4, 5].map((cnt) => (
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
                  className="rounded-xl border border-[#E6DCD2] bg-[#FAF6F0] px-3 py-1.5 text-xs font-bold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
                  data-testid="seat-preference-select"
                >
                  <option value="centre">🎯 Direct Screen Centre</option>
                  <option value="sit_back">🛋️ Sit Back (Rear View)</option>
                  <option value="no_neck_strain">📐 No Neck Strain</option>
                  <option value="aisle">🚪 Aisle Seat Access</option>
                  <option value="accessible">♿ Accessible Front Row</option>
                  <option value="balanced">⚖️ Balanced Comfort</option>
                </select>
              </div>

              {/* Waitlist Button */}
              <button
                onClick={() => setIsWaitlistModalOpen(true)}
                className="flex items-center gap-1.5 rounded-xl border border-[#E6DCD2] bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-rose-50 hover:text-[#C8102E] transition shadow-sm"
                data-testid="open-waitlist-btn"
              >
                <Bell className="h-3.5 w-3.5" />
                <span>Notify / Waitlist</span>
              </button>
            </div>
          </div>
        </div>

        {/* Curved Screen Banner */}
        <div className="pt-2 pb-4 flex flex-col items-center">
          <div className="h-2.5 w-4/5 max-w-xl rounded-full bg-gradient-to-r from-transparent via-[#C8102E] to-transparent shadow-md" />
          <span className="text-xs uppercase tracking-widest text-slate-500 font-black mt-3">
            ALL EYES THIS WAY — CINEMA SCREEN
          </span>
        </div>

        {/* Normal Legend or Heatmap Legend */}
        {isHeatmapActive ? (
          <div
            className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 text-xs text-slate-700 border-2 border-emerald-500/40 bg-emerald-50/60 rounded-3xl shadow-sm"
            data-testid="heatmap-legend"
          >
            <div className="flex items-center gap-3">
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
          <div className="flex flex-wrap items-center justify-center gap-8 py-3 text-sm text-slate-700 border-y border-[#E6DCD2] bg-white rounded-2xl shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="h-5 w-5 rounded-lg border-2 border-[#E6DCD2] bg-[#FAF6F0]" />
              <span className="font-medium">Available</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="h-5 w-5 rounded-lg bg-[#C8102E] text-white flex items-center justify-center text-xs font-bold shadow-sm">
                ✓
              </div>
              <span className="font-bold text-[#C8102E]">Selected</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="h-5 w-5 rounded-lg border-2 border-amber-400 bg-amber-100" />
              <span className="font-semibold text-amber-800">Held (Live)</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="h-5 w-5 rounded-lg bg-slate-300 opacity-60 cursor-not-allowed" />
              <span className="text-slate-400">Sold</span>
            </div>
          </div>
        )}

        {/* 2D Seat Matrix (Rows J to A) */}
        <div
          role="grid"
          aria-label="2D Auditorium Seat Selection Map"
          className="space-y-8 py-4"
        >
          {categoryTiers.map((tier) => (
            <div key={tier.name} className="space-y-3 rounded-3xl border border-[#E6DCD2] bg-white p-5 shadow-sm">
              {/* Category Header with Authentic Pricing */}
              <div className="flex items-center justify-between border-b border-[#E6DCD2] pb-2 px-2">
                <span className="font-black text-base text-[#1B1320]">{tier.name}</span>
                <span className="font-black text-lg text-[#C8102E]">₹{tier.price}</span>
              </div>

              {/* Rows */}
              <div className="space-y-3 pt-2">
                {tier.rows.map((row) => {
                  const seatsInRow = rowSeats[row] || [];
                  return (
                    <div key={row} role="row" className="flex items-center justify-center gap-3 sm:gap-4">
                      {/* Row Label */}
                      <span className="w-6 text-center text-sm font-black text-slate-500">
                        {row}
                      </span>

                      {/* Seats in Row (1 to 10) */}
                      <div className="flex items-center gap-2 sm:gap-3">
                        {seatsInRow.map((s) => {
                          const seatId = s.seat_id;
                          const rawStatus = (seatStatuses[seatId] || 'available').toString().toLowerCase();
                          const status = rawStatus === 'payment_pending' ? 'held' : rawStatus;
                          const isSelected = selectedSeats.includes(seatId);
                          const isHeld = status === 'held';
                          const isBooked = status === 'booked';
                          const isFocused = focusedSeatId === seatId;

                          // Compute comfort score for this seat
                          const scored = viewScore(s as any);
                          const score = scored.score;

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

                          return (
                            <button
                              key={seatId}
                              id={`seat-btn-${seatId}`}
                              role="gridcell"
                              aria-selected={isSelected}
                              aria-disabled={isBooked || isHeld}
                              aria-label={`Seat ${seatId}, ${tier.name} ₹${s.price}, ${status}, Comfort Score: ${score}`}
                              onClick={() => {
                                setFocusedSeatId(seatId);
                                if (!isBooked && !isHeld) {
                                  toggleSeat(seatId);
                                } else {
                                  showToast(`Seat ${seatId} is ${status} and cannot be selected. You can still preview its 3D view.`);
                                }
                              }}
                              onFocus={() => setFocusedSeatId(seatId)}
                              onMouseEnter={() => setFocusedSeatId(seatId)}
                              onKeyDown={(e) => {
                                if (e.key === 'v' || e.key === 'V') {
                                  e.preventDefault();
                                  handleViewPOV(seatId);
                                }
                              }}
                              className={`h-9 w-9 sm:h-10 sm:w-10 rounded-xl border-2 text-sm font-bold flex items-center justify-center transition-all duration-150 ${bgClass} ${
                                isFocused ? 'ring-2 ring-[#C8102E]' : ''
                              }`}
                              data-testid={`seat-2d-${seatId}`}
                              data-seat-id={seatId}
                              data-status={isSelected ? 'selected' : status}
                              data-score={score}
                            >
                              {isHeatmapActive && !isSelected ? Math.round(score) : (isSelected ? '✓' : s.number)}
                            </button>
                          );
                        })}
                      </div>

                      {/* Right Row Label */}
                      <span className="w-6 text-center text-sm font-black text-slate-500">
                        {row}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

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
                  {((seatStatuses[focusedSeat.seat_id] || 'available').toString().toLowerCase() === 'payment_pending' ? 'held' : (seatStatuses[focusedSeat.seat_id] || 'available')).toString().toLowerCase()}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {isWebGLSupported ? (
                  <button
                    onClick={() => handleViewPOV(focusedSeat.seat_id)}
                    data-testid="see-view-from-seat-btn"
                    className="flex min-h-[40px] items-center gap-2 rounded-xl border-2 border-[#1B1320] bg-white px-3.5 py-1.5 text-xs font-bold text-[#1B1320] shadow-sm hover:bg-slate-50 transition active:scale-95"
                    title={`See 3D Seated POV from seat ${focusedSeat.seat_id}`}
                  >
                    <Compass className="h-4 w-4 text-[#C8102E]" />
                    <span>See view from this seat</span>
                  </button>
                ) : (
                  <span
                    data-testid="3d-unavailable-badge"
                    className="text-xs font-semibold text-slate-500 italic bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200"
                  >
                    3D view not available on this device
                  </span>
                )}

                {focusedScore && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Viewing Comfort:</span>
                    <span
                      className={`text-sm font-black px-2.5 py-1 rounded-xl text-white ${
                        focusedScore.score >= 80 ? 'bg-emerald-600' : focusedScore.score >= 65 ? 'bg-amber-500' : 'bg-orange-500'
                      }`}
                      data-testid="seat-comfort-score-badge"
                    >
                      {focusedScore.score} / 100
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-700">
              <div className="space-y-1.5 bg-[#FAF6F0] p-3 rounded-2xl border border-[#E6DCD2]">
                <div className="font-bold text-[#1B1320] flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-blue-600" />
                  <span>Sightline Geometry</span>
                </div>
                <p>• Distance to Screen: ≈ {focusedSeat.screen_distance_m_est} m</p>
                <p>• Horizontal Offset: {Math.abs(focusedSeat.horizontal_offset_deg)}°</p>
                <p>• Reasons: {focusedScore?.reasons.join(', ')}</p>
              </div>

              <div className="space-y-1.5 bg-[#FAF6F0] p-3 rounded-2xl border border-[#E6DCD2]">
                <div className="font-bold text-[#1B1320] flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Screen Obstruction Estimate</span>
                </div>
                <p>
                  • Geometric Visibility:{' '}
                  <span className="font-bold text-emerald-700" data-testid="seat-visibility-pct">
                    {focusedObstruction ? `${focusedObstruction.visible_percentage}% visible` : '100% visible'}
                  </span>
                </p>
                <p>• Elements: {focusedObstruction?.obstructing_elements.length > 0 ? focusedObstruction.obstructing_elements.join(', ') : 'None (Full Line of Sight)'}</p>
                <p className="italic text-slate-500 font-medium">
                  {focusedObstruction?.disclaimer || "Geometric raycast estimate against static theatre geometry only. No audience members or physical heads modelled."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Technical Details Toggle */}
        <div className="rounded-2xl border border-[#E6DCD2] bg-white p-4 shadow-sm text-center">
          <button
            onClick={() => setShowTechDetails(!showTechDetails)}
            className="flex items-center justify-center gap-2 mx-auto text-sm font-bold text-slate-600 hover:text-[#1B1320]"
          >
            <span>Seat view details & technical sightlines</span>
            {showTechDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showTechDetails && (
            <div className="mt-4 pt-4 border-t border-[#E6DCD2] text-left text-xs text-slate-600 space-y-1 max-w-xl mx-auto">
              <p>• Horizontal viewing angle recommended range: $\le 35^\circ$ for center seats.</p>
              <p>• Vertical elevation angle conforms to SMPTE EG 18-1994 cinema standards.</p>
              <p>• 3D auditorium model verifies real geometry and screen line-of-sight.</p>
            </div>
          )}
        </div>

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
            className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-40"
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
                      {isWebGLSupported && (
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
                  <div className="text-2xl font-black text-[#C8102E]">₹{totalPrice.toFixed(2)}</div>
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
                      {[1, 2, 3, 4, 5, 6].map((n) => (
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
      </div>
    </div>
  );
}
