'use client';

import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCinemaStore } from '@/store/useCinemaStore';

export function CinemaScreen() {
  const meshRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.SpotLight>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoTextureRef = useRef<THREE.VideoTexture | null>(null);
  const fallbackCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fallbackTextureRef = useRef<THREE.CanvasTexture | null>(null);

  const houseLights = useCinemaStore((s) => s.houseLights);
  const qualityTier = useCinemaStore((s) => s.qualityTier);
  const qualityMode = useCinemaStore((s) => s.qualityMode);
  const trailer = useCinemaStore((s) => s.trailer);
  const toggleTrailerPlay = useCinemaStore((s) => s.toggleTrailerPlay);
  const toggleTrailerMute = useCinemaStore((s) => s.toggleTrailerMute);

  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [spillColor, setSpillColor] = useState<THREE.Color>(new THREE.Color('#38bdf8'));

  // Ultra-fast 1x1 downsampling canvas for instantaneous light spill color without pixel looping
  const sampleCanvas = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    return c;
  }, []);

  // Setup video element
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.playsInline = true;
    video.muted = trailer.isMuted;
    video.defaultMuted = true;
    video.loop = true;
    video.preload = 'auto';
    video.autoplay = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('muted', '');
    video.id = 'cineverse-trailer-video';

    // Must be laid out in DOM (not display: none) so Chromium keeps decoding pipeline active
    video.style.position = 'fixed';
    video.style.top = '-9999px';
    video.style.left = '-9999px';
    video.style.width = '320px';
    video.style.height = '180px';
    video.style.opacity = '0.001';
    video.style.pointerEvents = 'none';

    document.body.appendChild(video);
    (window as any).__cineverse_video = video;

    const activeUrl = trailer.trailerUrl;
    if (!activeUrl) {
      setVideoLoaded(false);
      setVideoError(false);
      return;
    }
    video.src = activeUrl;
    video.load();

    videoRef.current = video;

    const vTex = new THREE.VideoTexture(video);
    vTex.colorSpace = THREE.SRGBColorSpace;
    vTex.generateMipmaps = false;
    vTex.minFilter = THREE.LinearFilter;
    vTex.magFilter = THREE.LinearFilter;
    videoTextureRef.current = vTex;

    const handleReady = () => {
      setVideoLoaded(true);
      setVideoError(false);
      if (trailer.isPlaying && video.paused) {
        video.play().catch(() => {});
      }
    };
    const onPlay = () => setVideoLoaded(true);
    const onError = () => {
      console.warn('[Screen] Video texture loading failed or CORS restricted. Falling back to procedural film canvas.');
      setVideoError(true);
    };

    video.addEventListener('canplay', handleReady);
    video.addEventListener('canplaythrough', handleReady);
    video.addEventListener('loadeddata', handleReady);
    video.addEventListener('playing', onPlay);
    video.addEventListener('error', onError);

    // Attempt muted autoplay
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => setVideoLoaded(true))
        .catch(() => {
          // Autoplay policy prevented immediate playback until interaction
        });
    }

    return () => {
      video.removeEventListener('canplay', handleReady);
      video.removeEventListener('canplaythrough', handleReady);
      video.removeEventListener('loadeddata', handleReady);
      video.removeEventListener('playing', onPlay);
      video.removeEventListener('error', onError);
      video.pause();
      if (video.parentNode) {
        video.parentNode.removeChild(video);
      }
      if ((window as any).__cineverse_video === video) {
        (window as any).__cineverse_video = null;
      }
      vTex.dispose();
    };
  }, [trailer.trailerUrl]);

  // Sync play/pause and mute
  useEffect(() => {
    if (!videoRef.current) return;
    if (trailer.isPlaying && videoRef.current.paused) {
      videoRef.current.play().catch(() => { });
    } else if (!trailer.isPlaying && !videoRef.current.paused) {
      videoRef.current.pause();
    }
  }, [trailer.isPlaying]);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = trailer.isMuted;
    videoRef.current.volume = trailer.volume;
  }, [trailer.isMuted, trailer.volume]);

  // Global keyboard shortcuts for trailer: 'K' = play/pause, 'M' = mute/unmute
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        toggleTrailerPlay();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleTrailerMute();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleTrailerPlay, toggleTrailerMute]);

  // Pause on hidden tab / departure
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!videoRef.current) return;
      if (document.visibilityState === 'hidden') {
        videoRef.current.pause();
      } else if (document.visibilityState === 'visible' && trailer.isPlaying) {
        videoRef.current.play().catch(() => { });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [trailer.isPlaying]);

  // Fallback procedural canvas
  const canvas = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 476; // Aspect 2.15
    fallbackCanvasRef.current = c;
    return c;
  }, []);

  const fallbackTexture = useMemo(() => {
    if (!canvas) return null;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    fallbackTextureRef.current = tex;
    return tex;
  }, [canvas]);

  // Perfectly oriented screen geometry facing audience (-Z) with correct left-to-right UV mapping
  const screenGeometry = useMemo(() => {
    const geom = new THREE.PlaneGeometry(15.6, 7.25);
    geom.rotateY(Math.PI);
    const uvs = geom.attributes.uv;
    for (let i = 0; i < uvs.count; i++) {
      uvs.setX(i, 1 - uvs.getX(i));
    }
    geom.computeVertexNormals();
    return geom;
  }, []);

  // Frame update: update video texture, fallback canvas and sample video for light spill
  const lastSampleTime = useRef(0);
  const lastVideoTime = useRef(-1);

  useFrame(({ clock, invalidate }) => {
    // If video is active and playing, update texture when frame advances and trigger next render
    const isPlaying = trailer.isPlaying;
    const vid = videoRef.current;
    if (vid && isPlaying && (vid.currentTime > 0 || vid.readyState >= 2)) {
      const curTime = vid.currentTime;
      if (curTime !== lastVideoTime.current) {
        lastVideoTime.current = curTime;
        if (videoTextureRef.current) {
          videoTextureRef.current.needsUpdate = true;
        }
      }
      invalidate();
    }
    const now = clock.getElapsedTime();

    // 1. Light spill sampling: disabled in Smooth mode; 1x1 GPU downsample every 500ms in Beautiful mode
    if (qualityMode === 'beautiful' && isPlaying && now - lastSampleTime.current > 0.5) {
      lastSampleTime.current = now;
      if (vid && videoLoaded && sampleCanvas) {
        const sCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
        if (sCtx && vid.videoWidth > 0) {
          try {
            sCtx.drawImage(vid, 0, 0, 1, 1);
            const p = sCtx.getImageData(0, 0, 1, 1).data;
            setSpillColor(new THREE.Color(p[0] / 255, p[1] / 255, p[2] / 255));
          } catch {
            // CORS restricted cross-origin canvas read
          }
        }
      }
    }

    // 2. Fallback procedural animation if video not playing
    if (!videoLoaded || videoError) {
      if (!canvas || !fallbackTextureRef.current) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const t = clock.getElapsedTime();
      const w = canvas.width;
      const h = canvas.height;

      const grad = ctx.createLinearGradient(0, 0, w, h);
      const pulse1 = Math.sin(t * 0.8) * 0.2 + 0.8;
      const pulse2 = Math.cos(t * 0.6) * 0.2 + 0.8;

      grad.addColorStop(0, `rgba(${Math.floor(10 * pulse1)}, ${Math.floor(22 * pulse2)}, ${Math.floor(55 * pulse1)}, 1)`);
      grad.addColorStop(0.4, `rgba(${Math.floor(110 * pulse1)}, ${Math.floor(25 * pulse2)}, ${Math.floor(40 * pulse1)}, 1)`);
      grad.addColorStop(0.7, `rgba(${Math.floor(180 * pulse2)}, ${Math.floor(65 * pulse1)}, ${Math.floor(20 * pulse2)}, 1)`);
      grad.addColorStop(1, `rgba(${Math.floor(20 * pulse1)}, ${Math.floor(10 * pulse2)}, ${Math.floor(35 * pulse1)}, 1)`);

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Film flare streak
      const flareY = h * 0.48 + Math.sin(t * 1.2) * 20;
      const flareGrad = ctx.createLinearGradient(0, flareY - 15, 0, flareY + 15);
      flareGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
      flareGrad.addColorStop(0.5, 'rgba(224, 242, 254, 0.4)');
      flareGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = flareGrad;
      ctx.fillRect(0, flareY - 15, w, 30);

      // Title & Branding
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 44px "Cinzel", "Times New Roman", serif';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(255, 200, 100, 0.8)';
      ctx.shadowBlur = 18;
      const displayTitle = (trailer.movieTitle || 'QUANTUM ODYSSEY').toUpperCase();
      ctx.fillText(displayTitle, w / 2, h * 0.42);

      if (!trailer.trailerUrl) {
        ctx.font = 'bold 26px sans-serif';
        ctx.fillStyle = '#f87171'; // Coral red
        ctx.shadowColor = 'rgba(248, 113, 113, 0.9)';
        ctx.shadowBlur = 12;
        ctx.fillText('Trailer not available', w / 2, h * 0.54);

        ctx.font = '600 18px sans-serif';
        ctx.fillStyle = '#cbd5e1';
        ctx.shadowBlur = 4;
        ctx.fillText('C I N E V E R S E   I M A X   3 D', w / 2, h * 0.65);
      } else {
        ctx.font = '600 18px sans-serif';
        ctx.fillStyle = '#cbd5e1';
        ctx.shadowBlur = 6;
        ctx.fillText('C I N E V E R S E   I M A X   3 D', w / 2, h * 0.56);

        ctx.font = 'italic 14px sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.shadowBlur = 0;
        ctx.fillText('Press [K] to Play Trailer • [M] to Unmute', w / 2, h * 0.65);
      }
      ctx.restore();

      fallbackTextureRef.current.needsUpdate = true;
    }
  });

  const activeTexture = videoLoaded && !videoError ? videoTextureRef.current : fallbackTexture;

  // Ensure material updates its shader pipeline when switching from fallback to video texture
  useEffect(() => {
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshBasicMaterial;
      if (mat) {
        mat.map = activeTexture;
        mat.needsUpdate = true;
      }
    }
  }, [activeTexture]);

  // Screen brightness controlled by house lights mode
  const screenBrightness = houseLights === 'show' ? 1.0 : houseLights === 'dim' ? 0.92 : 0.82;

  return (
    <group name="ScreenContainer">
      {/* 
        Cinema Screen Surface:
        Screen centre: (0, 5.55, -1.255)
        Dimensions: 15.6 wide x 7.25 high (aspect 2.15)
        Positioned 0.005u in front of geometry at z = -1.250 to prevent z-fighting
      */}
      <mesh
        ref={meshRef}
        name="DynamicScreenOverlay"
        geometry={screenGeometry}
        position={[0, 5.55, -1.255]}
      >
        <meshBasicMaterial
          map={activeTexture}
          toneMapped={false}
          side={THREE.DoubleSide}
          polygonOffset={true}
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
          color={new THREE.Color(screenBrightness, screenBrightness, screenBrightness)}
        />
      </mesh>

      {/* Screen dynamic light spill into the auditorium */}
      {qualityTier !== 'low' && (
        <spotLight
          ref={lightRef}
          name="ScreenLightSpill"
          position={[0, 6.0, -1.3]}
          target-position={[0, 2.0, -14.0]}
          color={spillColor}
          intensity={houseLights === 'show' ? 24.0 : houseLights === 'dim' ? 14.0 : 6.0}
          distance={28}
          angle={Math.PI / 3.2}
          penumbra={0.7}
        />
      )}

      {/* Projector beam cone effect (subtle additive volumetric look on medium/high) */}
      {qualityTier === 'high' && (
        <mesh position={[0, 9.8, -24.8]} rotation={[0.22, 0, 0]}>
          <coneGeometry args={[4.2, 23.5, 32, 1, true]} />
          <meshBasicMaterial
            color={spillColor}
            transparent
            opacity={houseLights === 'show' ? 0.045 : 0.015}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}
