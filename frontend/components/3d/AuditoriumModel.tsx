'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCinemaStore } from '@/store/useCinemaStore';
import { assertSceneCoordinates } from '@/lib/assertCoordinates';
import layoutData from '@/public/models/seat_layout_v2.json';
import type { SeatLayoutFile } from '@/lib/types';

const WEB_MODEL_PATH = '/models/cineverse_auditorium_v2.web.glb';
const HQ_MODEL_PATH = '/models/cineverse_auditorium_v2.glb';

export function AuditoriumModel() {
  const useHqModel = useCinemaStore((s) => s.useHqModel);
  const modelUrl = useHqModel ? HQ_MODEL_PATH : WEB_MODEL_PATH;

  const { scene } = useGLTF(modelUrl);
  const cameraMode = useCinemaStore((s) => s.cameraMode);
  const activeSeatId = useCinemaStore((s) => s.activeSeatId);
  const selectedSeats = useCinemaStore((s) => s.selectedSeats);
  const hoveredSeatId = useCinemaStore((s) => s.hoveredSeatId);
  const seatStatuses = useCinemaStore((s) => s.seatStatuses);

  const seats = (layoutData as unknown as SeatLayoutFile).seats;
  const seatNodeMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of seats) {
      map.set(s.seat_id, s.node_name);
    }
    return map;
  }, [seats]);

  const seatMaterials = useRef<Map<string, THREE.MeshStandardMaterial>>(new Map());

  // Clone materials per seat on model load so seat states render on actual seat meshes
  useEffect(() => {
    if (!scene) return;
    seatMaterials.current.clear();

    seatNodeMap.forEach((nodeName, seatId) => {
      const node = scene.getObjectByName(nodeName) as THREE.Mesh | undefined;
      if (node && (node as any).isMesh) {
        const origMat = Array.isArray(node.material) ? node.material[0] : node.material;
        const cloned = (origMat as THREE.MeshStandardMaterial).clone();
        node.material = cloned;
        seatMaterials.current.set(seatId, cloned);
      }
    });
  }, [scene, seatNodeMap]);

  // Assert coordinates on load in dev
  useEffect(() => {
    if (scene) {
      assertSceneCoordinates(scene, layoutData as unknown as SeatLayoutFile);
    }
  }, [scene]);

  // Handle hiding the active seat in POV mode so it doesn't clip the lens
  useEffect(() => {
    if (!scene) return;

    // Reset all seats visibility
    seatNodeMap.forEach((nodeName) => {
      const node = scene.getObjectByName(nodeName);
      if (node) {
        node.visible = true;
      }
    });

    // Hide only the current active seat mesh in POV
    if (cameraMode === 'pov' && activeSeatId) {
      const activeNodeName = seatNodeMap.get(activeSeatId);
      if (activeNodeName) {
        const activeNode = scene.getObjectByName(activeNodeName);
        if (activeNode) {
          activeNode.visible = false;
        }
      }
    }
  }, [scene, cameraMode, activeSeatId, seatNodeMap]);

  // Dynamically update seat states (colors, emissive rim, pulse) on seat materials
  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const pulse = 0.45 + Math.sin(time * 3.5) * 0.25;

    for (const seat of seats) {
      const mat = seatMaterials.current.get(seat.seat_id);
      if (!mat) continue;

      const isSelected = selectedSeats.includes(seat.seat_id);
      const rawStatus = seatStatuses[seat.seat_id] || 'available';
      const isHeld = rawStatus === 'held';
      const isBooked = rawStatus === 'booked';
      const isHovered = hoveredSeatId === seat.seat_id;

      if (isSelected) {
        // Selected: vibrant red accent + high emissive glow, readable from the back
        mat.color.set('#c81e28');
        mat.emissive.set('#ff2233');
        mat.emissiveIntensity = 0.9;
        mat.roughness = 0.65;
      } else if (isHeld) {
        // Held by someone else: amber accent with gentle pulse
        mat.color.set('#b45309');
        mat.emissive.set('#f59e0b');
        mat.emissiveIntensity = pulse;
        mat.roughness = 0.75;
      } else if (isBooked) {
        // Booked: desaturated/darkened seat
        mat.color.set('#202227');
        mat.emissive.set('#000000');
        mat.emissiveIntensity = 0;
        mat.roughness = 0.95;
      } else if (isHovered) {
        // Hover: soft outline / fresnel rim on the real seat mesh
        mat.color.set('#8e151d');
        mat.emissive.set('#ffffff');
        mat.emissiveIntensity = 0.5;
        mat.roughness = 0.7;
      } else {
        // Available: natural velvet seat colour with subtle category-coloured accent
        mat.color.set('#78141b');
        switch (seat.category) {
          case 'front':
            mat.emissive.set('#c9a227');
            mat.emissiveIntensity = 0.08;
            break;
          case 'prime':
            mat.emissive.set('#3b82f6');
            mat.emissiveIntensity = 0.08;
            break;
          case 'premier':
            mat.emissive.set('#a855f7');
            mat.emissiveIntensity = 0.08;
            break;
          default:
            mat.emissive.set('#000000');
            mat.emissiveIntensity = 0;
        }
        mat.roughness = 0.75;
      }
    }
  });

  return <primitive object={scene} name="AuditoriumBaseModel" />;
}

// Preload models for immediate fast rendering
useGLTF.preload(WEB_MODEL_PATH);
useGLTF.preload(HQ_MODEL_PATH);
