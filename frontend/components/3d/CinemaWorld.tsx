'use client';

import React, { Suspense, useState, useEffect, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCinemaStore } from '@/store/useCinemaStore';
import { AuditoriumModel } from './AuditoriumModel';
import { SeatInteraction } from './SeatInteraction';
import { ProceduralAuditorium } from './ProceduralAuditorium';
import { CameraController } from './CameraController';
import { TheatreLighting } from './TheatreLighting';
import { CinemaScreen } from './Screen';
import { WayfindingLabels } from './WayfindingLabels';
import { GroupSeatMarkers } from './GroupSeatMarkers';
import { MotionVFXScene } from './MotionVFXScene';
import { LoadingOverlay, WebGLFallback } from './LoadingOverlay';

interface CinemaWorldProps {
  onSeatSelect?: (seatId: string) => void;
}

export function CinemaWorld({ onSeatSelect }: CinemaWorldProps) {
  const [hasWebGL, setHasWebGL] = useState(true);
  const [canvasError, setCanvasError] = useState<string | null>(null);
  const qualityMode = useCinemaStore((s) => s.qualityMode);
  const proceduralResult = useCinemaStore((s) => s.proceduralResult);

  // Check WebGL availability
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl =
        canvas.getContext('webgl2') ||
        canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl');
      if (!gl) {
        setHasWebGL(false);
      }
    } catch {
      setHasWebGL(false);
    }
  }, []);

  if (!hasWebGL) {
    return <WebGLFallback />;
  }

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[#07080a] select-none touch-none">
      <Canvas
        camera={{
          position: [6.5, 8.5, -22.5],
          fov: 60,
          near: 0.1,
          far: 90,
        }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.98,
        }}
        dpr={qualityMode === 'smooth' ? 1.0 : [1, 1.5]}
        frameloop="always" // Dynamically managed by AdaptiveFrameloopController
        onCreated={({ gl, scene }) => {
          gl.setClearColor('#07080a', 1.0);
          scene.background = new THREE.Color('#07080a');
        }}
      >
        <fog attach="fog" args={['#07080a', 18, 65]} />
        <Suspense fallback={null}>
          <AdaptiveFrameloopController />
          {proceduralResult ? (
            <ProceduralAuditorium
              geometry={proceduralResult.geometry}
              seats={proceduralResult.seatLayout.seats}
              onSeatClick={onSeatSelect}
            />
          ) : (
            <>
              <AuditoriumModel />
              <SeatInteraction onSeatClick={onSeatSelect} />
            </>
          )}
          <CinemaScreen />
          <TheatreLighting />
          <MotionVFXScene />
          <WayfindingLabels />
          <GroupSeatMarkers />
          <CameraController />
          <DevBridge />
        </Suspense>
      </Canvas>

      <LoadingOverlay
        error={canvasError}
        onRetry={() => {
          setCanvasError(null);
          window.location.reload();
        }}
      />
    </div>
  );
}

/**
 * Adaptive Frame Loop Controller:
 * Enforces render-on-demand when scene is static and switches to continuous 60fps
 * when camera transitions, player walks, user drags/orbits, or trailer video plays.
 */
function AdaptiveFrameloopController() {
  const setFrameloop = useThree((s) => s.setFrameloop);
  const invalidate = useThree((s) => s.invalidate);
  const isPlaying = useCinemaStore((s) => s.trailer.isPlaying);
  const mode = useCinemaStore((s) => s.mode);
  const isContinuous = useCinemaStore((s) => s.isContinuousRendering);
  const selectedSeats = useCinemaStore((s) => s.selectedSeats);
  const seatStatuses = useCinemaStore((s) => s.seatStatuses);
  const hoveredSeatId = useCinemaStore((s) => s.hoveredSeatId);
  const houseLights = useCinemaStore((s) => s.houseLights);
  const qualityMode = useCinemaStore((s) => s.qualityMode);
  const theatreLook = useCinemaStore((s) => s.theatreLook);

  // Invalidate and render frame whenever interactive state changes
  useEffect(() => {
    invalidate();
  }, [hoveredSeatId, selectedSeats, seatStatuses, houseLights, qualityMode, theatreLook, invalidate]);

  // Manage dynamic continuous vs demand frameloop
  useEffect(() => {
    const shouldBeContinuous = isPlaying || mode === 'walk' || isContinuous;
    setFrameloop(shouldBeContinuous ? 'always' : 'demand');
    invalidate();
  }, [isPlaying, mode, isContinuous, setFrameloop, invalidate]);

  return null;
}

