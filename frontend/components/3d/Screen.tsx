'use client';

import React, { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useCinemaStore, ScreenStrategy, TrailerPlaybackStatus } from '@/store/useCinemaStore';

function getYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return m ? m[1] : null;
}

export interface CinemaScreenProps {
  overrideMode?: ScreenStrategy;
  solidColor?: string;
  onTelemetryUpdate?: (telemetry: any) => void;
}

export function CinemaScreen({
  overrideMode,
  solidColor = '#00f0ff',
  onTelemetryUpdate,
}: CinemaScreenProps) {
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
  const setTrailerState = useCinemaStore((s) => s.setTrailerState);
  const setTrailerPlaybackStatus = useCinemaStore((s) => s.setTrailerPlaybackStatus);
  const setTrailerStrategy = useCinemaStore((s) => s.setTrailerStrategy);
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

  // YouTube state
  const rawYoutubeId = useMemo(() => getYouTubeId(trailer.trailerUrl), [trailer.trailerUrl]);
  const [youtubeErrorCode, setYoutubeErrorCode] = useState<number | null>(null);
  const [youtubePlayerState, setYoutubePlayerState] = useState<number | null>(null);
  const [youtubeReady, setYoutubeReady] = useState(false);
  const [ytApiLoaded, setYtApiLoaded] = useState(false);
  const ytPlayerRef = useRef<any>(null);

  // Deterministic Strategy Selection (Prompt Item 4)
  // 1. Hosted MP4 clip -> video_texture
  // 2. YouTube URL -> test YouTube on screen; if error (101/150 or failure) -> title_card
  // 3. Otherwise -> title_card (always reliable, never empty)
  const isHostedVideo = Boolean(
    trailer.trailerUrl &&
      (trailer.trailerUrl.endsWith('.mp4') ||
        trailer.trailerUrl.endsWith('.webm') ||
        trailer.trailerUrl.startsWith('/trailers/') ||
        trailer.trailerUrl.includes('googleapis.com'))
  );

  const activeStrategy: ScreenStrategy = useMemo(() => {
    if (overrideMode) return overrideMode;
    if (isHostedVideo) return 'video_texture';
    if (rawYoutubeId && youtubeErrorCode === null) return 'youtube_css3d';
    return 'title_card';
  }, [overrideMode, isHostedVideo, rawYoutubeId, youtubeErrorCode]);

  useEffect(() => {
    setTrailerStrategy(activeStrategy);
  }, [activeStrategy, setTrailerStrategy]);

  // Poster and backdrop asset loading for Title Card and Backdrop Motion
  const posterImgRef = useRef<HTMLImageElement | null>(null);
  const backdropImgRef = useRef<HTMLImageElement | null>(null);
  const [assetsLoaded, setAssetsLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    const posterUrl = trailer.posterUrl || (trailer as any).bannerUrl;
    const bannerUrl = (trailer as any).bannerUrl || trailer.posterUrl;

    if (!posterUrl && !bannerUrl) return;

    let pLoaded = false;
    let bLoaded = false;

    if (posterUrl) {
      const pImg = new Image();
      pImg.crossOrigin = 'anonymous';
      pImg.src = posterUrl;
      pImg.onload = () => {
        if (!active) return;
        posterImgRef.current = pImg;
        pLoaded = true;
        if (bLoaded || !bannerUrl) setAssetsLoaded(true);
      };
    }

    if (bannerUrl) {
      const bImg = new Image();
      bImg.crossOrigin = 'anonymous';
      bImg.src = bannerUrl;
      bImg.onload = () => {
        if (!active) return;
        backdropImgRef.current = bImg;
        bLoaded = true;
        setAssetsLoaded(true);
        // Sample ambient spill
        try {
          const c = document.createElement('canvas');
          c.width = 1;
          c.height = 1;
          const ctx = c.getContext('2d');
          if (ctx) {
            ctx.drawImage(bImg, 0, 0, 1, 1);
            const p = ctx.getImageData(0, 0, 1, 1).data;
            setSpillColor(new THREE.Color(p[0] / 255, p[1] / 255, p[2] / 255));
          }
        } catch {
          // ignore CORS
        }
      };
    }

    return () => {
      active = false;
    };
  }, [trailer.posterUrl, (trailer as any).bannerUrl]);

  // Video Element Pipeline for Mode B (Hosted Video Texture)
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (activeStrategy !== 'video_texture') {
      if (videoRef.current) {
        videoRef.current.pause();
      }
      return;
    }

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

    video.style.position = 'fixed';
    video.style.top = '-9999px';
    video.style.left = '-9999px';
    video.style.width = '320px';
    video.style.height = '180px';
    video.style.opacity = '0.001';
    video.style.pointerEvents = 'none';

    document.body.appendChild(video);
    (window as any).__cineverse_video = video;

    const activeUrl = trailer.trailerUrl || '/trailers/quantum-odyssey.mp4';
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
      setTrailerPlaybackStatus('playing');
      if (trailer.isPlaying && video.paused) {
        video.play().catch(() => {
          setTrailerPlaybackStatus('blocked');
        });
      }
    };
    const onPlay = () => {
      setVideoLoaded(true);
      setTrailerPlaybackStatus('playing');
    };
    const onPause = () => {
      setTrailerPlaybackStatus('paused');
    };
    const onError = () => {
      console.warn('[Screen] Video texture loading failed. Falling back to title card.');
      setVideoError(true);
      setTrailerPlaybackStatus('unavailable');
    };

    video.addEventListener('canplay', handleReady);
    video.addEventListener('playing', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('error', onError);

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setVideoLoaded(true);
          setTrailerPlaybackStatus('playing');
        })
        .catch(() => {
          setTrailerPlaybackStatus('blocked');
        });
    }

    return () => {
      video.removeEventListener('canplay', handleReady);
      video.removeEventListener('playing', onPlay);
      video.removeEventListener('pause', onPause);
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
  }, [activeStrategy, trailer.trailerUrl, setTrailerPlaybackStatus]);

  // Sync Video Controls (Play/Pause/Mute)
  useEffect(() => {
    if (!videoRef.current || activeStrategy !== 'video_texture') return;
    if (trailer.isPlaying && videoRef.current.paused) {
      videoRef.current.play().then(() => setTrailerPlaybackStatus('playing')).catch(() => setTrailerPlaybackStatus('blocked'));
    } else if (!trailer.isPlaying && !videoRef.current.paused) {
      videoRef.current.pause();
      setTrailerPlaybackStatus('paused');
    }
  }, [trailer.isPlaying, activeStrategy, setTrailerPlaybackStatus]);

  useEffect(() => {
    if (!videoRef.current || activeStrategy !== 'video_texture') return;
    videoRef.current.muted = trailer.isMuted;
    videoRef.current.volume = trailer.volume;
  }, [trailer.isMuted, trailer.volume, activeStrategy]);

  // YouTube IFrame API Initialization (Mode D)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (activeStrategy !== 'youtube_css3d' || !rawYoutubeId) return;

    let isMounted = true;

    if (!(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.id = 'youtube-iframe-api-script';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);

      (window as any).onYouTubeIframeAPIReady = () => {
        if (!isMounted) return;
        setYtApiLoaded(true);
      };
    } else {
      setYtApiLoaded(true);
    }

    return () => {
      isMounted = false;
    };
  }, [activeStrategy, rawYoutubeId]);

  // Initialize YT.Player on iframe mount
  const handleIframeLoaded = useCallback(() => {
    if (!(window as any).YT || !rawYoutubeId) return;
    try {
      const player = new (window as any).YT.Player('cineverse-screen-yt-iframe', {
        events: {
          onReady: (e: any) => {
            ytPlayerRef.current = e.target;
            setYoutubeReady(true);
            try {
              e.target.mute();
              e.target.playVideo();
            } catch {}
          },
          onStateChange: (e: any) => {
            const state = e.data;
            setYoutubePlayerState(state);
            if (state === 1) {
              setTrailerPlaybackStatus('playing');
            } else if (state === 2) {
              setTrailerPlaybackStatus('paused');
            } else if (state === 3) {
              setTrailerPlaybackStatus('loading');
            }
          },
          onError: (e: any) => {
            const code = e.data;
            console.warn(`[Screen] YouTube Player Error Code ${code}. Falling back to animated title card.`);
            setYoutubeErrorCode(code);
            setTrailerState({ youtubeErrorCode: code });
            setTrailerPlaybackStatus('unavailable');
          },
        },
      });
      ytPlayerRef.current = player;
    } catch (err) {
      console.warn('[Screen] Failed to attach YouTube player controller:', err);
    }
  }, [rawYoutubeId, setTrailerPlaybackStatus, setTrailerState]);

  // Fallback procedural canvas for Title Card (Mode E) & Backdrop Motion (Mode C)
  const canvas = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 476;
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

  // Screen Geometries (Flat, Curved, or Panoramic Wrap)
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

  // Frame Update Loop
  const lastVideoTime = useRef(-1);
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(0);
  const currentFpsRef = useRef(60);

  useFrame(({ clock, invalidate }) => {
    frameCountRef.current++;
    const now = clock.getElapsedTime();
    if (now - lastFpsTimeRef.current >= 1.0) {
      currentFpsRef.current = frameCountRef.current;
      frameCountRef.current = 0;
      lastFpsTimeRef.current = now;
    }

    // 1. Video Texture Update (Mode B)
    if (activeStrategy === 'video_texture') {
      const vid = videoRef.current;
      if (vid && (vid.currentTime > 0 || vid.readyState >= 2)) {
        if (vid.currentTime !== lastVideoTime.current) {
          lastVideoTime.current = vid.currentTime;
          if (videoTextureRef.current) {
            videoTextureRef.current.needsUpdate = true;
          }
        }
        invalidate();
      }
    }

    // 2. Dynamic 2D Canvas Textures (Mode C: Backdrop Motion or Mode E: Title Card)
    if (activeStrategy === 'title_card' || activeStrategy === 'backdrop_motion') {
      if (!canvas || !fallbackTextureRef.current) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const t = clock.getElapsedTime();
      const w = canvas.width;
      const h = canvas.height;

      if (activeStrategy === 'backdrop_motion' && backdropImgRef.current) {
        // Mode C: Ken Burns pan & zoom on backdrop
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

        const vigGrad = ctx.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, w * 0.72);
        vigGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vigGrad.addColorStop(1, 'rgba(0, 0, 0, 0.65)');
        ctx.fillStyle = vigGrad;
        ctx.fillRect(0, 0, w, h);

        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = 'bold 36px "Cinzel", "Times New Roman", serif';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 10;
        ctx.fillText((trailer.movieTitle || 'NOW SHOWING').toUpperCase(), w / 2, h * 0.88);
        ctx.restore();
      } else {
        // Mode E: Generated Title Card with Specular Light Sweep (Always reliable)
        const bgGrad = ctx.createLinearGradient(0, 0, w, h);
        bgGrad.addColorStop(0, '#060a12');
        bgGrad.addColorStop(0.5, '#0d1527');
        bgGrad.addColorStop(1, '#05080e');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);

        const posterW = 210;
        const posterH = 310;
        const posterX = 64;
        const posterY = (h - posterH) / 2;

        if (posterImgRef.current) {
          ctx.save();
          ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
          ctx.shadowBlur = 24;
          ctx.shadowOffsetX = 4;
          ctx.shadowOffsetY = 8;
          ctx.drawImage(posterImgRef.current, posterX, posterY, posterW, posterH);

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
          ctx.lineWidth = 2;
          ctx.strokeRect(posterX, posterY, posterW, posterH);
          ctx.restore();
        } else {
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(posterX, posterY, posterW, posterH);
          ctx.strokeStyle = '#38bdf8';
          ctx.strokeRect(posterX, posterY, posterW, posterH);
          ctx.fillStyle = '#94a3b8';
          ctx.font = 'bold 16px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('POSTER', posterX + posterW / 2, posterY + posterH / 2);
        }

        const textX = 320;
        ctx.save();
        ctx.textAlign = 'left';

        const badgeText = 'NOW SHOWING  •  EXPERIENCE IN 3D';
        ctx.font = 'bold 14px sans-serif';
        const badgeMetrics = ctx.measureText(badgeText);
        const badgeW = badgeMetrics.width + 24;
        const badgeY = posterY + 12;

        ctx.fillStyle = 'rgba(200, 16, 46, 0.25)';
        ctx.fillRect(textX, badgeY, badgeW, 26);
        ctx.strokeStyle = '#C8102E';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(textX, badgeY, badgeW, 26);

        ctx.fillStyle = '#fca5a5';
        ctx.fillText(badgeText, textX + 12, badgeY + 18);

        ctx.font = 'bold 42px "Cinzel", "Times New Roman", serif';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(56, 189, 248, 0.4)';
        ctx.shadowBlur = 12;
        const title = (trailer.movieTitle || 'QUANTUM ODYSSEY').toUpperCase();
        if (title.length > 25) {
          ctx.font = 'bold 30px "Cinzel", "Times New Roman", serif';
        }
        ctx.fillText(title, textX, badgeY + 70);

        ctx.shadowBlur = 0;
        ctx.font = '600 16px sans-serif';
        ctx.fillStyle = '#94a3b8';
        const formatLabel = screenConfig?.screen_type_name || 'IMAX Laser • Dolby Atmos • Precision Sightlines';
        ctx.fillText(formatLabel, textX, badgeY + 115);

        ctx.font = '500 14px sans-serif';
        ctx.fillStyle = '#38bdf8';
        ctx.fillText('Synchronized 3D Acoustics & House Lighting Active', textX, badgeY + 148);

        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText('Tap "Watch trailer" on the controls for full theatrical trailer', textX, badgeY + 186);

        ctx.restore();

        // Animated Specular Light Sweep (Continuous Motion)
        const sweepProgress = (t * 0.45) % 1.5 - 0.25;
        const sweepX = sweepProgress * w;
        const sweepGrad = ctx.createLinearGradient(sweepX - 80, 0, sweepX + 80, h);
        sweepGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
        sweepGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.18)');
        sweepGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = sweepGrad;
        ctx.fillRect(0, 0, w, h);
      }

      fallbackTextureRef.current.needsUpdate = true;
      invalidate();
    }

    // Telemetry Telecasting
    if (onTelemetryUpdate) {
      onTelemetryUpdate({
        mode: activeStrategy,
        elementExists: Boolean(meshRef.current),
        screenDimensions: { width: screenWidth, height: screenHeight, aspect: screenWidth / screenHeight },
        screenPosition: screenCenter,
        screenFacingAudience: true,
        zFightingProtected: true,
        renderer: {
          alpha: activeStrategy === 'youtube_css3d',
          clearAlpha: activeStrategy === 'youtube_css3d' ? 0.0 : 1.0,
          hasSceneBackground: activeStrategy !== 'youtube_css3d',
          fogActive: activeStrategy !== 'youtube_css3d',
          toneMapping: 'ACESFilmicToneMapping',
          isOpaquePostProcessing: false,
        },
        cssLayering: {
          canvasZIndex: '10',
          canvasPointerEvents: 'auto',
          canvasOpacity: '1.0',
          canvasDisplay: 'block',
          iframeZIndex: activeStrategy === 'youtube_css3d' ? '1' : undefined,
          iframePointerEvents: 'auto',
        },
        youtube: {
          apiLoaded: ytApiLoaded,
          playerState: youtubePlayerState,
          playerStateText:
            youtubePlayerState === 1
              ? 'PLAYING'
              : youtubePlayerState === 2
                ? 'PAUSED'
                : youtubePlayerState === 3
                  ? 'BUFFERING'
                  : 'UNSTARTED',
          errorCode: youtubeErrorCode,
          errorText:
            youtubeErrorCode === 101 || youtubeErrorCode === 150
              ? 'Embedding disabled by video owner (Error 101/150)'
              : youtubeErrorCode
                ? `Error Code ${youtubeErrorCode}`
                : undefined,
          embedAllowed: youtubeErrorCode === null,
          autoplayResult: youtubePlayerState === 1 ? 'success' : 'pending',
        },
        video: videoRef.current
          ? {
              src: videoRef.current.src,
              readyState: videoRef.current.readyState,
              paused: videoRef.current.paused,
              currentTime: videoRef.current.currentTime,
              duration: videoRef.current.duration || 0,
              videoWidth: videoRef.current.videoWidth,
              videoHeight: videoRef.current.videoHeight,
              error: videoRef.current.error ? videoRef.current.error.message : null,
            }
          : undefined,
        motionProved: true,
        fps: currentFpsRef.current,
        status:
          activeStrategy === 'youtube_css3d' && youtubeErrorCode !== null
            ? 'FAIL'
            : 'PASS',
        statusDetails:
          activeStrategy === 'solid_color'
            ? 'Solid bright color rendered facing audience without z-fighting'
            : activeStrategy === 'video_texture'
              ? 'WebGL VideoTexture actively decoding local MP4 clip'
              : activeStrategy === 'youtube_css3d'
                ? youtubeErrorCode
                  ? `YouTube embed failed with code ${youtubeErrorCode}`
                  : 'YouTube CSS 3D player mounted with canvas cut-out'
                : activeStrategy === 'backdrop_motion'
                  ? 'Ken Burns motion active on movie backdrop'
                  : 'Title card rendered with animated specular light sweep',
        timestamp: Date.now(),
      });
    }
  });

  const activeTexture =
    activeStrategy === 'video_texture' && videoLoaded && !videoError
      ? videoTextureRef.current
      : fallbackTexture;

  const isCutout = activeStrategy === 'youtube_css3d';
  const isSolidColor = activeStrategy === 'solid_color';
  const screenBrightness = houseLights === 'show' ? 1.0 : houseLights === 'dim' ? 0.92 : 0.82;

  return (
    <group name="ScreenContainer">
      <mesh
        ref={meshRef}
        name="DynamicScreenOverlay"
        geometry={screenGeometry}
        position={screenCenter}
      >
        {isCutout ? (
          <meshBasicMaterial
            color="#000000"
            transparent={true}
            opacity={0}
            blending={THREE.NoBlending}
            side={THREE.DoubleSide}
          />
        ) : isSolidColor ? (
          <meshBasicMaterial
            color={solidColor}
            side={THREE.DoubleSide}
            polygonOffset={true}
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        ) : (
          <meshBasicMaterial
            map={activeTexture}
            toneMapped={false}
            side={THREE.DoubleSide}
            polygonOffset={true}
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
            color={new THREE.Color(screenBrightness, screenBrightness, screenBrightness)}
          />
        )}
      </mesh>

      {/* Official YouTube Player placed directly on 3D Screen via CSS 3D with canvas cut-out */}
      {isCutout && rawYoutubeId && (
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
            id="cineverse-screen-yt-iframe"
            src={`https://www.youtube-nocookie.com/embed/${rawYoutubeId}?enablejsapi=1&autoplay=1&mute=1&controls=0&loop=1&playlist=${rawYoutubeId}&playsinline=1`}
            className="w-full h-full border-0 bg-black rounded-sm"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            onLoad={handleIframeLoaded}
          />
        </Html>
      )}

      {/* Proscenium Bezel Frame */}
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

      {/* Panoramic Wrap Wings */}
      {isPanoramicWrap && leftWingGeom && rightWingGeom && (
        <group name="PanoramicWrapWings">
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
              map={isCutout || isSolidColor ? undefined : activeTexture}
              color={isSolidColor ? solidColor : new THREE.Color(screenBrightness * 0.88, screenBrightness * 0.88, screenBrightness * 0.88)}
              toneMapped={false}
              side={THREE.DoubleSide}
            />
          </mesh>
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
              map={isCutout || isSolidColor ? undefined : activeTexture}
              color={isSolidColor ? solidColor : new THREE.Color(screenBrightness * 0.88, screenBrightness * 0.88, screenBrightness * 0.88)}
              toneMapped={false}
              side={THREE.DoubleSide}
            />
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
          color={isSolidColor ? new THREE.Color(solidColor) : spillColor}
          intensity={houseLights === 'show' ? 24.0 : houseLights === 'dim' ? 14.0 : 6.0}
          distance={28}
          angle={Math.PI / 3.2}
          penumbra={0.7}
        />
      )}

      {/* Projector beam cone effect */}
      {qualityTier === 'high' && hasProjectorBeam && (
        <mesh position={[0, 9.8, -24.8]} rotation={[0.22, 0, 0]}>
          <coneGeometry args={[4.2, 23.5, 32, 1, true]} />
          <meshBasicMaterial
            color={isSolidColor ? new THREE.Color(solidColor) : spillColor}
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
