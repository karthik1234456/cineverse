'use client';

import React, { useMemo } from 'react';
import { Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { useCinemaStore } from '@/store/useCinemaStore';
import layoutData from '@/public/models/seat_layout_v2.json';
import type { SeatLayoutFile } from '@/lib/types';

export function GroupSeatMarkers() {
  const groupMemberMap = useCinemaStore((s) => s.groupMemberMap);
  const auditoriumLayout = useCinemaStore((s) => s.auditoriumLayout);
  const seats = auditoriumLayout?.seats || (layoutData as unknown as SeatLayoutFile).seats;

  // Build seatId -> member lookup
  const seatMemberMap = useMemo(() => {
    const map = new Map<string, { initials: string; color: string; userName: string }>();
    if (!groupMemberMap) return map;

    for (const member of Object.values(groupMemberMap)) {
      const allMemberSeats = [
        ...(member.proposedSeats || []),
        ...(member.assignedSeats || []),
      ];
      for (const seatId of allMemberSeats) {
        map.set(seatId, {
          initials: member.initials,
          color: member.color || '#E50914',
          userName: member.userName,
        });
      }
    }
    return map;
  }, [groupMemberMap]);

  // Find 3D positions for marked seats
  const markers = useMemo(() => {
    if (seatMemberMap.size === 0) return [];
    const list: {
      seatId: string;
      position: [number, number, number];
      initials: string;
      color: string;
    }[] = [];

    for (const seat of seats) {
      const m = seatMemberMap.get(seat.seat_id);
      if (m) {
        list.push({
          seatId: seat.seat_id,
          position: [
            seat.position_gltf_y_up[0],
            seat.position_gltf_y_up[1] + 0.55,
            seat.position_gltf_y_up[2],
          ],
          initials: m.initials,
          color: m.color,
        });
      }
    }
    return list;
  }, [seatMemberMap, seats]);

  if (markers.length === 0) return null;

  return (
    <group name="GroupSeatMarkersLayer">
      {markers.map((m) => (
        <GroupMarkerPin
          key={m.seatId}
          position={m.position}
          initials={m.initials}
          color={m.color}
        />
      ))}
    </group>
  );
}

function GroupMarkerPin({
  position,
  initials,
  color,
}: {
  position: [number, number, number];
  initials: string;
  color: string;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 128, 128);

      // Outer circle
      ctx.beginPath();
      ctx.arc(64, 64, 56, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Inner border
      ctx.lineWidth = 8;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();

      // Initials text
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 44px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(initials, 64, 66);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }, [initials, color]);

  return (
    <group position={position}>
      {/* Billboard Initial Avatar Badge */}
      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        <mesh position={[0, 0.2, 0]}>
          <planeGeometry args={[0.42, 0.42]} />
          <meshBasicMaterial map={texture} transparent depthWrite={false} />
        </mesh>
      </Billboard>

      {/* Floating 3D glowing ring indicator */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.15, 0]}>
        <ringGeometry args={[0.18, 0.24, 32]} />
        <meshBasicMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

