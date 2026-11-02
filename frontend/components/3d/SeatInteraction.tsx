'use client';

import React, { useRef, useMemo } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
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

  return (
    <group name="SeatInteractionLayer">
      {seats.map((seat) => (
        <SeatProxyItem
          key={seat.seat_id}
          seat={seat}
          onSeatClick={onSeatClick}
          onSeatDoubleClick={onSeatDoubleClick}
        />
      ))}
    </group>
  );
}

interface SeatProxyItemProps {
  seat: SeatRecord;
  onSeatClick?: (seatId: string) => void;
  onSeatDoubleClick?: (seatId: string) => void;
}

function SeatProxyItem({ seat, onSeatClick, onSeatDoubleClick }: SeatProxyItemProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const edgesRef = useRef<THREE.LineSegments>(null);

  const seatStatuses = useCinemaStore((s) => s.seatStatuses);
  const selectedSeats = useCinemaStore((s) => s.selectedSeats);
  const activeSeatId = useCinemaStore((s) => s.activeSeatId);
  const hoveredSeatId = useCinemaStore((s) => s.hoveredSeatId);
  const setHoveredSeat = useCinemaStore((s) => s.setHoveredSeat);
  const toggleSeat = useCinemaStore((s) => s.toggleSeat);
  const enterPOV = useCinemaStore((s) => s.enterPOV);
  const cameraMode = useCinemaStore((s) => s.cameraMode);

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
  const isActive = activeSeatId === seat.seat_id;
  const isHovered = hoveredSeatId === seat.seat_id;
  const isBooked = rawStatus === 'booked';
  const isHeld = rawStatus === 'held';

  // Category colour
  const categoryColor = useMemo(() => {
    switch (seat.category) {
      case 'front':
        return '#c9a227';
      case 'prime':
        return '#4f8cff';
      case 'premier':
        return '#b04fff';
      default:
        return '#38bdf8';
    }
  }, [seat.category]);

  // Pulsing animation for held seats
  useFrame(({ clock }) => {
    if (isHeld && meshRef.current) {
      const pulse = 0.35 + Math.sin(clock.getElapsedTime() * 4) * 0.15;
      (meshRef.current.material as THREE.MeshBasicMaterial).opacity = pulse;
    }
  });

  // State visual configuration
  let fillColor = 'transparent';
  let fillOpacity = 0.0;
  let strokeColor = 'transparent';
  let strokeOpacity = 0.0;
  let showBox = false;

  if (isSelected) {
    fillColor = '#e50914'; // Cinematic Red
    fillOpacity = 0.42;
    strokeColor = '#ff4d5a';
    strokeOpacity = 0.95;
    showBox = true;
  } else if (isHeld) {
    fillColor = '#f59e0b'; // Amber
    fillOpacity = 0.35;
    strokeColor = '#fbbf24';
    strokeOpacity = 0.85;
    showBox = true;
  } else if (isBooked) {
    fillColor = '#18181b'; // Dark grey / desaturated
    fillOpacity = 0.55;
    strokeColor = '#3f3f46';
    strokeOpacity = 0.4;
    showBox = true;
  } else if (isHovered) {
    fillColor = categoryColor;
    fillOpacity = 0.28;
    strokeColor = '#ffffff';
    strokeOpacity = 0.9;
    showBox = true;
  } else if (isActive && cameraMode !== 'pov') {
    fillColor = categoryColor;
    fillOpacity = 0.18;
    strokeColor = categoryColor;
    strokeOpacity = 0.6;
    showBox = true;
  }

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
      {/* Invisible Raycasting Hit Box (always present for picking) */}
      <mesh
        ref={meshRef}
        visible={showBox}
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
          color={fillColor}
          transparent
          opacity={fillOpacity}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Wireframe Outline Highlight */}
      {showBox && strokeOpacity > 0 && (
        <lineSegments ref={edgesRef}>
          <edgesGeometry args={[new THREE.BoxGeometry(...size)]} />
          <lineBasicMaterial
            color={strokeColor}
            transparent
            opacity={strokeOpacity}
            linewidth={2}
          />
        </lineSegments>
      )}

      {/* When box is not shown, provide an invisible hit target */}
      {!showBox && (
        <mesh
          visible={false}
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
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      )}

      {/* Floating 3D Badge on Selected or Hovered Seat */}
      {(isSelected || (isHovered && !isBooked)) && (
        <mesh position={[0, size[1] / 2 + 0.22, 0]}>
          <sphereGeometry args={[0.07, 16, 16]} />
          <meshBasicMaterial
            color={isSelected ? '#e50914' : categoryColor}
            toneMapped={false}
          />
        </mesh>
      )}
    </group>
  );
}
