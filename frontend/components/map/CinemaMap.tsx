'use client';

import React, { useEffect, useRef } from 'react';
import type { CinemaItem } from '@/lib/types';
import { createMapAdapter } from './MapFactory';
import type { IMapInstance, MapMarker } from './MapAdapter';

interface CinemaMapProps {
  cinemas: CinemaItem[];
  selectedCinemaId: number | null;
  onSelectCinema: (cinemaId: number) => void;
  userCoords?: { lat: number; lng: number } | null;
  cityCenter: [number, number];
  zoom?: number;
  className?: string;
}

export function CinemaMap({
  cinemas,
  selectedCinemaId,
  onSelectCinema,
  userCoords,
  cityCenter,
  zoom = 12,
  className = 'w-full h-full min-h-[460px]',
}: CinemaMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<IMapInstance | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let isMounted = true;
    const adapter = createMapAdapter();

    const markers: MapMarker[] = [];

    // Add user location marker if available
    if (userCoords) {
      markers.push({
        id: 'user-location-pin',
        lat: userCoords.lat,
        lng: userCoords.lng,
        title: 'Your Location',
        isUserLocation: true,
      });
    }

    // Add cinema markers
    cinemas.forEach((c) => {
      if (c.latitude != null && c.longitude != null) {
        markers.push({
          id: c.id,
          lat: c.latitude,
          lng: c.longitude,
          title: c.name,
          subtitle: c.address,
          isSelected: c.id === selectedCinemaId,
        });
      }
    });

    const initialCenter: [number, number] = userCoords
      ? [userCoords.lat, userCoords.lng]
      : selectedCinemaId
      ? (() => {
          const sc = cinemas.find((c) => c.id === selectedCinemaId);
          return sc && sc.latitude != null && sc.longitude != null
            ? [sc.latitude, sc.longitude]
            : cityCenter;
        })()
      : cityCenter;

    adapter
      .init({
        container: containerRef.current,
        center: initialCenter,
        zoom,
        markers,
        onMarkerClick: (marker) => {
          if (!marker.isUserLocation) {
            onSelectCinema(Number(marker.id));
          }
        },
      })
      .then((instance) => {
        if (isMounted) {
          mapInstanceRef.current = instance;
          // Fit bounds if multiple cinemas and no single selection
          if (!selectedCinemaId && cinemas.length > 1) {
            const bounds: [number, number][] = cinemas
              .filter((c) => c.latitude != null && c.longitude != null)
              .map((c) => [c.latitude!, c.longitude!]);
            if (userCoords) {
              bounds.push([userCoords.lat, userCoords.lng]);
            }
            instance.fitBounds(bounds);
          }
        } else {
          instance.destroy();
        }
      })
      .catch((err) => {
        console.error('[CinemaMap] Initialization failed:', err);
      });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy();
        mapInstanceRef.current = null;
      }
    };
  }, [cityCenter, userCoords]);

  // Update markers when selection or cinema list changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const markers: MapMarker[] = [];
    if (userCoords) {
      markers.push({
        id: 'user-location-pin',
        lat: userCoords.lat,
        lng: userCoords.lng,
        title: 'Your Location',
        isUserLocation: true,
      });
    }

    cinemas.forEach((c) => {
      if (c.latitude != null && c.longitude != null) {
        markers.push({
          id: c.id,
          lat: c.latitude,
          lng: c.longitude,
          title: c.name,
          subtitle: c.address,
          isSelected: c.id === selectedCinemaId,
        });
      }
    });

    mapInstanceRef.current.updateMarkers(markers);

    if (selectedCinemaId) {
      const sc = cinemas.find((c) => c.id === selectedCinemaId);
      if (sc && sc.latitude != null && sc.longitude != null) {
        mapInstanceRef.current.setCenter(sc.latitude, sc.longitude, 14);
      }
    }
  }, [cinemas, selectedCinemaId, userCoords]);

  return (
    <div
      ref={containerRef}
      className={`relative rounded-2xl overflow-hidden border border-[#E6DCD2] bg-[#FFF8F1] z-0 ${className}`}
      data-testid="interactive-theatre-map"
      aria-label="Interactive Cinema Map"
      role="region"
    />
  );
}
