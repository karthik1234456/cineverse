// components/CityModal.tsx
'use client';

import React from 'react';
import { MapPin, X, Check } from 'lucide-react';
import type { City } from '@/services/api';

interface CityModalProps {
  isOpen: boolean;
  onClose: () => void;
  cities: City[];
  selectedCity: City | null;
  onSelectCity: (city: City) => void;
}

export function CityModal({
  isOpen,
  onClose,
  cities,
  selectedCity,
  onSelectCity,
}: CityModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-xl rounded-2xl border border-white/10 bg-[#16181f] p-6 shadow-2xl text-white">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-white transition"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600/20 text-[#e50914]">
            <MapPin className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Select Your City</h2>
            <p className="text-xs text-zinc-400">Movie showtimes and cinemas are tailored to your location</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {cities.map((city) => {
            const isSelected = selectedCity?.id === city.id;
            return (
              <button
                key={city.id}
                data-testid={`city-option-${city.slug}`}
                onClick={() => {
                  onSelectCity(city);
                  onClose();
                }}
                className={`group flex items-center justify-between rounded-xl border p-4 text-left transition ${
                  isSelected
                    ? 'border-[#e50914] bg-[#e50914]/10 text-white font-semibold'
                    : 'border-white/5 bg-[#0f1014] text-zinc-300 hover:border-white/20 hover:bg-white/5'
                }`}
              >
                <div>
                  <div className="text-base font-semibold">{city.name}</div>
                  <div className="text-xs text-zinc-400">{city.state}</div>
                </div>
                {isSelected && <Check className="h-4 w-4 text-[#e50914]" />}
              </button>
            );
          })}
        </div>

        <div className="mt-6 border-t border-white/10 pt-4 flex justify-between items-center text-xs text-zinc-500">
          <span>Popular: Bengaluru, Mumbai, Delhi NCR</span>
          <span className="text-zinc-400">All India Delivery</span>
        </div>
      </div>
    </div>
  );
}

