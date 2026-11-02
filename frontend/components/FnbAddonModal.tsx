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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      getFnbAddons(cinemaId)
        .then((data) => setItems(data))
        .catch((err) => console.warn('Failed to load addons:', err))
        .finally(() => setLoading(false));
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
      .map(([id, qty]) => ({ fnb_item_id: parseInt(id), quantity: qty }));
    onProceed(selected);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-[#16181f] p-6 shadow-2xl text-white flex flex-col max-h-[90vh]">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-white transition"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
            <UtensilsCrossed className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Grab Cinema Combos & Bites</h2>
            <p className="text-xs text-zinc-400">Save up to 25% by pre-booking your snack combos</p>
          </div>
        </div>

        {/* Scrollable item list */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 my-2">
          {items.map((item) => {
            const qty = quantities[item.id] || 0;
            return (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl border border-white/5 bg-[#0f1014] p-3.5 hover:border-white/10 transition"
              >
                <div className="flex-1 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{item.name}</span>
                    <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-zinc-400 border border-white/5">
                      {item.category}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1 line-clamp-1">{item.description}</p>
                  <div className="text-sm font-bold text-amber-400 mt-1">₹{item.price}</div>
                </div>

                {/* Counter stepper */}
                <div className="flex items-center gap-3 bg-[#16181f] border border-white/10 rounded-xl px-2.5 py-1.5">
                  <button
                    onClick={() => updateQuantity(item.id, -1)}
                    disabled={qty === 0}
                    className="p-1 text-zinc-400 hover:text-white disabled:opacity-30 transition"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-sm font-bold w-4 text-center">{qty}</span>
                  <button
                    onClick={() => updateQuantity(item.id, 1)}
                    className="p-1 text-[#e50914] hover:text-red-400 transition"
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom actions */}
        <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
          <div>
            <div className="text-xs text-zinc-400">Add-ons Subtotal</div>
            <div className="text-lg font-black text-white">₹{totalAddonAmount}</div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onProceed([])}
              className="rounded-xl px-4 py-2.5 text-xs font-semibold text-zinc-400 hover:text-white transition"
            >
              Skip Add-ons
            </button>
            <button
              onClick={handleContinue}
              className="flex items-center gap-2 rounded-xl bg-[#e50914] px-5 py-2.5 text-xs font-bold text-white hover:bg-red-700 transition shadow-lg shadow-red-950/40"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

