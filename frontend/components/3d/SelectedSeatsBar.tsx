'use client';

import React, { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCinemaStore } from '@/store/useCinemaStore';
import layoutData from '@/public/models/seat_layout_v2.json';
import type { SeatLayoutFile, SeatRecord } from '@/lib/types';
import { X, ArrowRight, Ticket, Loader2, ChevronLeft, ChevronRight, Eye, Check } from 'lucide-react';
import { FnbAddonModal } from '@/components/FnbAddonModal';
import { holdSeats, updateHoldAddons } from '@/services/api';
import { I18N_DICTIONARY } from '@/lib/i18n';

export function SelectedSeatsBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showtimeIdStr = searchParams.get('showtime') || '1';
  const showtimeId = parseInt(showtimeIdStr, 10) || 1;

  const selectedSeats = useCinemaStore((s) => s.selectedSeats);
  const deselectSeat = useCinemaStore((s) => s.deselectSeat);
  const clearSelection = useCinemaStore((s) => s.clearSelection);
  const seatPrices = useCinemaStore((s) => s.seatPrices);
  const cameraMode = useCinemaStore((s) => s.cameraMode);
  const sitAt = useCinemaStore((s) => s.sitAt);
  const activeSeatId = useCinemaStore((s) => s.activeSeatId);
  const trailer = useCinemaStore((s) => s.trailer);
  const selectedLanguage = useCinemaStore((s) => s.selectedLanguage) || 'en';
  const screenType = useCinemaStore((s) => s.auditoriumLayout.screen?.mesh) || 'IMAX 3D';
  const t = I18N_DICTIONARY[selectedLanguage] || I18N_DICTIONARY.en;

  const [isFnbModalOpen, setIsFnbModalOpen] = useState(false);
  const [holding, setHolding] = useState(false);
  const [activeHoldId, setActiveHoldId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const seats = (layoutData as unknown as SeatLayoutFile).seats;
  const seatMap = useMemo(() => {
    const map = new Map<string, SeatRecord>();
    for (const s of seats) map.set(s.seat_id, s);
    return map;
  }, [seats]);

  const basePrice = useMemo(() => {
    return selectedSeats.reduce((acc, id) => {
      const serverPrice = seatPrices[id]?.price;
      if (serverPrice !== undefined) return acc + serverPrice;
      const seat = seatMap.get(id);
      return acc + (seat ? seat.price : 380);
    }, 0);
  }, [selectedSeats, seatMap, seatPrices]);

  // Convenience booking fee matching server quote (₹30 per seat)
  const convenienceFee = selectedSeats.length * 30;
  const totalPrice = basePrice + convenienceFee;

  // Step between selected seats in POV view
  const currentSeatIndex = selectedSeats.indexOf(activeSeatId || '');
  const handleStepSeat = (direction: 'prev' | 'next') => {
    if (selectedSeats.length === 0) return;
    let nextIdx = 0;
    if (direction === 'prev') {
      nextIdx = currentSeatIndex <= 0 ? selectedSeats.length - 1 : currentSeatIndex - 1;
    } else {
      nextIdx = currentSeatIndex >= selectedSeats.length - 1 ? 0 : currentSeatIndex + 1;
    }
    const targetSeat = selectedSeats[nextIdx];
    sitAt(targetSeat);
  };

  if (selectedSeats.length === 0) return null;

  async function handleInitialProceed() {
    setHolding(true);
    setErrorMessage(null);
    try {
      const res = await holdSeats(showtimeId, selectedSeats);
      setActiveHoldId(res.hold_id);
      setIsFnbModalOpen(true);
    } catch (err: any) {
      console.warn('Hold seats error:', err);
      setErrorMessage(err.message || 'Seat selection conflict. Please select another seat.');
      setTimeout(() => setErrorMessage(null), 3500);
    } finally {
      setHolding(false);
    }
  }

  async function handleProceedToCheckout(selectedAddons: { fnb_item_id: number; quantity: number }[]) {
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

  return (
    <>
      <div
        className={`pointer-events-none fixed bottom-4 left-1/2 z-40 w-full max-w-3xl -translate-x-1/2 px-4 transition-all duration-300 ${
          cameraMode === 'pov' ? 'opacity-90 hover:opacity-100' : 'opacity-100'
        }`}
      >
        <div className="pointer-events-auto flex flex-col gap-3 rounded-3xl border border-[#E6DCD2] bg-white/95 p-4 sm:p-5 shadow-2xl backdrop-blur-md text-[#1B1320]">
          {/* Top Row: 3-Step Journey Bar + Movie/Cinema/Format Summary */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[#E6DCD2] pb-3">
            {/* 3-Step progress bar */}
            <div className="flex items-center gap-1.5 text-xs font-bold" data-testid="3-step-journey-bar">
              <span className="flex items-center gap-1 rounded-full bg-[#C8102E] px-2.5 py-0.5 text-white shadow-xs">
                <span>1</span>
                <span>{t.seats}</span>
              </span>
              <span className="text-slate-300">→</span>
              <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-500">
                <span>2</span>
                <span>{t.snacks}</span>
              </span>
              <span className="text-slate-300">→</span>
              <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-500">
                <span>3</span>
                <span>{t.confirm}</span>
              </span>
            </div>

            {/* Movie & Cinema Format Summary */}
            <div className="text-xs text-slate-600 font-semibold flex items-center gap-2">
              <span className="font-bold text-[#1B1320] truncate max-w-[180px]">{trailer.movieTitle || 'Movie'}</span>
              <span>•</span>
              <span className="rounded bg-rose-100 text-[#C8102E] px-1.5 py-0.5 text-[10px] font-black uppercase">
                {screenType.includes('4DX') ? '4DX 3D' : 'Laser IMAX'}
              </span>
            </div>
          </div>

          {/* Middle Row: Selected Seat Chips + POV Stepping Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500">{t.seats} ({selectedSeats.length}/8):</span>
              {selectedSeats.map((seatId) => {
                const price = seatPrices[seatId]?.price || seatMap.get(seatId)?.price || 380;
                const isViewingThisSeat = activeSeatId === seatId;
                return (
                  <div
                    key={seatId}
                    className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-bold transition shadow-xs ${
                      isViewingThisSeat
                        ? 'border-[#C8102E] bg-rose-100 text-[#C8102E] ring-2 ring-rose-300'
                        : 'border-rose-200 bg-rose-50 text-[#9F1239]'
                    }`}
                  >
                    <span>{seatId}</span>
                    <span className="text-[11px] text-rose-700 font-semibold">₹{Math.round(price)}</span>

                    {/* View from here button */}
                    <button
                      onClick={() => sitAt(seatId)}
                      className="ml-1 rounded p-0.5 text-slate-500 hover:text-[#C8102E]"
                      title={`View sightline from seat ${seatId}`}
                      aria-label={`View from seat ${seatId}`}
                    >
                      <Eye className="h-3 w-3" />
                    </button>

                    <button
                      onClick={() => deselectSeat(seatId)}
                      className="rounded p-0.5 text-rose-500 hover:text-rose-800"
                      aria-label={`Remove seat ${seatId}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}

              {/* Prev / Next seat stepping buttons */}
              {selectedSeats.length > 1 && (
                <div className="flex items-center gap-1 pl-1">
                  <button
                    onClick={() => handleStepSeat('prev')}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                    title="Previous selected seat"
                    aria-label="Previous selected seat"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleStepSeat('next')}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                    title="Next selected seat"
                    aria-label="Next selected seat"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Error notice if conflict */}
            {errorMessage && (
              <div className="text-xs text-rose-900 bg-rose-50 px-3 py-1 rounded-xl border border-rose-300">
                {errorMessage}
              </div>
            )}
          </div>

          {/* Bottom Row: Quote Breakdown & Continue Button */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-[#E6DCD2] pt-3">
            <div className="flex items-center gap-3 text-xs text-slate-600">
              <div>
                <span>Tickets: </span>
                <span className="font-bold text-[#1B1320]">₹{Math.round(basePrice)}</span>
              </div>
              <span>+</span>
              <div>
                <span>Fees: </span>
                <span className="font-bold text-[#1B1320]">₹{convenienceFee}</span>
              </div>
              <span>=</span>
              <div>
                <span className="text-slate-500 font-bold uppercase text-[10px] block">Total Quote</span>
                <span className="text-xl font-black text-[#C8102E]">₹{Math.round(totalPrice)}</span>
              </div>
            </div>

            <button
              onClick={handleInitialProceed}
              disabled={holding}
              className="w-full sm:w-auto flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-[#C8102E] px-6 py-2.5 text-sm font-bold text-white shadow-xl hover:bg-[#A60D26] active:scale-95 disabled:opacity-50 transition"
              data-testid="proceed-to-checkout-btn"
            >
              {holding ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Locking Seats...</span>
                </>
              ) : (
                <>
                  <span>{t.continueBtn}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <FnbAddonModal
        isOpen={isFnbModalOpen}
        onClose={() => handleProceedToCheckout([])}
        onProceed={handleProceedToCheckout}
      />
    </>
  );
}
