'use client';

import React, { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCinemaStore } from '@/store/useCinemaStore';
import layoutData from '@/public/models/seat_layout_v2.json';
import type { SeatLayoutFile, SeatRecord } from '@/lib/types';
import { X, ArrowRight, Ticket, Loader2 } from 'lucide-react';
import { FnbAddonModal } from '@/components/FnbAddonModal';
import { holdSeats } from '@/services/api';

export function SelectedSeatsBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showtimeIdStr = searchParams.get('showtime') || '1';
  const showtimeId = parseInt(showtimeIdStr, 10) || 1;

  const selectedSeats = useCinemaStore((s) => s.selectedSeats);
  const deselectSeat = useCinemaStore((s) => s.deselectSeat);
  const clearSelection = useCinemaStore((s) => s.clearSelection);
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
      const seat = seatMap.get(id);
      return acc + (seat ? seat.price : 0);
    }, 0);
  }, [selectedSeats, seatMap]);

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
      // Auto-clear error after 3s
      setTimeout(() => setErrorMessage(null), 3000);
    } finally {
      setHolding(false);
    }
  }

  function handleProceedToCheckout(selectedAddons: { fnb_item_id: number; quantity: number }[]) {
    setIsFnbModalOpen(false);
    const holdQuery = activeHoldId ? `&hold_id=${activeHoldId}` : '';
    const addonsQuery = selectedAddons.length > 0 ? `&addons=${encodeURIComponent(JSON.stringify(selectedAddons))}` : '';
    router.push(
      `/checkout?showtime=${showtimeId}&seats=${selectedSeats.join(',')}&total=${totalPrice}${holdQuery}${addonsQuery}`
    );
  }

  return (
    <>
      <div
        className={`pointer-events-none fixed bottom-4 left-1/2 z-30 w-full max-w-2xl -translate-x-1/2 px-4 transition-all duration-300 ${
          cameraMode === 'pov' ? 'opacity-40 hover:opacity-100' : 'opacity-100'
        }`}
      >
        <div className="pointer-events-auto flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-slate-800/90 bg-[#0e1117]/95 p-4 shadow-2xl backdrop-blur-md">
          {/* Selected Seat Chips */}
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
              <Ticket className="h-4 w-4 text-[#e50914]" />
              <span>Seats ({selectedSeats.length}/8):</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {selectedSeats.map((seatId) => {
                const seat = seatMap.get(seatId);
                return (
                  <div
                    key={seatId}
                    className="flex items-center gap-1.5 rounded-lg border border-red-900/60 bg-red-950/40 px-2.5 py-1 text-xs font-semibold text-red-200"
                  >
                    <span>{seatId}</span>
                    <span className="text-[10px] text-slate-400">₹{seat?.price}</span>
                    <button
                      onClick={() => deselectSeat(seatId)}
                      className="ml-0.5 rounded p-0.5 text-red-400 hover:bg-red-900/60 hover:text-white"
                      aria-label={`Remove seat ${seatId}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>

            {selectedSeats.length > 1 && (
              <button
                onClick={clearSelection}
                className="text-[11px] text-slate-500 hover:text-slate-300 ml-1 underline"
              >
                Clear
              </button>
            )}
          </div>

          {/* Error notice if conflict */}
          {errorMessage && (
            <div className="text-xs text-red-400 bg-red-950/80 px-2 py-1 rounded border border-red-500/30">
              {errorMessage}
            </div>
          )}

          {/* Total Price and Checkout Trigger */}
          <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-slate-800 pt-2 sm:pt-0">
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-slate-400">Total</div>
              <div className="text-xl font-black text-white">₹{totalPrice}</div>
            </div>

            <button
              onClick={handleInitialProceed}
              disabled={holding}
              className="flex items-center gap-2 rounded-xl bg-[#e50914] px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-red-950/80 transition hover:bg-red-700 active:scale-95 disabled:opacity-50"
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
