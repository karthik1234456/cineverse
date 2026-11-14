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
import type { ScreenStrategy } from '@/store/useCinemaStore';

interface CinemaWorldProps {
  onSeatSelect?: (seatId: string) => void;
  overrideScreenMode?: ScreenStrategy;
  screenSolidColor?: string;
  onScreenTelemetryUpdate?: (telemetry: any) => void;
}

export function CinemaWorld({
  onSeatSelect,
  overrideScreenMode,
  screenSolidColor,
  onScreenTelemetryUpdate,
}: CinemaWorldProps) {
  const [hasWebGL, setHasWebGL] = useState(true);
  const [canvasError, setCanvasError] = useState<string | null>(null);
  const qualityMode = useCinemaStore((s) => s.qualityMode);
  const houseLights = useCinemaStore((s) => s.houseLights);
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
          near: 0.05,
          far: 90,
        }}
        gl={{
          antialias: true,
          alpha: overrideScreenMode === 'youtube_css3d',
          preserveDrawingBuffer: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: houseLights === 'show' ? 0.90 : 1.05,
        }}
        dpr={qualityMode === 'smooth' ? 1.0 : [1, 1.5]}
        frameloop="always" // Dynamically managed by AdaptiveFrameloopController
        onCreated={({ gl, scene }) => {
          if (overrideScreenMode === 'youtube_css3d') {
            gl.setClearColor('#000000', 0.0);
            scene.background = null;
          } else {
            gl.setClearColor('#0E0F12', 1.0);
            scene.background = new THREE.Color('#0E0F12');
          }
        }}
      >
        {overrideScreenMode !== 'youtube_css3d' && (
          <fog
            attach="fog"
            args={[
              '#0E0F12',
              houseLights === 'show' ? 25 : 60,
              houseLights === 'show' ? 90 : 250,
            ]}
          />
        )}
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
          <CinemaScreen
            overrideMode={overrideScreenMode}
            solidColor={screenSolidColor}
            onTelemetryUpdate={onScreenTelemetryUpdate}
          />
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
  const { gl, scene } = useThree();
  const isPlaying = useCinemaStore((s) => s.trailer.isPlaying);
  const mode = useCinemaStore((s) => s.mode);
  const isContinuous = useCinemaStore((s) => s.isContinuousRendering);
  const selectedSeats = useCinemaStore((s) => s.selectedSeats);
  const seatStatuses = useCinemaStore((s) => s.seatStatuses);
  const hoveredSeatId = useCinemaStore((s) => s.hoveredSeatId);
  const houseLights = useCinemaStore((s) => s.houseLights);
  const qualityMode = useCinemaStore((s) => s.qualityMode);
  const theatreLook = useCinemaStore((s) => s.theatreLook);

  // Synchronize tone mapping exposure and background color on lighting switch
  useEffect(() => {
    gl.toneMappingExposure = houseLights === 'show' ? 0.90 : 1.05;
    gl.setClearColor('#0E0F12', 1.0);
    if (scene) {
      scene.background = new THREE.Color('#0E0F12');
    }
    invalidate();
  }, [gl, scene, houseLights, invalidate]);

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
      setLightIntensity: (intensity: 'normal' | 'brighter') => useCinemaStore.getState().setLightIntensity(intensity),
      setTheatreLook: (look: 'a' | 'b' | 'c') => useCinemaStore.getState().setTheatreLook(look),
      setQualityTier,
      setQualityMode,
      setFOV,
      setHoveredSeat: (seatId: string | null) => useCinemaStore.getState().setHoveredSeat(seatId),
      sampleLuminance: () => {
        const rawGl = gl.getContext();
        const width = rawGl.drawingBufferWidth || gl.domElement.width;
        const height = rawGl.drawingBufferHeight || gl.domElement.height;
        const pixels = new Uint8Array(width * height * 4);
        rawGl.readPixels(0, 0, width, height, rawGl.RGBA, rawGl.UNSIGNED_BYTE, pixels);

        let totalLuminance = 0;
        let nearBlackCount = 0;
        let above15Count = 0;
        let highlightCount = 0;
        let redDominantCount = 0;

        // 8 Hue classes: red, orange, yellow, green, cyan, blue, purple, neutral
        const hueClassCounts: Record<string, number> = {
          red: 0,
          orange: 0,
          yellow: 0,
          green: 0,
          cyan: 0,
          blue: 0,
          purple: 0,
          neutral: 0,
        };

        const step = 4;
        let sampled = 0;
        for (let i = 0; i < pixels.length; i += 4 * step) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const rN = r / 255.0;
          const gN = g / 255.0;
          const bN = b / 255.0;

          // Normalized luminance (0.0 to 1.0)
          const normLum = 0.2126 * rN + 0.7152 * gN + 0.0722 * bN;
          totalLuminance += normLum;
          if (normLum < 0.05) nearBlackCount++;
          if (normLum > 0.15) above15Count++;
          if (normLum > 0.96) highlightCount++;
          if (r > g * 1.25 && r > b * 1.25 && r > 40) redDominantCount++;

          // Saturation and chromatic classification
          const maxRGB = Math.max(rN, gN, bN);
          const minRGB = Math.min(rN, gN, bN);
          const delta = maxRGB - minRGB;
          const saturation = maxRGB > 0 ? delta / maxRGB : 0;

          // Threshold: count only pixels with saturation >= 0.15 and normLum >= 0.05
          if (saturation < 0.15 || normLum < 0.05) {
            hueClassCounts.neutral++;
          } else {
            let h = 0;
            if (maxRGB === rN) h = ((gN - bN) / delta + (gN < bN ? 6 : 0)) * 60;
            else if (maxRGB === gN) h = ((bN - rN) / delta + 2) * 60;
            else h = ((rN - gN) / delta + 4) * 60;
            h = (h + 360) % 360;

            if (h >= 345 || h < 15) {
              hueClassCounts.red++;
            } else if (h >= 15 && h < 45) {
              hueClassCounts.orange++;
            } else if (h >= 45 && h < 75) {
              hueClassCounts.yellow++;
            } else if (h >= 75 && h < 165) {
              hueClassCounts.green++;
            } else if (h >= 165 && h < 195) {
              hueClassCounts.cyan++;
            } else if (h >= 195 && h < 255) {
              hueClassCounts.blue++;
            } else {
              hueClassCounts.purple++;
            }
          }

          sampled++;
        }

        const meanNorm = sampled > 0 ? totalLuminance / sampled : 0;

        // Build full 8-class histogram percentages
        const hueHistogram: Record<string, number> = {};
        let maxClassShare = 0;
        let maxChromaticShare = 0;

        for (const [cls, count] of Object.entries(hueClassCounts)) {
          const share = sampled > 0 ? Math.round((count / sampled) * 1000) / 10 : 0;
          hueHistogram[cls] = share;
          if (share > maxClassShare) {
            maxClassShare = share;
          }
          if (cls !== 'neutral' && share > maxChromaticShare) {
            maxChromaticShare = share;
          }
        }

        return {
          meanLuminance: Math.round(meanNorm * 1000) / 1000,
          meanLuminance255: Math.round(meanNorm * 255 * 10) / 10,
          nearBlackPercent: Math.round((nearBlackCount / sampled) * 1000) / 10,
          above15Percent: Math.round((above15Count / sampled) * 1000) / 10,
          highlightPercent: Math.round((highlightCount / sampled) * 1000) / 10,
          redDominantPercent: Math.round((redDominantCount / sampled) * 1000) / 10,
          hueHistogram,
          max_class_share: maxClassShare,
          maxHueDominancePercent: maxChromaticShare,
          width,
          height,
        };
      },
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
      getShadowCastersCount: () => {
        let count = 0;
        scene.traverse((obj: any) => {
          if (obj && obj.isLight && obj.castShadow) {
            count++;
          }
        });
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
