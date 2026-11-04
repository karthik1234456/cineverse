'use client';

import React, { useRef, useMemo, useState, useEffect } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
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

  // Debug flag (?debug=proxies, dev builds only)
  const [debugProxies, setDebugProxies] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
      const params = new URLSearchParams(window.location.search);
      setDebugProxies(params.get('debug') === 'proxies');
    }
  }, []);

  return (
    <group name="SeatInteractionLayer">
      {seats.map((seat) => (
        <SeatProxyItem
          key={seat.seat_id}
          seat={seat}
          debugProxies={debugProxies}
          onSeatClick={onSeatClick}
          onSeatDoubleClick={onSeatDoubleClick}
        />
      ))}
    </group>
  );
}

interface SeatProxyItemProps {
  seat: SeatRecord;
  debugProxies: boolean;
  onSeatClick?: (seatId: string) => void;
  onSeatDoubleClick?: (seatId: string) => void;
}

function SeatProxyItem({ seat, debugProxies, onSeatClick, onSeatDoubleClick }: SeatProxyItemProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const edgesRef = useRef<THREE.LineSegments>(null);

  const seatStatuses = useCinemaStore((s) => s.seatStatuses);
  const selectedSeats = useCinemaStore((s) => s.selectedSeats);
  const hoveredSeatId = useCinemaStore((s) => s.hoveredSeatId);
  const setHoveredSeat = useCinemaStore((s) => s.setHoveredSeat);
  const toggleSeat = useCinemaStore((s) => s.toggleSeat);
  const enterPOV = useCinemaStore((s) => s.enterPOV);

  // Compute box dimensions and center from bounds
  const { min, max } = seat.bounds_gltf_y_up;
  const size = useMemo(
    () => [
      Math.max(0.1, max[0] - min[0] + 0.04),
      Math.max(0.1, max[1] - min[1] + 0.04),
      Math.max(0.1, max[2] - min[2] + 0.04),
    ] as [number, number, number],
    [min, max]
  );

  const center = useMemo(
    () => [
      (min[0] + max[0]) / 2,
      (min[1] + max[1]) / 2,
      (min[2] + max[2]) / 2,
    ] as [number, number, number],
    [min, max]
  );

  // State derivation
  const rawStatus = seatStatuses[seat.seat_id] || 'available';
  const isSelected = selectedSeats.includes(seat.seat_id);
  const isHovered = hoveredSeatId === seat.seat_id;
  const isBooked = rawStatus === 'booked';
  const isHeld = rawStatus === 'held';

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (onSeatClick) {
      onSeatClick(seat.seat_id);
    } else {
      toggleSeat(seat.seat_id);
    }
  };

  const handleDoubleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (onSeatDoubleClick) {
      onSeatDoubleClick(seat.seat_id);
    } else {
      enterPOV(seat.seat_id);
    }
  };

  return (
    <group position={center} name={`proxy_${seat.seat_id}`}>
      {/* Invisible Raycasting Hit Box (zero pixels rasterized in normal mode) */}
      <mesh
        ref={meshRef}
        visible={true}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          if (!isBooked) setHoveredSeat(seat.seat_id);
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          if (hoveredSeatId === seat.seat_id) setHoveredSeat(null);
        }}
      >
        <boxGeometry args={size} />
        <meshBasicMaterial
          transparent
          opacity={debugProxies ? 0.35 : 0}
          depthWrite={false}
          colorWrite={debugProxies}
          color={isSelected ? '#e50914' : isHeld ? '#f59e0b' : '#38bdf8'}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Wireframe Outline Highlight: ONLY in debugProxies mode */}
      {debugProxies && (
        <lineSegments ref={edgesRef}>
          <edgesGeometry args={[new THREE.BoxGeometry(...size)]} />
          <lineBasicMaterial
            color={isSelected ? '#ff4d5a' : isHeld ? '#fbbf24' : '#38bdf8'}
            linewidth={1}
          />
        </lineSegments>
      )}

      {/* Selected Indicator: small elegant badge above headrest with checkmark */}
      {isSelected && (
        <group position={[0, size[1] / 2 + 0.18, 0]}>
          <Html center distanceFactor={18} position={[0, 0, 0]}>
            <div className="pointer-events-none flex h-4 w-4 items-center justify-center rounded-full bg-[#e50914] text-[9px] font-bold text-white shadow-[0_0_8px_#e50914]">
              ✓
            </div>
          </Html>
        </group>
      )}

      {/* Held Indicator: pulsing amber pill */}
      {isHeld && (
        <group position={[0, size[1] / 2 + 0.18, 0]}>
          <Html center distanceFactor={18} position={[0, 0, 0]}>
            <div className="pointer-events-none flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 text-[8px] font-bold text-black shadow-[0_0_8px_#f59e0b] animate-pulse">
              ●
            </div>
          </Html>
        </group>
      )}

      {/* Booked Indicator: subtle small cross */}
      {isBooked && (
        <group position={[0, size[1] / 2 + 0.18, 0]}>
          <Html center distanceFactor={18} position={[0, 0, 0]}>
            <div className="pointer-events-none flex h-3 w-3 items-center justify-center rounded-full bg-zinc-800 text-[8px] font-semibold text-zinc-400 border border-zinc-700">
              ✕
            </div>
          </Html>
        </group>
      )}

      {/* Hovered indicator (if not selected/booked/held) */}
      {isHovered && !isSelected && !isBooked && !isHeld && (
        <group position={[0, size[1] / 2 + 0.18, 0]}>
          <Html center distanceFactor={18} position={[0, 0, 0]}>
            <div className="pointer-events-none whitespace-nowrap rounded bg-slate-900/90 px-1.5 py-0.5 text-[10px] font-medium text-slate-100 border border-slate-700 shadow-md">
              {seat.seat_id}
            </div>
          </Html>
        </group>
      )}
    </group>
  );
}
