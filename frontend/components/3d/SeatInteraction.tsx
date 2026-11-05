'use client';

import React, { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useCinemaStore } from '@/store/useCinemaStore';
import type { SeatRecord } from '@/lib/types';
import layoutData from '@/public/models/seat_layout_v2.json';
import obstructionsData from '@/public/models/seat_obstructions.json';
import { viewScore } from '@/lib/seatScoring';

interface SeatInteractionProps {
  onSeatClick?: (seatId: string) => void;
  onSeatDoubleClick?: (seatId: string) => void;
}

export function SeatInteraction({ onSeatClick, onSeatDoubleClick }: SeatInteractionProps) {
  const seats = (layoutData as unknown as { seats: SeatRecord[] }).seats;

  // Single subscriptions for the ONE active tooltip
  const hoveredSeatId = useCinemaStore((s) => s.hoveredSeatId);
  const activeSeatId = useCinemaStore((s) => s.activeSeatId);
  const selectedSeats = useCinemaStore((s) => s.selectedSeats);
  const seatPrices = useCinemaStore((s) => s.seatPrices);
  const seatStatuses = useCinemaStore((s) => s.seatStatuses);
  const setHoveredSeat = useCinemaStore((s) => s.setHoveredSeat);
  const toggleSeat = useCinemaStore((s) => s.toggleSeat);
  const enterPOV = useCinemaStore((s) => s.enterPOV);

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
    } else {
      enterPOV(seatId);
    }
  }, [onSeatDoubleClick, enterPOV]);

  // Compute hovered seat metadata for the single tooltip
  const hoveredSeat = useMemo(() => {
    if (!hoveredSeatId) return null;
    return seats.find((s) => s.seat_id === hoveredSeatId) || null;
  }, [hoveredSeatId, seats]);

  const tooltipData = useMemo(() => {
    if (!hoveredSeat) return null;
    const { min, max } = hoveredSeat.bounds_gltf_y_up;
    const center: [number, number, number] = [
      (min[0] + max[0]) / 2,
      (min[1] + max[1]) / 2 + (max[1] - min[1]) / 2 + 0.35,
      (min[2] + max[2]) / 2,
    ];

    const rawStatus = seatStatuses[hoveredSeat.seat_id] || 'available';
    const isSelected = selectedSeats.includes(hoveredSeat.seat_id);
    const isBooked = rawStatus === 'booked';
    const isHeld = rawStatus === 'held';

    const priceInfo = seatPrices[hoveredSeat.seat_id];
    const price = priceInfo ? Math.round(priceInfo.price) : (hoveredSeat.price || 380);
    const categoryName = (priceInfo?.category || hoveredSeat.category || 'Prime').toUpperCase();
    const scored = viewScore(hoveredSeat as any);
    const score = scored.score;
    const obstruction = (obstructionsData as any).seats?.[hoveredSeat.seat_id];

    return {
      seat: hoveredSeat,
      center,
      rawStatus,
      isSelected,
      isBooked,
      isHeld,
      price,
      categoryName,
      score,
      obstruction,
    };
  }, [hoveredSeat, seatStatuses, selectedSeats, seatPrices]);

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

      {/* SINGLE Compact Hover Tooltip (Part E / Task 5 compliance) */}
      {tooltipData && (
        <group position={tooltipData.center} name={`tooltip_${tooltipData.seat.seat_id}`}>
          <Html
            center
            distanceFactor={16}
            position={[0, 0, 0]}
            style={{ pointerEvents: 'auto', zIndex: 50 }}
          >
            <div
              data-testid={`seat-tooltip-${tooltipData.seat.seat_id}`}
              className="pointer-events-auto w-[220px] rounded-2xl border border-[#E6DCD2] bg-white/95 p-3.5 text-center text-[#1B1320] shadow-2xl backdrop-blur-md transition-all duration-150 animate-in fade-in zoom-in-95"
            >
              <div className="flex items-center justify-between gap-2 border-b border-[#E6DCD2] pb-1.5">
                <span className="text-base font-black tracking-tight text-[#1B1320]">
                  Seat {tooltipData.seat.seat_id}
                </span>
                <span className="rounded-md bg-rose-50 px-2 py-0.5 text-sm font-bold uppercase tracking-wider text-[#9F1239] border border-rose-200">
                  {tooltipData.categoryName}
                </span>
              </div>

              <div className="my-2 text-2xl font-black tracking-tight text-[#C8102E]">
                ₹{tooltipData.price}
              </div>

              <div className="text-sm font-semibold text-slate-600">
                {tooltipData.isBooked
                  ? 'Booked (Sold Out)'
                  : tooltipData.isHeld
                    ? 'Held by patron'
                    : tooltipData.isSelected
                      ? 'Selected • Click to remove'
                      : 'Available • Click to select'}
              </div>
            </div>
          </Html>
        </group>
      )}
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
