'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Compass, ArrowLeft, Play, X,
  Ticket, AlertCircle, Loader2, Check, ChevronDown, ChevronUp
} from 'lucide-react';
import { useCinemaStore, MAX_SELECTED_SEATS } from '@/store/useCinemaStore';
import { useSeatData } from '@/hooks/useSeatData';
import { useSeatSocket } from '@/hooks/useSeatSocket';
import { holdSeats, getShowtimeSeats, type ShowtimeSeatsResponse } from '@/services/api';
import { FnbAddonModal } from '@/components/FnbAddonModal';
import layoutData from '@/public/models/seat_layout_v2.json';
import { buildSeatMapLayout } from '@/lib/seatMapLayout';
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
  const [focusedSeatId, setFocusedSeatId] = useState<string | null>(null);
  const [showTechDetails, setShowTechDetails] = useState(false);

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

  // Layout parsing via authoritative geometric seatMapLayout
  const seatsList = useMemo(() => (layoutData as unknown as SeatLayoutFile).seats || [], []);
  const seatMap = useMemo(() => {
    const map = new Map<string, SeatRecord>();
    for (const s of seatsList) {
      map.set(s.seat_id, s);
    }
    return map;
  }, [seatsList]);

  // Derive geometric layout: seat 01 on audience left, aisle gap detection
  const layout2D = useMemo(() => {
    return buildSeatMapLayout(seatsList as any);
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

  // Tier categorisation with rich theme colors
  const categoryTiers = useMemo(
    () => [
      {
        name: 'Premier Recliner',
        category: 'premier',
        price: 520,
        colorClass: 'text-[#9F1239] border-[#9F1239]/30 bg-rose-50',
        badgeColor: 'bg-[#9F1239] text-white',
        rows: ['J', 'I'],
      },
      {
        name: 'Prime Standard',
        category: 'prime',
        price: 380,
        colorClass: 'text-[#1E40AF] border-[#1E40AF]/30 bg-blue-50',
        badgeColor: 'bg-[#1E40AF] text-white',
        rows: ['H', 'G', 'F', 'E', 'D', 'C'],
      },
      {
        name: 'Front Row',
        category: 'front',
        price: 280,
        colorClass: 'text-[#8D5B28] border-[#8D5B28]/30 bg-amber-50',
        badgeColor: 'bg-[#8D5B28] text-white',
        rows: ['B', 'A'],
      },
    ],
    []
  );

  // Total calculated price
  const totalPrice = useMemo(() => {
    return selectedSeats.reduce((acc, sId) => {
      const rec = seatMap.get(sId);
      // Prefer server price if loaded
      const serverSeat = showtimeDetails?.seats.find((s) => s.seat_id === sId);
      const price = serverSeat?.price || rec?.price || 380;
      return acc + price;
    }, 0);
  }, [selectedSeats, seatMap, showtimeDetails]);

  // Quick Pick: Pick best available N contiguous seats
  const handleSelectBestAvailable = useCallback(
    (count: number) => {
      const bestRows = ['F', 'G', 'E', 'H', 'D', 'J', 'I', 'C', 'B', 'A'];
      for (const r of bestRows) {
        const availableInRow = (rowSeats[r] || []).filter(
          (s) => (seatStatuses[s.seat_id] || 'available') === 'available'
        );
        for (let i = 0; i <= availableInRow.length - count; i++) {
          const slice = availableInRow.slice(i, i + count);
          const numbers = slice.map((s) => s.number);
          let isContiguous = true;
          for (let j = 0; j < numbers.length - 1; j++) {
            if (numbers[j + 1] !== numbers[j] + 1) {
              isContiguous = false;
              break;
            }
          }
          if (isContiguous) {
            slice.forEach((s) => selectSeat(s.seat_id));
            showToast(`Selected best ${count} seats in Row ${r}`);
            return;
          }
        }
      }
      showToast('Could not find enough contiguous seats.');
    },
    [rowSeats, seatStatuses, selectSeat, showToast]
  );

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

  return (
    <div
      className="min-h-screen bg-[#FFF8F1] text-[#1B1320] p-4 sm:p-8 select-none focus:outline-none"
      data-testid="seatmap-2d-container"
      tabIndex={0}
    >
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Numbered 3-Step Flow at top (§ Task 7) */}
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

          {/* Action Tools: Quick Best Picker & Explore in 3D */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Best Available Quick Picker */}
            <div className="flex items-center gap-1.5 rounded-2xl border border-[#E6DCD2] bg-white p-1.5 text-sm shadow-sm">
              <span className="text-xs font-bold text-slate-500 px-2 uppercase tracking-wider">Quick:</span>
              {[1, 2, 4].map((cnt) => (
                <button
                  key={cnt}
                  onClick={() => handleSelectBestAvailable(cnt)}
                  className="rounded-xl px-3 py-1.5 text-sm font-bold text-slate-700 hover:bg-rose-50 hover:text-[#C8102E] transition"
                  data-testid={`btn-best-${cnt}`}
                >
                  {cnt} {cnt === 1 ? 'seat' : 'seats'}
                </button>
              ))}
            </div>

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

        {/* Curved Screen Banner */}
        <div className="pt-2 pb-6 flex flex-col items-center">
          <div className="h-2.5 w-4/5 max-w-xl rounded-full bg-gradient-to-r from-transparent via-[#C8102E] to-transparent shadow-md" />
          <span className="text-xs uppercase tracking-widest text-slate-500 font-black mt-3">
            ALL EYES THIS WAY — CINEMA SCREEN
          </span>
        </div>

        {/* Legend */}
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
                          const status = seatStatuses[seatId] || 'available';
                          const isSelected = selectedSeats.includes(seatId);
                          const isHeld = status === 'held';
                          const isBooked = status === 'booked';
                          const isFocused = focusedSeatId === seatId;

                          let bgClass = 'border-[#E6DCD2] bg-[#FAF6F0] text-[#1B1320] hover:border-[#C8102E] hover:bg-rose-50';
                          if (isSelected) {
                            bgClass = 'border-[#C8102E] bg-[#C8102E] text-white shadow-md scale-105 font-black';
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
                              aria-label={`Seat ${seatId}, ${tier.name} ₹${s.price}, ${status}`}
                              disabled={isBooked || isHeld}
                              onClick={() => toggleSeat(seatId)}
                              onFocus={() => setFocusedSeatId(seatId)}
                              className={`h-9 w-9 sm:h-10 sm:w-10 rounded-xl border-2 text-sm font-bold flex items-center justify-center transition-all duration-150 ${bgClass} ${
                                isFocused ? 'ring-2 ring-[#C8102E]' : ''
                              }`}
                              data-testid={`seat-2d-${seatId}`}
                              data-seat-id={seatId}
                              data-status={isSelected ? 'selected' : status}
                            >
                              {isSelected ? '✓' : s.number}
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

        {/* Technical Details Toggle (Disclosed only on request) */}
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

        {/* Sticky Summary & Checkout Footer (§ Task 7) */}
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
                      className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-[#9F1239] flex items-center gap-1.5"
                    >
                      <span>{id}</span>
                      <button
                        onClick={() => deselectSeat(id)}
                        className="text-rose-500 hover:text-rose-800"
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
