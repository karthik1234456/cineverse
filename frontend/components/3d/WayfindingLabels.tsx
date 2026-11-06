'use client';

import React, { useMemo } from 'react';
import { Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { useCinemaStore } from '@/store/useCinemaStore';
import layoutData from '@/public/models/seat_layout_v2.json';
import type { SeatLayoutFile } from '@/lib/types';

export function WayfindingLabels() {
  const cameraMode = useCinemaStore((s) => s.cameraMode);
  const mode = useCinemaStore((s) => s.mode);
  const auditoriumLayout = useCinemaStore((s) => s.auditoriumLayout);
  const seats = auditoriumLayout?.seats || (layoutData as unknown as SeatLayoutFile).seats;

  // Compute row aisle anchor positions
  const rowPositions = useMemo(() => {
    const rows = Array.from(new Set(seats.map((s) => s.row))).sort();
    return rows.map((rowName) => {
      const rowSeats = seats.filter((s) => s.row === rowName);
      const minXSeat = rowSeats.reduce((prev, curr) =>
        curr.position_gltf_y_up[0] < prev.position_gltf_y_up[0] ? curr : prev
      );
      const maxXSeat = rowSeats.reduce((prev, curr) =>
        curr.position_gltf_y_up[0] > prev.position_gltf_y_up[0] ? curr : prev
      );

      return {
        row: rowName,
        leftPos: [
          minXSeat.position_gltf_y_up[0] - 0.72,
          minXSeat.position_gltf_y_up[1] + 0.35,
          minXSeat.position_gltf_y_up[2],
        ] as [number, number, number],
        rightPos: [
          maxXSeat.position_gltf_y_up[0] + 0.72,
          maxXSeat.position_gltf_y_up[1] + 0.35,
          maxXSeat.position_gltf_y_up[2],
        ] as [number, number, number],
      };
    });
  }, [seats]);

  // Hide in walk, seated, and POV modes per Part H item 3
  if (cameraMode === 'pov' || mode === 'seated' || mode === 'walk' || cameraMode === 'walk') return null;

  return (
    <group name="WayfindingLabelsLayer">
      {rowPositions.map(({ row, leftPos, rightPos }) => (
        <React.Fragment key={row}>
          <CompactRowBadge position={leftPos} letter={row} />
          <CompactRowBadge position={rightPos} letter={row} />
        </React.Fragment>
      ))}
    </group>
  );
}

function CompactRowBadge({ position, letter }: { position: [number, number, number]; letter: string }) {
  const texture = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Sleek, compact semi-transparent rounded pill
    ctx.fillStyle = 'rgba(15, 17, 23, 0.75)';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(8, 8, 48, 48, 10);
    } else {
      ctx.rect(8, 8, 48, 48);
    }
    ctx.fill();

    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.stroke();

    ctx.fillStyle = '#f1f5f9';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, 32, 33);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [letter]);

  if (!texture) return null;

  return (
    <Billboard position={position}>
      <mesh>
        <planeGeometry args={[0.28, 0.28]} />
        <meshBasicMaterial
          map={texture}
          transparent
          opacity={0.85}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </Billboard>
  );
}