/**
 * Dev bridge that captures render stats and exposes window.__cineverse
 */
function DevBridge() {
  const { gl, camera, scene } = useThree();
  const exportState = useCinemaStore((s) => s.exportState);
  const selectSeat = useCinemaStore((s) => s.selectSeat);
  const enterPOV = useCinemaStore((s) => s.enterPOV);
  const exitPOV = useCinemaStore((s) => s.exitPOV);
  const setMode = useCinemaStore((s) => s.setMode);
  const sitAt = useCinemaStore((s) => s.sitAt);
  const standUp = useCinemaStore((s) => s.standUp);
  const teleportToRow = useCinemaStore((s) => s.teleportToRow);
  const walkToSeat = useCinemaStore((s) => s.walkToSeat);
  const setCameraPreset = useCinemaStore((s) => s.setCameraPreset);
  const updateSeatStatus = useCinemaStore((s) => s.updateSeatStatus);
  const setHouseLights = useCinemaStore((s) => s.setHouseLights);
  const setQualityTier = useCinemaStore((s) => s.setQualityTier);
  const setQualityMode = useCinemaStore((s) => s.setQualityMode);
  const setFOV = useCinemaStore((s) => s.setFOV);

  const fpsFrames = useRef(0);
  const lastFpsTime = useRef(performance.now());
  const currentFps = useRef(60);

  // Expose dev-only window.__cineverse for Playwright E2E and diagnostics
  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.__cineverse = {
      getState: () => {
        const state = exportState();
        const persCam = camera as THREE.PerspectiveCamera;
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(persCam.quaternion).normalize();
        const toScreen = new THREE.Vector3(0.0, 5.55, -1.255).sub(persCam.position).normalize();
        const forwardDot = forward.dot(toScreen);
        const projected = new THREE.Vector3(0.0, 5.55, -1.255).project(persCam);
        const screenVisible = projected.z < 1 && Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1;

        return {
          ...state,
          cameraPosition: [persCam.position.x, persCam.position.y, persCam.position.z],
          fov: persCam.fov,
          forwardDot,
          screenVisible,
          rendererInfo: {
            triangles: gl.info.render.triangles,
            calls: gl.info.render.calls,
            fps: currentFps.current,
            geometries: gl.info.memory.geometries,
            textures: gl.info.memory.textures,
          },
        };
      },
      selectSeat,
      enterPOV,
      exitPOV,
      setMode,
      sitAt,
      standUp,
      teleportToRow,
      walkToSeat,
      setCameraPreset,
      toggleCompare: useCinemaStore.getState().toggleCompare,
      simulateHold: (seatId: string) => updateSeatStatus(seatId, 'held'),
      updateSeatStatus,
      setHouseLights,
      setTheatreLook: (look: 'a' | 'b' | 'c') => useCinemaStore.getState().setTheatreLook(look),
      setQualityTier,
      setQualityMode,
      setFOV,
      setHoveredSeat: (seatId: string | null) => useCinemaStore.getState().setHoveredSeat(seatId),
      getStore: () => useCinemaStore.getState(),
      getVisibleProxiesCount: () => {
        let count = 0;
        const layer = scene.getObjectByName('SeatInteractionLayer');
        if (layer) {
          layer.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
              const mat = obj.material as THREE.Material & { colorWrite?: boolean; opacity?: number };
              if (obj.visible && mat.colorWrite !== false && (mat.opacity ?? 1) > 0) {
                count++;
              }
            }
            if (obj instanceof THREE.LineSegments && obj.visible) {
              count++;
            }
          });
        }
        return count;
      },
    };
    (window as any).useCinemaStore = useCinemaStore;

    return () => {
      delete window.__cineverse;
      delete (window as any).useCinemaStore;
    };
  }, [
    gl,
    camera,
    scene,
    exportState,
    selectSeat,
    enterPOV,
    exitPOV,
    setMode,
    sitAt,
    standUp,
    teleportToRow,
    walkToSeat,
    setCameraPreset,
    updateSeatStatus,
    setHouseLights,
    setQualityTier,
    setQualityMode,
    setFOV,
  ]);

  // Track FPS periodically for getState().rendererInfo without triggering store re-renders
  useFrame(() => {
    fpsFrames.current++;
    const now = performance.now();
    if (now - lastFpsTime.current >= 1000) {
      currentFps.current = Math.round((fpsFrames.current * 1000) / (now - lastFpsTime.current));
      fpsFrames.current = 0;
      lastFpsTime.current = now;
    }
  });

  return null;
}
