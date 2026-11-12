'use client';

import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useCinemaStore } from '@/store/useCinemaStore';

function getYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return m ? m[1] : null;
}

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
  const screenConfig = useCinemaStore((s) => s.auditoriumLayout.screen);

  const screenWidth = screenConfig?.width ?? 15.6;
  const screenHeight = screenConfig?.height ?? 7.25;
  const screenCenter = screenConfig?.center_gltf_y_up ?? [0, 5.55, -1.255];

  const screenTypeId = screenConfig?.screen_type_id || (screenConfig as any)?.screen_type;
  const isPanoramicWrap = screenTypeId === 'panoramic_wrap' || !!screenConfig?.panoramic_wrap;
  const wrapConfig = (screenConfig?.panoramic_wrap as any) || {
    sideAngleDeg: 25,
    sideWidthRatio: 0.42,
    sideHeightRatio: 0.82,
    clear_frame: true,
  };
  const isCurved = Boolean(screenConfig?.is_curved || screenTypeId === 'large_curved');
  const hasProjectorBeam = screenConfig?.has_projector_beam !== false && screenTypeId !== 'premium_direct_view';
  const isDirectView = screenTypeId === 'premium_direct_view';

  const sideWidthRatio = wrapConfig.sideWidthRatio ?? wrapConfig.side_width_ratio ?? 0.42;
  const sideHeightRatio = wrapConfig.sideHeightRatio ?? wrapConfig.side_height_ratio ?? 0.82;
  const sideAngleDeg = wrapConfig.sideAngleDeg ?? wrapConfig.side_angle_deg ?? 25;

  const sideWidth = screenWidth * sideWidthRatio;
  const sideHeight = screenHeight * sideHeightRatio;
  const sideAngleRad = (sideAngleDeg * Math.PI) / 180;

  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [spillColor, setSpillColor] = useState<THREE.Color>(new THREE.Color('#38bdf8'));

  // Official Player on Screen feature flag (Source Chain Requirement)
  const [officialPlayerOnScreen, setOfficialPlayerOnScreen] = useState(true);
  const youtubeId = useMemo(() => getYouTubeId(trailer.trailerUrl), [trailer.trailerUrl]);
  const isYouTube = Boolean(youtubeId);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('cineverse_official_player_on_screen');
      const params = new URLSearchParams(window.location.search);
      if (params.has('official_player')) {
        setOfficialPlayerOnScreen(params.get('official_player') === '1');
      } else if (stored !== null) {
        setOfficialPlayerOnScreen(stored === 'true');
      }
    }
  }, []);

  // Backdrop image loader for slow-motion animation fallback
  const backdropImgRef = useRef<HTMLImageElement | null>(null);
  const [backdropLoaded, setBackdropLoaded] = useState(false);

  useEffect(() => {
    const bannerUrl = (trailer as any).bannerUrl || trailer.posterUrl;
    if (!bannerUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = bannerUrl;
    img.onload = () => {
      backdropImgRef.current = img;
      setBackdropLoaded(true);
      // Sample center color for ambient light spill
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        try {
          ctx.drawImage(img, 0, 0, 1, 1);
          const p = ctx.getImageData(0, 0, 1, 1).data;
          setSpillColor(new THREE.Color(p[0] / 255, p[1] / 255, p[2] / 255));
        } catch {
          // ignore CORS
        }
      }
    };
  }, [trailer]);

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
    if (isCurved) {
      const radius = screenWidth * 1.8;
      const angle = screenWidth / radius;
      const geom = new THREE.CylinderGeometry(radius, radius, screenHeight, 48, 1, true, -angle / 2, angle);
      geom.rotateY(Math.PI);
      const uvs = geom.attributes.uv;
      for (let i = 0; i < uvs.count; i++) {
        uvs.setX(i, 1 - uvs.getX(i));
      }
      geom.computeVertexNormals();
      return geom;
    }
    const geom = new THREE.PlaneGeometry(screenWidth, screenHeight);
    geom.rotateY(Math.PI);
    const uvs = geom.attributes.uv;
    for (let i = 0; i < uvs.count; i++) {
      uvs.setX(i, 1 - uvs.getX(i));
    }
    geom.computeVertexNormals();
    return geom;
  }, [screenWidth, screenHeight, isCurved]);

  const leftWingGeom = useMemo(() => {
    if (!isPanoramicWrap) return null;
    const geom = new THREE.PlaneGeometry(sideWidth, sideHeight);
    geom.rotateY(Math.PI);
    const uvs = geom.attributes.uv;
    for (let i = 0; i < uvs.count; i++) {
      uvs.setX(i, 1 - uvs.getX(i));
    }
    geom.computeVertexNormals();
    return geom;
  }, [isPanoramicWrap, sideWidth, sideHeight]);

  const rightWingGeom = useMemo(() => {
    if (!isPanoramicWrap) return null;
    const geom = new THREE.PlaneGeometry(sideWidth, sideHeight);
    geom.rotateY(Math.PI);
    const uvs = geom.attributes.uv;
    for (let i = 0; i < uvs.count; i++) {
      uvs.setX(i, 1 - uvs.getX(i));
    }
    geom.computeVertexNormals();
    return geom;
  }, [isPanoramicWrap, sideWidth, sideHeight]);

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

    // 2. Fallback procedural or animated backdrop slow-motion (Ken Burns)
    if (!videoLoaded || videoError) {
      if (!canvas || !fallbackTextureRef.current) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const t = clock.getElapsedTime();
      const w = canvas.width;
      const h = canvas.height;

      if (backdropImgRef.current && backdropLoaded) {
        // Slow-motion Ken Burns pan & zoom on authentic movie backdrop
        const scale = 1.05 + Math.sin(t * 0.12) * 0.04;
        const panX = Math.sin(t * 0.08) * (w * 0.025);
        const panY = Math.cos(t * 0.10) * (h * 0.015);

        ctx.drawImage(
          backdropImgRef.current,
          -w * 0.025 + panX,
          -h * 0.025 + panY,
          w * 1.05 * scale,
          h * 1.05 * scale
        );

        // Subtle cinematic vignette
        const vigGrad = ctx.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, w * 0.72);
        vigGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vigGrad.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
        ctx.fillStyle = vigGrad;
        ctx.fillRect(0, 0, w, h);
      } else {
        const grad = ctx.createLinearGradient(0, 0, w, h);
        const pulse1 = Math.sin(t * 0.8) * 0.2 + 0.8;
        const pulse2 = Math.cos(t * 0.6) * 0.2 + 0.8;

        grad.addColorStop(0, `rgba(${Math.floor(10 * pulse1)}, ${Math.floor(22 * pulse2)}, ${Math.floor(55 * pulse1)}, 1)`);
        grad.addColorStop(0.4, `rgba(${Math.floor(110 * pulse1)}, ${Math.floor(25 * pulse2)}, ${Math.floor(40 * pulse1)}, 1)`);
        grad.addColorStop(0.7, `rgba(${Math.floor(180 * pulse2)}, ${Math.floor(65 * pulse1)}, ${Math.floor(20 * pulse2)}, 1)`);
        grad.addColorStop(1, `rgba(${Math.floor(20 * pulse1)}, ${Math.floor(10 * pulse2)}, ${Math.floor(35 * pulse1)}, 1)`);

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }

      // Film flare streak
      const flareY = h * 0.48 + Math.sin(t * 1.2) * 20;
      const flareGrad = ctx.createLinearGradient(0, flareY - 15, 0, flareY + 15);
      flareGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
      flareGrad.addColorStop(0.5, 'rgba(224, 242, 254, 0.4)');
      flareGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = flareGrad;
      ctx.fillRect(0, flareY - 15, w, 30);

      // Title & Branding overlay
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
        position={screenCenter}
      >
        <meshBasicMaterial
          map={activeTexture}
          toneMapped={false}
          side={THREE.DoubleSide}
          polygonOffset={true}
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
          transparent={isYouTube && Boolean(youtubeId) && officialPlayerOnScreen}
          opacity={isYouTube && Boolean(youtubeId) && officialPlayerOnScreen ? 0 : 1}
          color={new THREE.Color(screenBrightness, screenBrightness, screenBrightness)}
        />
      </mesh>

      {/* Official YouTube Player placed directly on 3D Screen via CSS 3D with canvas cut-out */}
      {isYouTube && youtubeId && officialPlayerOnScreen && (
        <Html
          transform
          position={[screenCenter[0], screenCenter[1], screenCenter[2] + 0.02]}
          rotation={[0, Math.PI, 0]}
          scale={[-1, 1, 1]}
          style={{
            width: `${Math.round(screenWidth * 75)}px`,
            height: `${Math.round(screenHeight * 75)}px`,
            transform: `scale(${1 / 75})`,
            pointerEvents: 'auto',
          }}
          data-testid="screen-youtube-player"
        >
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${youtubeId}&enablejsapi=1`}
            className="w-full h-full border-0 bg-black rounded-sm"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </Html>
      )}

      {/* Center Screen Proscenium / Bezel Frame */}
      <mesh
        name="ScreenProsceniumFrame"
        position={[screenCenter[0], screenCenter[1], screenCenter[2] - 0.015]}
      >
        <boxGeometry args={[screenWidth + (isDirectView ? 0.08 : 0.22), screenHeight + (isDirectView ? 0.08 : 0.22), 0.03]} />
        <meshStandardMaterial
          color={isDirectView ? '#09090b' : '#0f172a'}
          roughness={isDirectView ? 0.2 : 0.5}
          metalness={isDirectView ? 0.8 : 0.6}
        />
      </mesh>

      {/* Panoramic Wrap Side Panels & Clear Frames */}
      {isPanoramicWrap && leftWingGeom && rightWingGeom && (
        <group name="PanoramicWrapWings">
          {/* Left Wing Screen */}
          <mesh
            name="WrapScreenLeftWing"
            geometry={leftWingGeom}
            position={[
              screenWidth / 2 + (sideWidth / 2) * Math.cos(sideAngleRad),
              screenCenter[1] - (screenHeight - sideHeight) * 0.15,
              screenCenter[2] + (sideWidth / 2) * Math.sin(sideAngleRad),
            ]}
            rotation={[0, Math.PI - sideAngleRad, 0]}
          >
            <meshBasicMaterial
              map={activeTexture}
              toneMapped={false}
              side={THREE.DoubleSide}
              color={new THREE.Color(screenBrightness * 0.88, screenBrightness * 0.88, screenBrightness * 0.88)}
            />
          </mesh>
          {/* Left Wing Clear Frame */}
          <mesh
            name="WrapScreenLeftFrame"
            position={[
              screenWidth / 2 + (sideWidth / 2) * Math.cos(sideAngleRad),
              screenCenter[1] - (screenHeight - sideHeight) * 0.15,
              screenCenter[2] + (sideWidth / 2) * Math.sin(sideAngleRad) - 0.01,
            ]}
            rotation={[0, Math.PI - sideAngleRad, 0]}
          >
            <boxGeometry args={[sideWidth + 0.18, sideHeight + 0.18, 0.04]} />
            <meshStandardMaterial color="#0f172a" roughness={0.4} metalness={0.7} />
          </mesh>

          {/* Right Wing Screen */}
          <mesh
            name="WrapScreenRightWing"
            geometry={rightWingGeom}
            position={[
              -screenWidth / 2 - (sideWidth / 2) * Math.cos(sideAngleRad),
              screenCenter[1] - (screenHeight - sideHeight) * 0.15,
              screenCenter[2] + (sideWidth / 2) * Math.sin(sideAngleRad),
            ]}
            rotation={[0, Math.PI + sideAngleRad, 0]}
          >
            <meshBasicMaterial
              map={activeTexture}
              toneMapped={false}
              side={THREE.DoubleSide}
              color={new THREE.Color(screenBrightness * 0.88, screenBrightness * 0.88, screenBrightness * 0.88)}
            />
          </mesh>
          {/* Right Wing Clear Frame */}
          <mesh
            name="WrapScreenRightFrame"
            position={[
              -screenWidth / 2 - (sideWidth / 2) * Math.cos(sideAngleRad),
              screenCenter[1] - (screenHeight - sideHeight) * 0.15,
              screenCenter[2] + (sideWidth / 2) * Math.sin(sideAngleRad) - 0.01,
            ]}
            rotation={[0, Math.PI + sideAngleRad, 0]}
          >
            <boxGeometry args={[sideWidth + 0.18, sideHeight + 0.18, 0.04]} />
            <meshStandardMaterial color="#0f172a" roughness={0.4} metalness={0.7} />
          </mesh>
        </group>
      )}

      {/* Screen dynamic light spill into the auditorium */}
      {qualityTier !== 'low' && (
        <spotLight
          ref={lightRef}
          name="ScreenLightSpill"
          position={[0, screenCenter[1] + 0.45, screenCenter[2] - 0.05]}
          target-position={[0, 2.0, -14.0]}
          color={spillColor}
          intensity={houseLights === 'show' ? 24.0 : houseLights === 'dim' ? 14.0 : 6.0}
          distance={28}
          angle={Math.PI / 3.2}
          penumbra={0.7}
        />
      )}

      {/* Projector beam cone effect (subtle additive volumetric look on medium/high) */}
      {qualityTier === 'high' && hasProjectorBeam && (
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
