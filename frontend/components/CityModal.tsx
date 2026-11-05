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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-xl rounded-3xl border border-[#E6DCD2] bg-[#FFF8F1] p-6 shadow-2xl text-[#1B1320]">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-[#4A4056] hover:bg-[#FDEBD8] hover:text-[#1B1320] transition min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FDEBD8] text-[#C8102E]">
            <MapPin className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-[#1B1320]">Select Your City</h2>
            <p className="text-sm text-[#4A4056]">Movie showtimes and cinemas are tailored to your location</p>
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
                className={`group flex items-center justify-between rounded-2xl border p-4 text-left transition min-h-[48px] ${
                  isSelected
                    ? 'border-[#C8102E] bg-white text-[#C8102E] font-bold shadow-sm'
                    : 'border-[#E6DCD2] bg-white text-[#1B1320] hover:border-[#C8102E] hover:bg-[#FDEBD8]'
                }`}
              >
                <div>
                  <div className="text-base font-bold">{city.name}</div>
                  <div className="text-sm text-[#4A4056]">{city.state}</div>
                </div>
                {isSelected && <Check className="h-5 w-5 text-[#C8102E]" />}
              </button>
            );
          })}
        </div>

        <div className="mt-6 border-t border-[#E6DCD2] pt-4 flex justify-between items-center text-sm text-[#4A4056]">
          <span>Popular: Bengaluru, Mumbai, Delhi NCR</span>
          <span className="font-semibold text-[#1B1320]">All India Service</span>
        </div>
      </div>
    </div>
  );
}

