'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { IMapInstance } from './MapAdapter';
import { createMapAdapter } from './MapFactory';
import { getDirectionsUrl } from './MapAdapter';

interface AdminMapPickerProps {
  cinemaId: number;
  initialLat: number;
  initialLng: number;
  cinemaName: string;
  onSaved?: (lat: number, lng: number) => void;
  className?: string;
}

export function AdminMapPicker({
  cinemaId,
  initialLat,
  initialLng,
  cinemaName,
  onSaved,
  className = '',
}: AdminMapPickerProps) {
  const [lat, setLat] = useState(initialLat);
  const [lng, setLng] = useState(initialLng);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<IMapInstance | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let isMounted = true;
    const adapter = createMapAdapter();

    adapter
      .init({
        container: containerRef.current,
        center: [lat, lng],
        zoom: 14,
        markers: [
          {
            id: 'admin-picked-pin',
            lat,
            lng,
            title: cinemaName,
            isSelected: true,
          },
        ],
        onMapClick: (newLat, newLng) => {
          const roundedLat = Math.round(newLat * 10000) / 10000;
          const roundedLng = Math.round(newLng * 10000) / 10000;
          setLat(roundedLat);
          setLng(roundedLng);
          if (mapInstanceRef.current) {
            mapInstanceRef.current.updateMarkers([
              {
                id: 'admin-picked-pin',
                lat: roundedLat,
                lng: roundedLng,
                title: cinemaName,
                isSelected: true,
              },
            ]);
            mapInstanceRef.current.setCenter(roundedLat, roundedLng);
          }
        },
      })
      .then((instance) => {
        if (isMounted) {
          mapInstanceRef.current = instance;
        } else {
          instance.destroy();
        }
      });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy();
        mapInstanceRef.current = null;
      }
    };
  }, [cinemaId]);

  const handleManualUpdate = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.updateMarkers([
        {
          id: 'admin-picked-pin',
          lat,
          lng,
          title: cinemaName,
          isSelected: true,
        },
      ]);
      mapInstanceRef.current.setCenter(lat, lng);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch(`/api/v1/admin/cinemas/${cinemaId}/coordinates`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          latitude: lat,
          longitude: lng,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to update coordinates');
      }

      setSaveStatus('Coordinates updated successfully!');
      if (onSaved) onSaved(lat, lng);
    } catch (err: any) {
      setSaveStatus(`Error: ${err.message || 'Could not save'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`space-y-4 bg-white p-5 rounded-2xl border border-[#E6DCD2] ${className}`} data-testid="admin-map-picker">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-[#1B1320]">Edit Coordinates: {cinemaName}</h3>
          <p className="text-sm text-[#4A4056]">
            Click anywhere on the map to place the cinema pin, or type exact coordinates below.
          </p>
        </div>
        <a
          href={getDirectionsUrl(lat, lng)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-[#0E8F8A] bg-[#E6F6F0] rounded-xl hover:bg-[#d0efe4] transition-colors"
          data-testid="preview-directions-link"
        >
          Verify in Google Maps ↗
        </a>
      </div>

      <div
        ref={containerRef}
        className="w-full h-72 rounded-xl overflow-hidden border border-[#E6DCD2] bg-[#FFF8F1]"
        data-testid="admin-picker-map"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="admin-lat-input" className="block text-sm font-semibold text-[#1B1320] mb-1">
            Latitude (°N)
          </label>
          <input
            id="admin-lat-input"
            type="number"
            step="0.0001"
            value={lat}
            onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
            onBlur={handleManualUpdate}
            className="w-full h-12 px-3 text-base rounded-xl border border-[#E6DCD2] bg-[#FFF8F1] focus:outline-none focus:border-[#C8102E]"
            data-testid="admin-lat-input"
          />
        </div>
        <div>
          <label htmlFor="admin-lng-input" className="block text-sm font-semibold text-[#1B1320] mb-1">
            Longitude (°E)
          </label>
          <input
            id="admin-lng-input"
            type="number"
            step="0.0001"
            value={lng}
            onChange={(e) => setLng(parseFloat(e.target.value) || 0)}
            onBlur={handleManualUpdate}
            className="w-full h-12 px-3 text-base rounded-xl border border-[#E6DCD2] bg-[#FFF8F1] focus:outline-none focus:border-[#C8102E]"
            data-testid="admin-lng-input"
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        {saveStatus && (
          <span
            className={`text-sm font-medium ${
              saveStatus.includes('Error') ? 'text-[#C62828]' : 'text-[#0E8F8A]'
            }`}
            data-testid="admin-save-status"
          >
            {saveStatus}
          </span>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="ml-auto px-6 h-12 font-bold text-white bg-[#C8102E] hover:bg-[#A60D26] disabled:opacity-50 rounded-xl shadow-md transition-colors"
          data-testid="admin-save-coords-button"
        >
          {isSaving ? 'Saving...' : 'Save Coordinates'}
        </button>
      </div>
    </div>
  );
}
