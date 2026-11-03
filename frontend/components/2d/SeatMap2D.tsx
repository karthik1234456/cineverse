'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Compass, ArrowLeft, Play, X,
  Ticket, AlertCircle, Loader2
} from 'lucide-react';
import { useCinemaStore, MAX_SELECTED_SEATS } from '@/store/useCinemaStore';
import { useSeatData } from '@/hooks/useSeatData';
import { useSeatSocket } from '@/hooks/useSeatSocket';
import { holdSeats, getShowtimeSeats, type ShowtimeSeatsResponse } from '@/services/api';
import { FnbAddonModal } from '@/components/FnbAddonModal';
import layoutData from '@/public/models/seat_layout_v2.json';
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
  const updateSeatStatus = useCinemaStore((s) => s.updateSeatStatus);
  const showToast = useCinemaStore((s) => s.showToast);

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
  const [isTrailerOpen, setIsTrailerOpen] = useState(false);

  // WebGL detection for "Explore in 3D" button visibility
  const [isWebGLSupported, setIsWebGLSupported] = useState(true);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        setIsWebGLSupported(!!gl);
      } catch {
        setIsWebGLSupported(false);
      }
    }
  }, []);

  // Fetch showtime metadata
  useEffect(() => {
    getShowtimeSeats(showtimeNum)
      .then((data) => setShowtimeDetails(data))
      .catch((err) => console.warn('Showtime load notice:', err));
  }, [showtimeNum]);

  // Layout parsing
  const seatsList = useMemo(() => (layoutData as unknown as SeatLayoutFile).seats || [], []);
  const seatMap = useMemo(() => {
    const map = new Map<string, SeatRecord>();
    for (const s of seatsList) {
      map.set(s.seat_id, s);
    }
    return map;
  }, [seatsList]);

  // Group seats by rows: J to A
  const rows = useMemo(() => ['J', 'I', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'], []);
  const rowSeats = useMemo(() => {
    const map: Record<string, SeatRecord[]> = {};
    for (const r of rows) map[r] = [];
    for (const s of seatsList) {
      const r = s.seat_id[0];
      if (map[r]) map[r].push(s);
    }
    for (const r of rows) {
      map[r].sort((a, b) => a.number - b.number);
    }
    return map;
  }, [seatsList, rows]);

  // Categories mapping
  const categoryTiers = [
    { name: 'Premier Recliner', rows: ['J', 'I'], price: 520 },
    { name: 'Prime Club', rows: ['H', 'G', 'F', 'E', 'D', 'C'], price: 380 },
    { name: 'Front Classic', rows: ['B', 'A'], price: 280 },
  ];

  // Price calculation
  const totalPrice = useMemo(() => {
    return selectedSeats.reduce((acc, seatId) => {
      const s = seatMap.get(seatId);
      return acc + (s ? s.price : 380);
    }, 0);
  }, [selectedSeats, seatMap]);

  // Best Available Auto-selector
  const handleSelectBestAvailable = useCallback((count: number) => {
    const idealRows = ['F', 'G', 'E', 'H', 'D', 'J', 'C', 'B', 'A'];
    const idealCenterCols = [5, 6, 4, 7, 3, 8, 2, 9, 1, 10];

    const candidateSeats: string[] = [];
    for (const r of idealRows) {
      for (const col of idealCenterCols) {
        const id = `${r}${String(col).padStart(2, '0')}`;
        const st = seatStatuses[id] || 'available';
        if (st === 'available' && !candidateSeats.includes(id)) {
          candidateSeats.push(id);
          if (candidateSeats.length === count) break;
        }
      }
      if (candidateSeats.length === count) break;
    }

    if (candidateSeats.length < count) {
      showToast('Could not find enough contiguous best seats.');
      return;
    }

    // Replace selection
    useCinemaStore.getState().clearSelection();
    for (const id of candidateSeats) {
      selectSeat(id);
    }
    showToast(`Selected ${count} best available seat(s): ${candidateSeats.join(', ')}`);
  }, [seatStatuses, selectSeat, showToast]);

  // Keyboard navigation for 2D Grid
  const [focusedSeatId, setFocusedSeatId] = useState<string>('F05');
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!focusedSeatId) return;
    const r = focusedSeatId[0];
    const n = parseInt(focusedSeatId.slice(1), 10);

    let nextSeatId = focusedSeatId;
    if (e.key === 'ArrowRight' && n < 10) {
      nextSeatId = `${r}${String(n + 1).padStart(2, '0')}`;
    } else if (e.key === 'ArrowLeft' && n > 1) {
      nextSeatId = `${r}${String(n - 1).padStart(2, '0')}`;
    } else if (e.key === 'ArrowUp') {
      const idx = rows.indexOf(r);
      if (idx > 0) nextSeatId = `${rows[idx - 1]}${String(n).padStart(2, '0')}`;
    } else if (e.key === 'ArrowDown') {
      const idx = rows.indexOf(r);
      if (idx < rows.length - 1) nextSeatId = `${rows[idx + 1]}${String(n).padStart(2, '0')}`;
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      toggleSeat(focusedSeatId);
      return;
    }

    if (nextSeatId !== focusedSeatId) {
      e.preventDefault();
      setFocusedSeatId(nextSeatId);
      const el = document.getElementById(`seat-btn-${nextSeatId}`);
      if (el) el.focus();
    }
  }, [focusedSeatId, rows, toggleSeat]);

  // Proceed to booking hold and checkout
  async function handleProceed() {
    if (selectedSeats.length === 0) return;
    setHolding(true);
    setErrorMessage(null);
    try {
      const idempotencyKey = `hold_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const res = await holdSeats(showtimeNum, selectedSeats, idempotencyKey);
      setActiveHoldId(res.hold_id);
      setIsFnbModalOpen(true);
    } catch (err: any) {
      console.warn('Hold error:', err);
      setErrorMessage(err.message || 'Selected seat(s) are no longer available. Please choose another.');
      setTimeout(() => setErrorMessage(null), 4000);
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

  return (
    <div
      className="min-h-screen bg-[#07080a] text-white p-4 sm:p-8 select-none focus:outline-none"
      data-testid="seatmap-2d-container"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header navigation bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/10 transition"
              aria-label="Back to showtimes"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </button>

            <div>
              <h1 className="text-lg font-black text-white flex items-center gap-2">
                <span>{showtimeDetails?.movie_title || 'Quantum Odyssey'}</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-red-600/30 text-red-300 border border-red-500/30">
                  {showtimeDetails?.screen_type || 'IMAX 3D Laser'}
                </span>
              </h1>
              <p className="text-xs text-zinc-400">
                {showtimeDetails?.cinema_name || 'CineVerse IMAX Koramangala'} • {showtimeDetails?.auditorium_name || 'Auditorium 1'}
              </p>
            </div>
          </div>

          {/* Action Tools: Best Available, Trailer Mini-player, Explore in 3D */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Best Available Quick Picker */}
            <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1 text-xs">
              <span className="text-[11px] font-semibold text-zinc-400 px-2">Best:</span>
              {[1, 2, 4].map((cnt) => (
                <button
                  key={cnt}
                  onClick={() => handleSelectBestAvailable(cnt)}
                  className="rounded-lg px-2.5 py-1 text-xs font-bold text-zinc-200 hover:bg-white/10 hover:text-white transition"
                  data-testid={`btn-best-${cnt}`}
                >
                  {cnt}
                </button>
              ))}
            </div>

            {/* Trailer Mini Player Button */}
            <button
              onClick={() => setIsTrailerOpen(!isTrailerOpen)}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/10 hover:text-white transition"
              data-testid="trailer-mini-btn"
            >
              <Play className="h-3.5 w-3.5 text-red-500" />
              <span>Trailer</span>
            </button>

            {/* Explore in 3D Button (Hidden if WebGL not supported) */}
            {has3DAsset && isWebGLSupported && onSwitchTo3D && (
              <button
                onClick={onSwitchTo3D}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-red-800 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-red-950/60 hover:from-red-500 hover:to-red-700 transition"
                data-testid="explore-in-3d-button"
                aria-label="Switch to 3D Auditorium Sightline View"
              >
                <Compass className="h-4 w-4 text-amber-300 animate-spin-slow" />
                <span>Explore in 3D</span>
              </button>
            )}
          </div>
        </div>

        {/* Trailer Mini-Player Drawer */}
        {isTrailerOpen && (
          <div className="rounded-2xl border border-white/15 bg-[#10121a] p-4 relative shadow-2xl animate-in fade-in slide-in-from-top-4 duration-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">
                <Play className="h-3.5 w-3.5 text-red-500 fill-red-500" />
                <span>Official Teaser & Sound Preview</span>
              </div>
              <button
                onClick={() => setIsTrailerOpen(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="relative aspect-video w-full max-w-lg mx-auto overflow-hidden rounded-xl bg-black border border-white/10">
              <iframe
                className="w-full h-full"
                src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&mute=1"
                title="Trailer Preview"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        )}

        {/* Curved Screen Banner */}
        <div className="pt-2 pb-6 flex flex-col items-center">
          <div className="h-2 w-4/5 max-w-xl rounded-full bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_25px_rgba(229,9,20,0.8)]" />
          <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold mt-2.5">
            ALL EYES THIS WAY — CINEMA SCREEN
          </span>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-6 py-2 text-xs text-zinc-400 border-y border-white/5">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-md border border-white/20 bg-white/5" />
            <span>Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-md bg-[#e50914] shadow-[0_0_8px_#e50914]" />
            <span className="font-semibold text-white">Selected</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-md border border-amber-500/60 bg-amber-500/30" />
            <span className="text-amber-300">Held (Live)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-md bg-zinc-800 opacity-40 cursor-not-allowed" />
            <span>Sold</span>
          </div>
        </div>

        {/* 2D Seat Matrix (Rows J to A) */}
        <div
          role="grid"
          aria-label="2D Auditorium Seat Selection Map"
          className="space-y-6 py-4"
        >
          {categoryTiers.map((tier) => (
            <div key={tier.name} className="space-y-2">
              {/* Category Header */}
              <div className="flex items-center justify-between text-xs border-b border-white/10 pb-1 px-2">
                <span className="font-bold text-zinc-300">{tier.name}</span>
                <span className="font-bold text-red-400">₹{tier.price}</span>
              </div>

              {/* Rows */}
              <div className="space-y-2 pt-1">
                {tier.rows.map((row) => {
                  const seatsInRow = rowSeats[row] || [];
                  return (
                    <div key={row} role="row" className="flex items-center justify-center gap-2 sm:gap-3">
                      {/* Row Label */}
                      <span className="w-5 text-center text-xs font-bold text-zinc-500">
                        {row}
                      </span>

                      {/* Seats in Row (1 to 10) */}
                      <div className="flex items-center gap-1.5 sm:gap-2.5">
                        {seatsInRow.map((s) => {
                          const seatId = s.seat_id;
                          const status = seatStatuses[seatId] || 'available';
                          const isSelected = selectedSeats.includes(seatId);
                          const isHeld = status === 'held';
                          const isBooked = status === 'booked';
                          const isFocused = focusedSeatId === seatId;

                          let bgClass = 'border-white/20 bg-white/5 text-zinc-200 hover:border-white/40 hover:bg-white/15';
                          if (isSelected) {
                            bgClass = 'border-[#e50914] bg-[#e50914] text-white shadow-[0_0_12px_rgba(229,9,20,0.8)] scale-105 font-bold';
                          } else if (isHeld) {
                            bgClass = 'border-amber-500/70 bg-amber-500/30 text-amber-200 cursor-not-allowed';
                          } else if (isBooked) {
                            bgClass = 'border-zinc-800 bg-zinc-900/60 text-zinc-600 cursor-not-allowed';
                          }

                          return (
                            <button
                              key={seatId}
                              id={`seat-btn-${seatId}`}
                              role="gridcell"
                              aria-selected={isSelected}
                              aria-label={`Seat ${seatId}, ${tier.name} ₹${s.price}, ${status}`}
                              disabled={isBooked || isHeld}
                              onClick={() => toggleSeat(seatId)}
                              onFocus={() => setFocusedSeatId(seatId)}
                              className={`h-7 w-7 sm:h-8 sm:w-8 rounded-lg border text-[11px] font-semibold flex items-center justify-center transition-all duration-150 ${bgClass} ${
                                isFocused ? 'ring-2 ring-white/80' : ''
                              }`}
                              data-testid={`seat-2d-${seatId}`}
                              data-seat-id={seatId}
                              data-status={isSelected ? 'selected' : status}
                            >
                              {s.number}
                            </button>
                          );
                        })}
                      </div>

                      {/* Right Row Label */}
                      <span className="w-5 text-center text-xs font-bold text-zinc-500">
                        {row}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Error notification banner */}
        {errorMessage && (
          <div className="rounded-xl border border-red-500/40 bg-red-950/40 p-3 text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Sticky Summary & Checkout Footer */}
        {selectedSeats.length > 0 && (
          <div
            className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-40"
            data-testid="seatmap-2d-summary-footer"
          >
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-white/15 bg-[#0e1117]/95 p-4 shadow-2xl backdrop-blur-md">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-300">
                  <Ticket className="h-4 w-4 text-[#e50914]" />
                  <span>{selectedSeats.length}/{MAX_SELECTED_SEATS} Seats:</span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {selectedSeats.map((id) => (
                    <span
                      key={id}
                      className="rounded-lg border border-red-500/40 bg-red-950/40 px-2 py-0.5 text-xs font-bold text-red-200 flex items-center gap-1"
                    >
                      <span>{id}</span>
                      <button
                        onClick={() => deselectSeat(id)}
                        className="text-red-400 hover:text-white"
                        aria-label={`Remove seat ${id}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                <div className="text-right">
                  <span className="text-[10px] text-zinc-400 uppercase font-semibold">Total</span>
                  <div className="text-base font-black text-white">₹{totalPrice.toFixed(2)}</div>
                </div>

                <button
                  onClick={handleProceed}
                  disabled={holding}
                  className="rounded-xl bg-[#e50914] px-5 py-2.5 text-xs font-black text-white shadow-xl shadow-red-950/60 hover:bg-red-700 transition flex items-center gap-1.5 disabled:opacity-50"
                  data-testid="proceed-to-checkout-btn"
                >
                  {holding ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Holding Seats...</span>
                    </>
                  ) : (
                    <span>Proceed to Book</span>
                  )}
                </button>
              </div>
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
