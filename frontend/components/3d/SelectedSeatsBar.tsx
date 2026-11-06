'use client';

import React, { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCinemaStore } from '@/store/useCinemaStore';
import layoutData from '@/public/models/seat_layout_v2.json';
import type { SeatLayoutFile, SeatRecord } from '@/lib/types';
import { X, ArrowRight, Ticket, Loader2 } from 'lucide-react';
import { FnbAddonModal } from '@/components/FnbAddonModal';
import { holdSeats, updateHoldAddons } from '@/services/api';

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

  const totalPrice = useMemo(() => {
    return selectedSeats.reduce((acc, id) => {
      const serverPrice = seatPrices[id]?.price;
      if (serverPrice !== undefined) return acc + serverPrice;
      const seat = seatMap.get(id);
      return acc + (seat ? seat.price : 380);
    }, 0);
  }, [selectedSeats, seatMap, seatPrices]);

  if (selectedSeats.length === 0) return null;

  async function handleInitialProceed() {
    setHolding(true);
    setErrorMessage(null);
    try {
      // Call backend to atomically hold selected seats
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
        className={`pointer-events-none fixed bottom-6 left-1/2 z-40 w-full max-w-2xl -translate-x-1/2 px-4 transition-all duration-300 ${
          cameraMode === 'pov' ? 'opacity-40 hover:opacity-100' : 'opacity-100'
        }`}
      >
        <div className="pointer-events-auto flex flex-col sm:flex-row items-center justify-between gap-4 rounded-3xl border border-[#E6DCD2] bg-white/95 p-5 shadow-2xl backdrop-blur-md text-[#1B1320]">
          {/* Selected Seat Chips */}
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
              <Ticket className="h-4 w-4 text-[#C8102E]" />
              <span>Seats ({selectedSeats.length}/8):</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {selectedSeats.map((seatId) => {
                const price = seatPrices[seatId]?.price || seatMap.get(seatId)?.price || 380;
                return (
                  <div
                    key={seatId}
                    className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1 text-sm font-bold text-[#9F1239]"
                  >
                    <span>{seatId}</span>
                    <span className="text-sm text-rose-700">₹{Math.round(price)}</span>
                    <button
                      onClick={() => deselectSeat(seatId)}
                      className="ml-1 rounded p-0.5 text-rose-500 hover:text-rose-800"
                      aria-label={`Remove seat ${seatId}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            {selectedSeats.length > 1 && (
              <button
                onClick={clearSelection}
                className="text-sm text-slate-500 hover:text-[#C8102E] ml-2 underline font-semibold"
              >
                Clear
              </button>
            )}
          </div>

          {/* Error notice if conflict */}
          {errorMessage && (
            <div className="text-sm text-rose-900 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-300">
              {errorMessage}
            </div>
          )}

          {/* Total Price and Checkout Trigger */}
          <div className="flex items-center gap-5 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-[#E6DCD2] pt-3 sm:pt-0">
            <div className="text-right">
              <div className="text-sm uppercase tracking-wider text-slate-500 font-bold">Total</div>
              <div className="text-2xl font-black text-[#C8102E]">₹{Math.round(totalPrice)}</div>
            </div>

            <button
              onClick={handleInitialProceed}
              disabled={holding}
              className="flex min-h-[48px] items-center gap-2 rounded-2xl bg-[#C8102E] px-6 py-3 text-base font-bold text-white shadow-xl hover:bg-[#A60D26] active:scale-95 disabled:opacity-50 transition"
              data-testid="proceed-to-checkout-btn"
            >
              {holding ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Locking Seats...</span>
                </>
              ) : (
                <>
                  <span>Lock & Checkout</span>
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
