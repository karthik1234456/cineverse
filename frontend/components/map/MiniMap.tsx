'use client';

import React, { useEffect, useRef } from 'react';
import { createMapAdapter } from './MapFactory';
import type { IMapInstance } from './MapAdapter';

interface MiniMapProps {
  latitude: number;
  longitude: number;
  cinemaName: string;
  className?: string;
  zoom?: number;
}

export function MiniMap({
  latitude,
  longitude,
  cinemaName,
  className = 'w-full h-48',
  zoom = 14,
}: MiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<IMapInstance | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let isMounted = true;
    const adapter = createMapAdapter();

    adapter
      .init({
        container: containerRef.current,
        center: [latitude, longitude],
        zoom,
        interactive: false,
        markers: [
          {
            id: 'minimap-pin',
            lat: latitude,
            lng: longitude,
            title: cinemaName,
            isSelected: true,
          },
        ],
      })
      .then((instance) => {
        if (isMounted) {
          instanceRef.current = instance;
        } else {
          instance.destroy();
        }
      })
      .catch((err) => {
        console.error('[MiniMap] Initialization error:', err);
      });

    return () => {
      isMounted = false;
      if (instanceRef.current) {
        instanceRef.current.destroy();
        instanceRef.current = null;
      }
    };
  }, [latitude, longitude, cinemaName, zoom]);

  return (
    <div
      ref={containerRef}
      className={`relative rounded-xl overflow-hidden border border-[#E6DCD2] bg-[#FFF8F1] z-0 ${className}`}
      data-testid="cinema-mini-map"
      aria-label={`Map location of ${cinemaName}`}
    />
  );
}
