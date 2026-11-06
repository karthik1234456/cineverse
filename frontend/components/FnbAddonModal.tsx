// components/FnbAddonModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, UtensilsCrossed, ArrowRight } from 'lucide-react';
import { getFnbAddons, type FnbItem } from '@/services/api';

interface FnbAddonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: (selectedAddons: { fnb_item_id: number; quantity: number }[]) => void;
  cinemaId?: number;
}

export function FnbAddonModal({
  isOpen,
  onClose,
  onProceed,
  cinemaId,
}: FnbAddonModalProps) {
  const [items, setItems] = useState<FnbItem[]>([]);
  const [quantities, setQuantities] = useState<Record<number, number>>({});

  useEffect(() => {
    if (isOpen) {
      getFnbAddons(cinemaId)
        .then((data) => setItems(data))
        .catch((err) => console.warn('Failed to load addons:', err));
    }
  }, [isOpen, cinemaId]);

  if (!isOpen) return null;

  function updateQuantity(itemId: number, delta: number) {
    setQuantities((prev) => {
      const cur = prev[itemId] || 0;
      const next = Math.max(0, cur + delta);
      return { ...prev, [itemId]: next };
    });
  }

  const totalAddonAmount = items.reduce((acc, item) => {
    return acc + item.price * (quantities[item.id] || 0);
  }, 0);

  function handleContinue() {
    const selected = Object.entries(quantities)
      .filter(([_, qty]) => qty > 0)
      .map(([id, qty]) => ({ fnb_item_id: parseInt(id, 10), quantity: qty }));
    onProceed(selected);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-[#1B1320]"
      data-testid="fnb-addon-modal"
    >
      <div className="relative w-full max-w-2xl rounded-3xl border border-[#E6DCD2] bg-white p-6 sm:p-8 shadow-2xl flex flex-col max-h-[90vh]">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 transition"
          aria-label="Close"
          data-testid="close-fnb-btn"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 border border-amber-200">
            <UtensilsCrossed className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-[#1B1320]">Cinema Concessions & Combos</h2>
            <p className="text-sm text-slate-600">Save up to 25% by pre-booking fresh popcorn and snacks</p>
          </div>
        </div>

        {/* Scrollable item list */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 my-3">
          {items.map((item) => {
            const qty = quantities[item.id] || 0;
            return (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-2xl border border-[#E6DCD2] bg-[#FAF6F0] p-4 hover:border-slate-300 transition"
              >
                <div className="flex-1 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-[#1B1320]">{item.name}</span>
                    <span className="rounded-lg bg-rose-50 px-2.5 py-0.5 text-sm font-semibold text-[#9F1239] border border-rose-200">
                      {item.category}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1 line-clamp-1">{item.description}</p>
                  <div className="text-base font-black text-[#C8102E] mt-1">₹{Math.round(item.price)}</div>
                </div>

                {/* Counter stepper */}
                <div className="flex items-center gap-3 bg-white border border-[#E6DCD2] rounded-xl px-3 py-1.5 shadow-sm">
                  <button
                    onClick={() => updateQuantity(item.id, -1)}
                    disabled={qty === 0}
                    className="p-1 min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-500 hover:text-[#1B1320] disabled:opacity-30 transition"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="text-base font-bold w-5 text-center text-[#1B1320]">{qty}</span>
                  <button
                    onClick={() => updateQuantity(item.id, 1)}
                    className="p-1 min-h-[36px] min-w-[36px] flex items-center justify-center text-[#C8102E] hover:text-[#A60D26] transition"
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom actions */}
        <div className="mt-4 pt-4 border-t border-[#E6DCD2] flex items-center justify-between gap-4">
          <div>
            <div className="text-sm text-slate-500 font-bold uppercase tracking-wider">Add-ons Total</div>
            <div className="text-2xl font-black text-[#C8102E]">₹{Math.round(totalAddonAmount)}</div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onProceed([])}
              data-testid="skip-fnb-btn"
              className="min-h-[44px] rounded-xl border border-[#E6DCD2] bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm"
            >
              Skip Add-ons
            </button>
            <button
              onClick={handleContinue}
              data-testid="continue-fnb-btn"
              className="min-h-[44px] flex items-center gap-2 rounded-xl bg-[#C8102E] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#A60D26] transition shadow-md"
            >
              <span>Continue to Pay</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
