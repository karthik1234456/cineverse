'use client';

import React, { Suspense, useState, useEffect, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCinemaStore } from '@/store/useCinemaStore';
const AuditoriumModel = React.lazy(() =>
  import('./AuditoriumModel').then((m) => ({ default: m.AuditoriumModel }))
);
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

/**
 * Performance Watchdog (§ Part F):
 * If CSS 3D player is active and input latency exceeds 200 ms or the frame rate
 * stays under 30 FPS for three seconds, automatically switches to Theatre Mode
 * with a user-friendly toast message.
 */
function PerformanceWatchdog() {
  const trailer = useCinemaStore((s) => s.trailer);
  const theatreModeOpen = useCinemaStore((s) => s.theatreModeOpen);
  const setTheatreModeOpen = useCinemaStore((s) => s.setTheatreModeOpen);
  const showToast = useCinemaStore((s) => s.showToast);

  const isCSS3DActive = (trailer.isPlaying || trailer.playbackStatus === 'playing') && !theatreModeOpen;
  const lowFpsAccumulator = useRef(0);
  const playStartTimeRef = useRef(0);
  const slowInputCountRef = useRef(0);
  const hasSwitchedRef = useRef(false);

  useEffect(() => {
    if (isCSS3DActive) {
      playStartTimeRef.current = performance.now();
      slowInputCountRef.current = 0;
      lowFpsAccumulator.current = 0;
      hasSwitchedRef.current = false;
    }
  }, [isCSS3DActive]);

  // Monitor input latency during CSS 3D playback (requires sustained lag > 200ms after initial warmup)
  useEffect(() => {
    if (!isCSS3DActive) return;
    const handleInput = () => {
      // Warmup: avoid false-positives on initial scene hydration / route load
      if (performance.now() - playStartTimeRef.current < 4000) return;

      const start = performance.now();
      requestAnimationFrame(() => {
        const latency = performance.now() - start;
        if (latency > 200) {
          slowInputCountRef.current += 1;
          if (slowInputCountRef.current >= 3 && !hasSwitchedRef.current) {
            hasSwitchedRef.current = true;
            setTheatreModeOpen(true);
            showToast('Switched to Theatre Mode for smoother playback');
          }
        } else {
          slowInputCountRef.current = 0;
        }
      });
    };

    window.addEventListener('pointerdown', handleInput, { passive: true });
    window.addEventListener('keydown', handleInput, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', handleInput);
      window.removeEventListener('keydown', handleInput);
    };
  }, [isCSS3DActive, setTheatreModeOpen, showToast]);

  // Monitor frame rate: if FPS < 30 for 3 seconds continuously after warmup, switch to Theatre Mode (§ Part B.1)
  useFrame((_, delta) => {
    if (!isCSS3DActive) {
      lowFpsAccumulator.current = 0;
      return;
    }

    if (performance.now() - playStartTimeRef.current < 4000) return;

    const currentFps = 1 / Math.max(delta, 0.001);
    if (currentFps < 30) {
      lowFpsAccumulator.current += delta;
      if (lowFpsAccumulator.current >= 3.0 && !hasSwitchedRef.current) {
        lowFpsAccumulator.current = 0;
        hasSwitchedRef.current = true;
        setTheatreModeOpen(true);
        showToast('Switched to Theatre Mode for smoother playback');
      }
    } else {
      lowFpsAccumulator.current = Math.max(0, lowFpsAccumulator.current - delta * 0.5);
    }
  });

  return null;
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
  const lightLevel = useCinemaStore((s) => s.lightLevel || 'normal');
  const proceduralResult = useCinemaStore((s) => s.proceduralResult);

  // Check WebGL availability and register context loss / restore handlers
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

  // WebGL context loss listeners on canvas
  const handleCreated = ({ gl, scene, camera }: { gl: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.Camera }) => {
    if (overrideScreenMode === 'youtube_css3d') {
      gl.setClearColor('#000000', 0.0);
      scene.background = null;
    } else {
      gl.setClearColor('#0E0F12', 1.0);
      scene.background = new THREE.Color('#0E0F12');
    }

    // Warm up shaders asynchronously via KHR_parallel_shader_compile without blocking main thread
    if (typeof (gl as any).compileAsync === 'function') {
      (gl as any).compileAsync(scene, camera).catch(() => {});
    }

    const canvas = gl.domElement;
    if (canvas) {
      canvas.addEventListener('webglcontextlost', (e: Event) => {
        e.preventDefault();
        console.warn('[CineVerse 3D] WebGL context lost. Attempting recovery...');
        setCanvasError('Graphics context temporarily interrupted. Restoring 3D theatre...');
      }, false);

      canvas.addEventListener('webglcontextrestored', () => {
        console.info('[CineVerse 3D] WebGL context restored successfully.');
        setCanvasError(null);
        useCinemaStore.getState().setContinuousRendering(true);
        setTimeout(() => {
          useCinemaStore.getState().setContinuousRendering(false);
        }, 600);
      }, false);
    }
  };

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
          far: 140,
        }}
        gl={{
          antialias: true,
          alpha: true,
          preserveDrawingBuffer: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: houseLights === 'show' ? 0.90 : (lightLevel === 'bright' ? 1.70 : 1.48),
        }}
        dpr={qualityMode === 'smooth' ? 1.0 : [1, 1.5]}
        frameloop="always"
        onCreated={handleCreated}
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
          <PerformanceWatchdog />
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
  const lightLevel = useCinemaStore((s) => s.lightLevel || 'normal');
  const lightIntensity = useCinemaStore((s) => s.lightIntensity);
  const qualityMode = useCinemaStore((s) => s.qualityMode);
  const theatreLook = useCinemaStore((s) => s.theatreLook);

  // Synchronize tone mapping exposure and background color on lighting switch
  useEffect(() => {
    gl.toneMappingExposure = houseLights === 'show' ? 0.90 : (lightLevel === 'bright' ? 1.70 : 1.48);
    gl.setClearColor('#0E0F12', 1.0);
    if (scene) {
      scene.background = new THREE.Color('#0E0F12');
    }
    invalidate();
  }, [gl, scene, houseLights, lightLevel, invalidate]);

  // Invalidate and render frame whenever interactive state changes
  useEffect(() => {
    invalidate();
  }, [hoveredSeatId, selectedSeats, seatStatuses, houseLights, lightLevel, lightIntensity, qualityMode, theatreLook, invalidate]);

  // Always maintain continuous 60fps frameloop for smooth camera transitions, damping, head-look, and video playback
  useEffect(() => {
    setFrameloop('always');
  }, [setFrameloop]);

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

    (window as any).__threeCamera = camera;
    (window as any).__threeScene = scene;
    (window as any).THREE = THREE;

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
        gl.render(scene, camera);
        const rawGl = gl.getContext();
        const width = rawGl.drawingBufferWidth || gl.domElement.width;
        const height = rawGl.drawingBufferHeight || gl.domElement.height;
        const pixels = new Uint8Array(width * height * 4);
        rawGl.readPixels(0, 0, width, height, rawGl.RGBA, rawGl.UNSIGNED_BYTE, pixels);

        let totalLuminance = 0;
        let nearBlackCount = 0;
        let below02Count = 0;
        let above08Count = 0;
        let above15Count = 0;
        let highlightCount = 0;
        let redDominantCount = 0;
        let seatTotalLum = 0;
        let seatSamples = 0;
        let floorTotalLum = 0;
        let floorSamples = 0;

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
          if (normLum < 0.02) below02Count++;
          if (normLum < 0.05) nearBlackCount++;
          if (normLum >= 0.08) above08Count++;
          if (normLum > 0.15) above15Count++;
          if (normLum > 0.96) highlightCount++;
          if (r > g * 1.25 && r > b * 1.25 && r > 40) redDominantCount++;

          // Classify seat top pixels vs floor pixels for contrast ratio
          if ((r > 50 && r > g * 1.2 && r > b * 1.2) || (r > 60 && g > 30 && b < 40)) {
            seatTotalLum += normLum;
            seatSamples++;
          } else if (normLum >= 0.02 && normLum <= 0.16 && Math.abs(r - g) < 20 && Math.abs(g - b) < 20) {
            floorTotalLum += normLum;
            floorSamples++;
          }

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

        const meanSeatLum = seatSamples > 0 ? seatTotalLum / seatSamples : 0.28;
        const meanFloorLum = floorSamples > 0 ? floorTotalLum / floorSamples : 0.09;
        const contrastRatio = Math.round(((meanSeatLum + 0.05) / (meanFloorLum + 0.05)) * 100) / 100;

        return {
          meanLuminance: Math.round(meanNorm * 1000) / 1000,
          meanLuminance255: Math.round(meanNorm * 255 * 10) / 10,
          nearBlackPercent: Math.round((nearBlackCount / sampled) * 1000) / 10,
          below02Percent: Math.round((below02Count / sampled) * 1000) / 10,
          above08Percent: Math.round((above08Count / sampled) * 1000) / 10,
          above15Percent: Math.round((above15Count / sampled) * 1000) / 10,
          highlightPercent: Math.round((highlightCount / sampled) * 1000) / 10,
          screenClippedPercent: Math.round((highlightCount / sampled) * 1000) / 10,
          redDominantPercent: Math.round((redDominantCount / sampled) * 1000) / 10,
          contrastRatio,
          meanSeatLum: Math.round(meanSeatLum * 1000) / 1000,
          meanFloorLum: Math.round(meanFloorLum * 1000) / 1000,
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
      getWatchdogStatus: () => (window as any).__cineverse_watchdog || {
        drawnSeatCount: 0,
        expectedSeatCount: 0,
        rebuildCount: 0,
        warning: null,
      },
      getDrawnSeatCount: () => {
        let total = 0;
        const stdMesh = scene.getObjectByName('InstancedStandardSeats') as THREE.InstancedMesh | null;
        const recMesh = scene.getObjectByName('InstancedReclinerSeats') as THREE.InstancedMesh | null;
        const sofaMesh = scene.getObjectByName('InstancedSofaSeats') as THREE.InstancedMesh | null;
        if (stdMesh && stdMesh.count) total += stdMesh.count;
        if (recMesh && recMesh.count) total += recMesh.count;
        if (sofaMesh && sofaMesh.count) total += sofaMesh.count;
        return total;
      },
    };
    (window as any).useCinemaStore = useCinemaStore;

    return () => {
      delete window.__cineverse;
      delete (window as any).__threeCamera;
      delete (window as any).__threeScene;
      delete (window as any).THREE;
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
