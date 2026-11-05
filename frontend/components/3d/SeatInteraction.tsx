'use client';

import React, { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useCinemaStore } from '@/store/useCinemaStore';
import type { SeatRecord } from '@/lib/types';
import layoutData from '@/public/models/seat_layout_v2.json';

interface SeatInteractionProps {
  onSeatClick?: (seatId: string) => void;
  onSeatDoubleClick?: (seatId: string) => void;
}

export function SeatInteraction({ onSeatClick, onSeatDoubleClick }: SeatInteractionProps) {
  const seats = (layoutData as unknown as { seats: SeatRecord[] }).seats;

  const setHoveredSeat = useCinemaStore((s) => s.setHoveredSeat);
  const toggleSeat = useCinemaStore((s) => s.toggleSeat);

  // Debug flag (?debug=proxies, dev builds only)
  const [debugProxies, setDebugProxies] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
      const params = new URLSearchParams(window.location.search);
      setDebugProxies(params.get('debug') === 'proxies');
    }
  }, []);

  // Throttled hover dispatch to avoid flooding state during rapid cursor sweeps
  const lastHoverRef = useRef<string | null>(null);
  const handleHover = useCallback((seatId: string) => {
    if (lastHoverRef.current === seatId) return;
    lastHoverRef.current = seatId;
    setHoveredSeat(seatId);
  }, [setHoveredSeat]);

  const handleUnhover = useCallback((seatId: string) => {
    if (lastHoverRef.current === seatId) {
      lastHoverRef.current = null;
      setHoveredSeat(null);
    }
  }, [setHoveredSeat]);

  const handleClick = useCallback((seatId: string) => {
    if (onSeatClick) {
      onSeatClick(seatId);
    } else {
      toggleSeat(seatId);
    }
  }, [onSeatClick, toggleSeat]);

  const handleDoubleClick = useCallback((seatId: string) => {
    if (onSeatDoubleClick) {
      onSeatDoubleClick(seatId);
    }
  }, [onSeatDoubleClick]);

  return (
    <group name="SeatInteractionLayer">
      {/* 100 Static collision volumes with ZERO re-render overhead */}
      {seats.map((seat) => (
        <StaticSeatProxyItem
          key={seat.seat_id}
          seat={seat}
          debugProxies={debugProxies}
          onSelect={handleClick}
          onDoubleClick={handleDoubleClick}
          onHover={handleHover}
          onUnhover={handleUnhover}
        />
      ))}
    </group>
  );
}

interface StaticSeatProxyItemProps {
  seat: SeatRecord;
  debugProxies: boolean;
  onSelect: (seatId: string) => void;
  onDoubleClick: (seatId: string) => void;
  onHover: (seatId: string) => void;
  onUnhover: (seatId: string) => void;
}

const StaticSeatProxyItem = React.memo(function StaticSeatProxyItem({
  seat,
  debugProxies,
  onSelect,
  onDoubleClick,
  onHover,
  onUnhover,
}: StaticSeatProxyItemProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Compute box dimensions and center from static bounds
  const { min, max } = seat.bounds_gltf_y_up;
  const size: [number, number, number] = useMemo(
    () => [
      Math.max(0.1, max[0] - min[0] + 0.04),
      Math.max(0.1, max[1] - min[1] + 0.04),
      Math.max(0.1, max[2] - min[2] + 0.04),
    ],
    [min, max]
  );

  const center: [number, number, number] = useMemo(
    () => [
      (min[0] + max[0]) / 2,
      (min[1] + max[1]) / 2,
      (min[2] + max[2]) / 2,
    ],
    [min, max]
  );

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(seat.seat_id);
  };

  const handleDoubleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onDoubleClick(seat.seat_id);
  };

  return (
    <group position={center} name={`proxy_${seat.seat_id}`}>
      <mesh
        ref={meshRef}
        visible={true}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(seat.seat_id);
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          onUnhover(seat.seat_id);
        }}
      >
        <boxGeometry args={size} />
        <meshBasicMaterial
          transparent
          opacity={debugProxies ? 0.35 : 0}
          depthWrite={false}
          colorWrite={debugProxies}
          color="#38bdf8"
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
});
