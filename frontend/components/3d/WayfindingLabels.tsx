'use client';

import React, { useMemo } from 'react';
import { Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { useCinemaStore } from '@/store/useCinemaStore';
import layoutData from '@/public/models/seat_layout_v2.json';
import type { SeatLayoutFile } from '@/lib/types';

export function WayfindingLabels() {
  const cameraMode = useCinemaStore((s) => s.cameraMode);
  const seats = (layoutData as unknown as SeatLayoutFile).seats;

  // Compute row aisle anchor positions
  const rowPositions = useMemo(() => {
    const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
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
          minXSeat.position_gltf_y_up[0] - 0.85,
          minXSeat.position_gltf_y_up[1] + 0.6,
          minXSeat.position_gltf_y_up[2],
        ] as [number, number, number],
        rightPos: [
          maxXSeat.position_gltf_y_up[0] + 0.85,
          maxXSeat.position_gltf_y_up[1] + 0.6,
          maxXSeat.position_gltf_y_up[2],
        ] as [number, number, number],
      };
    });
  }, [seats]);

  if (cameraMode === 'pov') return null;

  return (
    <group name="WayfindingLabelsLayer">
      {rowPositions.map(({ row, leftPos, rightPos }) => (
        <React.Fragment key={row}>
          <RowBadge position={leftPos} letter={row} />
          <RowBadge position={rightPos} letter={row} />
        </React.Fragment>
      ))}
    </group>
  );
}

function RowBadge({ position, letter }: { position: [number, number, number]; letter: string }) {
  const texture = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Glowing badge circle
    ctx.fillStyle = 'rgba(24, 27, 34, 0.85)';
    ctx.beginPath();
    ctx.arc(64, 64, 52, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 4;
    ctx.strokeStyle = '#e50914';
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 56px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, 64, 66);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [letter]);

  if (!texture) return null;

  return (
    <Billboard position={position}>
      <mesh>
        <planeGeometry args={[0.55, 0.55]} />
        <meshBasicMaterial
          map={texture}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </Billboard>
  );
}

