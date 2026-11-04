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
  const seatPrices = useCinemaStore((s) => s.seatPrices);
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

  const priceInfo = seatPrices[seat.seat_id];
  const price = priceInfo ? Math.round(priceInfo.price) : (seat.price || 380);
  const categoryName = (priceInfo?.category || seat.category || 'Prime').toUpperCase();

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
            <div className="pointer-events-none flex h-5 w-5 items-center justify-center rounded-full bg-[#C8102E] text-xs font-bold text-white shadow-[0_0_8px_#C8102E]">
              ✓
            </div>
          </Html>
        </group>
      )}

      {/* Held Indicator: pulsing amber pill */}
      {isHeld && (
        <group position={[0, size[1] / 2 + 0.18, 0]}>
          <Html center distanceFactor={18} position={[0, 0, 0]}>
            <div className="pointer-events-none flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-black shadow-[0_0_8px_#f59e0b] animate-pulse">
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

      {/* Rich Seat Hover Tooltip (§ Task 5) */}
      {isHovered && (
        <group position={[0, size[1] / 2 + 0.35, 0]}>
          <Html
            center
            distanceFactor={16}
            position={[0, 0, 0]}
            style={{ pointerEvents: 'auto', zIndex: 50 }}
          >
            <div
              data-testid={`seat-tooltip-${seat.seat_id}`}
              className="pointer-events-auto min-w-[170px] rounded-2xl border border-[#E6DCD2] bg-white/95 p-3.5 text-center text-[#1B1320] shadow-2xl backdrop-blur-md"
            >
              <div className="flex items-center justify-between gap-3 border-b border-[#E6DCD2] pb-1.5">
                <span className="text-base font-black tracking-tight text-[#1B1320]">
                  Seat {seat.seat_id}
                </span>
                <span className="rounded-md bg-rose-50 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-[#9F1239] border border-rose-200">
                  {categoryName}
                </span>
              </div>
              <div className="my-2 text-2xl font-black tracking-tight text-[#C8102E]">
                ₹{price}
              </div>
              <div className="text-xs font-semibold text-slate-600">
                {isBooked ? 'Booked (Sold Out)' : isHeld ? 'Held by patron' : isSelected ? 'Selected' : 'Available • Click to select'}
              </div>
              {!isHeld && !isBooked && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSeat(seat.seat_id);
                  }}
                  data-testid={`seat-select-btn-${seat.seat_id}`}
                  className={`mt-2.5 w-full rounded-xl py-2 text-xs font-bold transition shadow-sm ${
                    isSelected
                      ? 'bg-slate-200 text-slate-800 hover:bg-slate-300'
                      : 'bg-[#C8102E] text-white hover:bg-[#A60D26]'
                  }`}
                >
                  {isSelected ? 'Deselect' : 'Select Seat'}
                </button>
              )}
            </div>
          </Html>
        </group>
      )}
    </group>
  );
}
