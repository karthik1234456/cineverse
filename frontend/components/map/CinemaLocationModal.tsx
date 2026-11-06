'use client';

import React, { useEffect } from 'react';
import { X, ExternalLink, MapPin, Train, Car, Phone, Clock } from 'lucide-react';
import { MiniMap } from './MiniMap';
import { getDirectionsUrl } from './MapAdapter';

export interface CinemaLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  cinema: {
    name: string;
    address: string;
    latitude?: number | null;
    longitude?: number | null;
    pincode?: string | null;
    landmark?: string | null;
    parking?: string | null;
    transit_stop?: string | null;
    phone?: string | null;
    opening_hours?: string | null;
    distance_km?: number | null;
  } | null;
}

export function CinemaLocationModal({ isOpen, onClose, cinema }: CinemaLocationModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen || !cinema) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Location details for ${cinema.name}`}
      data-testid="cinema-location-modal"
    >
      <div className="relative w-full max-w-lg rounded-3xl bg-white border border-[#E6DCD2] p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#C8102E] bg-[#FFF8F1] px-2.5 py-0.5 rounded-full border border-[#C8102E]/20">
                Theatre Location
              </span>
              {cinema.distance_km != null && (
                <span className="text-xs font-bold text-[#2563EB] bg-[#EAF1FF] px-2 py-0.5 rounded-full">
                  {cinema.distance_km} km away
                </span>
              )}
            </div>
            <h3 className="text-2xl font-black text-[#1B1320] mt-1">{cinema.name}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[#4A4056] hover:text-[#1B1320] hover:bg-slate-100 transition"
            aria-label="Close location dialog"
            data-testid="close-cinema-modal-btn"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* MiniMap */}
        {cinema.latitude != null && cinema.longitude != null ? (
          <MiniMap
            latitude={cinema.latitude}
            longitude={cinema.longitude}
            cinemaName={cinema.name}
            className="w-full h-56 rounded-2xl"
          />
        ) : (
          <div className="w-full h-56 rounded-2xl bg-[#FFF8F1] border border-[#E6DCD2] flex items-center justify-center text-slate-500">
            Coordinates not available
          </div>
        )}

        {/* Address and Landmark */}
        <div className="space-y-1 text-sm">
          <p className="flex items-start gap-2 text-base text-[#1B1320] font-semibold">
            <MapPin className="h-4 w-4 text-[#C8102E] shrink-0 mt-1" />
            <span>{cinema.address}</span>
          </p>
          {cinema.landmark && (
            <p className="text-sm text-[#4A4056] pl-6">
              <span className="font-semibold text-[#1B1320]">Landmark:</span> {cinema.landmark}
            </p>
          )}
          {cinema.pincode && (
            <p className="text-sm text-[#4A4056] pl-6">
              <span className="font-semibold text-[#1B1320]">PIN:</span> {cinema.pincode}
            </p>
          )}
        </div>

        {/* Transit & Parking Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-[#E6DCD2] text-sm">
          {cinema.transit_stop && (
            <div className="flex items-center gap-2 text-[#4A4056]">
              <Train className="h-4 w-4 text-[#0E8F8A] shrink-0" />
              <span>{cinema.transit_stop}</span>
            </div>
          )}
          {cinema.parking && (
            <div className="flex items-center gap-2 text-[#4A4056]">
              <Car className="h-4 w-4 text-amber-600 shrink-0" />
              <span>Parking: {cinema.parking}</span>
            </div>
          )}
          {cinema.phone && (
            <div className="flex items-center gap-2 text-[#4A4056]">
              <Phone className="h-4 w-4 text-slate-500 shrink-0" />
              <span>{cinema.phone}</span>
            </div>
          )}
          {cinema.opening_hours && (
            <div className="flex items-center gap-2 text-[#4A4056]">
              <Clock className="h-4 w-4 text-slate-500 shrink-0" />
              <span>{cinema.opening_hours}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-[#E6DCD2] flex items-center justify-between">
          {cinema.latitude != null && cinema.longitude != null && (
            <a
              href={getDirectionsUrl(cinema.latitude, cinema.longitude)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[48px] items-center gap-2 rounded-xl border border-[#0E8F8A] px-5 py-2.5 text-base font-bold text-[#0E8F8A] bg-[#E6F6F0] hover:bg-[#d4f2e7] transition"
              data-testid="modal-directions-btn"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Open in Google Maps</span>
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto min-h-[48px] px-6 py-2.5 font-bold text-[#1B1320] bg-slate-100 hover:bg-slate-200 rounded-xl transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
