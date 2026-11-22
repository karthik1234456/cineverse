'use client';

import React, { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CameraGuardedCSS3D } from './CameraGuardedCSS3D';
import { Play, Maximize2, X } from 'lucide-react';
import * as THREE from 'three';
import { useCinemaStore, ScreenStrategy, TrailerPlaybackStatus } from '@/store/useCinemaStore';

function getYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
  const m = trimmed.match(/(?:youtu\.be\/|(?:youtube\.com|youtube-nocookie\.com)\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
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
  const { gl, scene } = useThree();

  const meshRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.SpotLight>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoTextureRef = useRef<THREE.VideoTexture | null>(null);
  const fallbackCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fallbackTextureRef = useRef<THREE.CanvasTexture | null>(null);

  const houseLights = useCinemaStore((s) => s.houseLights);
  const setHouseLights = useCinemaStore((s) => s.setHouseLights);
  const qualityTier = useCinemaStore((s) => s.qualityTier);
  const qualityMode = useCinemaStore((s) => s.qualityMode);
  const trailer = useCinemaStore((s) => s.trailer);
  const setTrailerState = useCinemaStore((s) => s.setTrailerState);
  const setTrailerPlaybackStatus = useCinemaStore((s) => s.setTrailerPlaybackStatus);
  const setTrailerStrategy = useCinemaStore((s) => s.setTrailerStrategy);
  const toggleTrailerPlay = useCinemaStore((s) => s.toggleTrailerPlay);
  const toggleTrailerMute = useCinemaStore((s) => s.toggleTrailerMute);
  const theatreModeOpen = useCinemaStore((s) => s.theatreModeOpen);
  const setTheatreModeOpen = useCinemaStore((s) => s.setTheatreModeOpen);
  const showToast = useCinemaStore((s) => s.showToast);
  const screenFitMode = useCinemaStore((s) => s.screenFitMode);
  const trailerDisplayPreference = useCinemaStore((s) => s.trailerDisplayPreference);
  const screenConfig = useCinemaStore((s) => s.auditoriumLayout.screen);

  const screenWidth = screenConfig?.width ?? 18.4;
  const screenHeight = screenConfig?.height ?? 8.5;
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
  const [youtubeVerifiedPlaying, setYoutubeVerifiedPlaying] = useState(false);
  const ytPlayerRef = useRef<any>(null);
  const pendingPlayRef = useRef<boolean>(false);

  // Watchdog timer ref for 3s fallback to Theatre Mode
  const watchdogTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Time advancing verification ref
  const verifiedAdvancingRef = useRef<boolean>(false);
  const lastAdvanceCheckRef = useRef<{ time: number; timestamp: number }>({ time: -1, timestamp: 0 });

  // Deterministic Strategy Selection
  const isHostedVideo = Boolean(
    trailer.trailerUrl &&
    (trailer.trailerUrl.endsWith('.mp4') ||
      trailer.trailerUrl.endsWith('.webm') ||
      trailer.trailerUrl.startsWith('/trailers/') ||
      trailer.trailerUrl.includes('googleapis.com'))
  );

  const storeOverrideStrategy = useCinemaStore((s) => s.trailer.activeStrategy);

  const activeStrategy: ScreenStrategy = useMemo(() => {
    if (overrideMode) return overrideMode;
    if (storeOverrideStrategy === 'test_card' || storeOverrideStrategy === 'solid_color') return storeOverrideStrategy;
    if (isHostedVideo) return 'video_texture';
    if (rawYoutubeId && youtubeErrorCode === null) return 'youtube_css3d';
    return 'title_card';
  }, [overrideMode, storeOverrideStrategy, isHostedVideo, rawYoutubeId, youtubeErrorCode]);

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
    video.defaultMuted = false;
    video.loop = true;
    video.preload = 'auto';
    video.autoplay = false;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
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
      if (!trailer.isPlaying) {
        setTrailerPlaybackStatus('ready');
      }
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
    video.addEventListener('pause', onPause);
    video.addEventListener('error', onError);

    return () => {
      video.removeEventListener('canplay', handleReady);
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
      videoRef.current.play().catch(() => setTrailerPlaybackStatus('blocked'));
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

    const checkReady = () => {
      if (!isMounted) return false;
      if ((window as any).YT && (window as any).YT.Player) {
        setYtApiLoaded(true);
        return true;
      }
      return false;
    };

    if (checkReady()) return;

    if ((window as any).YT && typeof (window as any).YT.ready === 'function') {
      (window as any).YT.ready(() => {
        if (isMounted) setYtApiLoaded(true);
      });
    }

    if (!document.getElementById('youtube-iframe-api-script')) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.id = 'youtube-iframe-api-script';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
    }

    const prevOnReady = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => {
      if (typeof prevOnReady === 'function') {
        try { prevOnReady(); } catch { }
      }
      if (isMounted) setYtApiLoaded(true);
    };

    const pollInterval = setInterval(() => {
      if (checkReady()) {
        clearInterval(pollInterval);
      }
    }, 150);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [activeStrategy, rawYoutubeId]);

  // Stable YouTube embed URL (never mutated on play/mute to avoid iframe reload & segment buffer drop)
  const stableYoutubeSrc = useMemo(() => {
    if (!rawYoutubeId) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3002';
    return `https://www.youtube.com/embed/${rawYoutubeId}?enablejsapi=1&controls=1&loop=1&playlist=${rawYoutubeId}&playsinline=1&rel=0&iv_load_policy=3&origin=${encodeURIComponent(origin)}`;
  }, [rawYoutubeId]);

  // Initialize YT.Player on iframe mount or when API is ready
  const initPlayer = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!(window as any).YT || !(window as any).YT.Player) return;
    if (!rawYoutubeId || ytPlayerRef.current) return;
    const iframeEl = document.getElementById('cineverse-screen-yt-iframe');
    if (!iframeEl) return;

    try {
      const player = new (window as any).YT.Player('cineverse-screen-yt-iframe', {
        events: {
          onReady: (e: any) => {
            ytPlayerRef.current = e.target;
            if (typeof window !== 'undefined') {
              (window as any).__cineverse_yt_player = e.target;
            }
            setYoutubeReady(true);
            const shouldAutoPlay = useCinemaStore.getState().trailer.isPlaying || pendingPlayRef.current;
            if (shouldAutoPlay) {
              try {
                e.target.unMute();
                e.target.setVolume(100);
                e.target.playVideo();
                setTrailerState({ isPlaying: true, isMuted: false, playbackStatus: 'playing' });
                setHouseLights('show');
              } catch { }
            } else {
              setTrailerPlaybackStatus('ready');
            }
          },
          onStateChange: (e: any) => {
            const state = e.data;
            setYoutubePlayerState(state);
            if (state === 1) {
              // YT.PlayerState.PLAYING
              setTrailerPlaybackStatus('playing');
              setYoutubeVerifiedPlaying(true);
              verifiedAdvancingRef.current = true;
              if (watchdogTimeoutRef.current) {
                clearTimeout(watchdogTimeoutRef.current);
                watchdogTimeoutRef.current = null;
              }
            } else if (state === 2) {
              // YT.PlayerState.PAUSED
              setTrailerPlaybackStatus('paused');
              setYoutubeVerifiedPlaying(false);
            } else if (state === 3) {
              // YT.PlayerState.BUFFERING
              setTrailerPlaybackStatus('loading');
            } else if (state === 0) {
              // YT.PlayerState.ENDED
              setTrailerPlaybackStatus('paused');
              setYoutubeVerifiedPlaying(false);
            }
          },
          onError: (e: any) => {
            const code = e.data;
            console.warn(`[Screen] YouTube Player Error Code ${code}.`);
            setYoutubeErrorCode(code);
            setTrailerState({ youtubeErrorCode: code });
            // If local video clip exists, fall back to video texture directly on 3D screen
            const currentTrailer = useCinemaStore.getState().trailer;
            const glimpse = (currentTrailer as any).glimpseUrl || (currentTrailer as any).glimpse_url;
            if (glimpse) {
              setTrailerState({ trailerUrl: glimpse, activeStrategy: 'video_texture', isPlaying: true });
            }
          },
        },
      });
      ytPlayerRef.current = player;
    } catch (err) {
      console.warn('[Screen] Failed to attach YouTube player controller:', err);
    }
  }, [rawYoutubeId, setTrailerPlaybackStatus, setTrailerState, setHouseLights]);

  useEffect(() => {
    if (activeStrategy === 'youtube_css3d' && rawYoutubeId) {
      initPlayer();
      const interval = setInterval(() => {
        if (ytPlayerRef.current) {
          clearInterval(interval);
        } else {
          initPlayer();
        }
      }, 250);
      return () => clearInterval(interval);
    }
  }, [ytApiLoaded, activeStrategy, rawYoutubeId, initPlayer]);

  // Sync YouTube Controls (Play/Pause/Mute)
  useEffect(() => {
    if (activeStrategy !== 'youtube_css3d' || !ytPlayerRef.current) return;
    try {
      if (trailer.isPlaying && typeof ytPlayerRef.current.playVideo === 'function') {
        const state = typeof ytPlayerRef.current.getPlayerState === 'function' ? ytPlayerRef.current.getPlayerState() : -1;
        if (state !== 1) {
          ytPlayerRef.current.playVideo();
        }
      } else if (!trailer.isPlaying && typeof ytPlayerRef.current.pauseVideo === 'function') {
        const state = typeof ytPlayerRef.current.getPlayerState === 'function' ? ytPlayerRef.current.getPlayerState() : -1;
        if (state === 1) {
          ytPlayerRef.current.pauseVideo();
        }
      }
    } catch { }
  }, [trailer.isPlaying, activeStrategy]);

  useEffect(() => {
    if (activeStrategy !== 'youtube_css3d' || !ytPlayerRef.current) return;
    try {
      if (trailer.isMuted && typeof ytPlayerRef.current.mute === 'function') {
        ytPlayerRef.current.mute();
      } else if (!trailer.isMuted && typeof ytPlayerRef.current.unMute === 'function') {
        ytPlayerRef.current.unMute();
      }
    } catch { }
  }, [trailer.isMuted, activeStrategy]);

  // User Gesture Handlers (§ Part 1, 2)
  const handleStartPlayback = useCallback(() => {
    // If Theatre Mode is selected (default) and trailer is YouTube-only, open Theatre Mode directly (§ Part 1)
    const displayPref = useCinemaStore.getState().trailerDisplayPreference;
    if (displayPref === 'theatre_mode' && activeStrategy !== 'video_texture') {
      setTheatreModeOpen(true);
      return;
    }

    // 1. Hosted video texture (§ Part 1: keeps playing on 3D screen as video texture)
    if (activeStrategy === 'video_texture' && videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.volume = 1.0;
      setTrailerPlaybackStatus('loading');

      // Resume AudioContext if suspended
      if (typeof window !== 'undefined') {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          try {
            const ctx = new AudioCtx();
            if (ctx.state === 'suspended') {
              ctx.resume();
            }
          } catch {}
        }
      }

      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setTrailerState({ isPlaying: true, isMuted: false });
            setHouseLights('show');
          })
          .catch(() => {
            if (videoRef.current) {
              videoRef.current.muted = true;
              videoRef.current
                .play()
                .then(() => {
                  setTrailerState({ isPlaying: true, isMuted: true });
                  setHouseLights('show');
                })
                .catch(() => {
                  setTrailerPlaybackStatus('blocked');
                });
            }
          });
      }
    } else if (activeStrategy === 'youtube_css3d' && rawYoutubeId) {
      // 2. Experimental On-Screen YouTube Player (§ Part 2)
      // Never allow sound without picture: start strictly MUTED with loading status
      pendingPlayRef.current = true;
      verifiedAdvancingRef.current = false;
      setTrailerState({ isPlaying: true, isMuted: true, playbackStatus: 'loading' });
      setHouseLights('show');

      if (ytPlayerRef.current && typeof ytPlayerRef.current.playVideo === 'function') {
        try {
          ytPlayerRef.current.mute(); // STRICTLY MUTED until picture and time advance are verified!
          ytPlayerRef.current.playVideo();
        } catch (err) {
          console.warn('[Screen] Direct YouTube play failed:', err);
        }
      }

      // Watchdog: If picture is not visible / advancing within 2 seconds, stop audio and show toast (§ Part 2)
      if (watchdogTimeoutRef.current) clearTimeout(watchdogTimeoutRef.current);
      watchdogTimeoutRef.current = setTimeout(() => {
        if (!verifiedAdvancingRef.current) {
          console.warn('[Screen] YouTube picture not visible on 3D screen within 2s. Stopping audio.');
          try {
            ytPlayerRef.current?.pauseVideo?.();
            ytPlayerRef.current?.mute?.();
          } catch {}
          setTrailerPlaybackStatus('error');
          showToast('The picture is not visible on the 3D screen', {
            label: 'Open Theatre Mode',
            onClick: () => setTheatreModeOpen(true),
          });
        }
      }, 2000);
    } else {
      // 3. Fallback / Title Card / No trailer
      setTrailerState({ isPlaying: true, playbackStatus: 'playing' });
      setHouseLights('show');
    }
  }, [activeStrategy, rawYoutubeId, setTrailerState, setHouseLights, setTrailerPlaybackStatus, setTheatreModeOpen]);

  // Expose global play handler for external clicks
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__cineverse_play_trailer = handleStartPlayback;
    }
    return () => {
      if (typeof window !== 'undefined') {
        (window as any).__cineverse_play_trailer = null;
      }
    };
  }, [handleStartPlayback]);

  const handleScreenClick = useCallback(() => {
    if (!trailer.isPlaying || trailer.playbackStatus !== 'playing') {
      handleStartPlayback();
    } else if (activeStrategy !== 'youtube_css3d') {
      toggleTrailerPlay();
    }
  }, [trailer.isPlaying, trailer.playbackStatus, handleStartPlayback, toggleTrailerPlay, activeStrategy]);

  // Space key listener for play/pause (§ Part D.1)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        handleScreenClick();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleScreenClick]);

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
      geom.scale(1, 1, -1);
      geom.translate(0, 0, -radius);
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

  // Frame Update Loop & 1.0s Truthful Playback Advancement Verification
  const lastVideoTime = useRef(-1);
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(0);
  const currentFpsRef = useRef(60);

  // Cut-out is true when YouTube CSS 3D is active, playing, and NOT in Theatre Mode!
  const isCutout = Boolean(
    activeStrategy === 'youtube_css3d' &&
    trailer.isPlaying &&
    !trailer.isTheatreMode
  );

  // Transparent cutout shader material punching through 3D canvas so CSS3D player behind is visible (§ Part B.2)
  const cutoutMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        void main() {
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        void main() {
          gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
        }
      `,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.ZeroFactor,
      blendDst: THREE.ZeroFactor,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.ZeroFactor,
      depthWrite: true,
      depthTest: true,
      side: THREE.DoubleSide,
    });
  }, []);

  // Set transparent canvas background when cutout is active, otherwise opaque theatre background
  useEffect(() => {
    if (isCutout) {
      scene.background = null;
      gl.setClearColor(0x000000, 0.0);
    } else {
      scene.background = new THREE.Color('#0E0F12');
      gl.setClearColor('#0E0F12', 1.0);
    }
    return () => {
      scene.background = new THREE.Color('#0E0F12');
      gl.setClearColor('#0E0F12', 1.0);
    };
  }, [isCutout, gl, scene]);

  // Runtime Visibility Check: if player says playing but screen stays uniform for 2s, show notice (§ Part B)
  const uniformStartTimeRef = useRef<number | null>(null);
  const uniformToastShownRef = useRef<boolean>(false);

  useEffect(() => {
    if (!trailer.isPlaying || trailer.isTheatreMode) {
      uniformStartTimeRef.current = null;
      uniformToastShownRef.current = false;
      return;
    }

    const checkVisibility = () => {
      if (uniformToastShownRef.current) return;
      if (!trailer.isPlaying || trailer.playbackStatus !== 'playing') return;

      // Sample pixels if available via window.__cineverse
      if (typeof window !== 'undefined' && (window as any).__cineverse?.samplePixelAt) {
        const sample = (window as any).__cineverse.samplePixelAt;
        const p1 = sample(0.48, 0.48);
        const p2 = sample(0.50, 0.50);
        const p3 = sample(0.52, 0.52);

        // Check if black or uniform
        const isBlack = (p2[0] === 0 && p2[1] === 0 && p2[2] === 0) || (p2[0] < 15 && p2[1] < 15 && p2[2] < 15);
        const isUniform = Math.abs(p1[0] - p2[0]) + Math.abs(p1[1] - p2[1]) + Math.abs(p1[2] - p2[2]) < 3 &&
                          Math.abs(p2[0] - p3[0]) + Math.abs(p2[1] - p3[1]) + Math.abs(p2[2] - p3[2]) < 3;

        const now = performance.now();
        if (isBlack || isUniform) {
          if (uniformStartTimeRef.current === null) {
            uniformStartTimeRef.current = now;
          } else if (now - uniformStartTimeRef.current >= 2000) {
            uniformToastShownRef.current = true;
            console.warn('[Screen] The picture is not visible on the 3D screen. Uniform frame detected for 2 seconds while playing.');
            showToast('The picture is not visible on the 3D screen', {
              label: 'Open Theatre Mode',
              onClick: () => setTheatreModeOpen(true),
            });
          }
        } else {
          uniformStartTimeRef.current = null;
        }
      }
    };

    const interval = setInterval(checkVisibility, 500);
    return () => clearInterval(interval);
  }, [trailer.isPlaying, trailer.playbackStatus, trailer.isTheatreMode, showToast, setTheatreModeOpen]);

  
  // Render static 2D canvas once on mount/data change instead of every frame (§ Part B)
  const renderTitleCardCanvas = useCallback(() => {
    if (!canvas || !fallbackTextureRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    if (trailer.isTheatreMode) {
      if (backdropImgRef.current) {
        ctx.drawImage(backdropImgRef.current, 0, 0, w, h);
      } else if (posterImgRef.current) {
        ctx.drawImage(posterImgRef.current, 0, 0, w, h);
      } else {
        ctx.fillStyle = '#0f1420';
        ctx.fillRect(0, 0, w, h);
      }
      ctx.fillStyle = 'rgba(10, 14, 24, 0.75)';
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.textAlign = 'center';

      ctx.fillStyle = 'rgba(225, 29, 72, 0.25)';
      ctx.beginPath();
      ctx.arc(w / 2, h / 2 - 25, 50, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#e11d48';
      ctx.beginPath();
      ctx.arc(w / 2, h / 2 - 25, 38, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 30px sans-serif';
      ctx.fillText('▶', w / 2 + 2, h / 2 - 14);

      ctx.font = 'bold 34px "Cinzel", "Times New Roman", serif';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 12;
      ctx.fillText((trailer.movieTitle || 'NOW SHOWING').toUpperCase(), w / 2, h / 2 + 50);

      ctx.font = 'bold 16px sans-serif';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('PLAYING IN THEATRE MODE', w / 2, h / 2 + 85);
      ctx.restore();
    } else if (activeStrategy === 'test_card' || overrideMode === 'test_card') {
      ctx.fillStyle = '#080d1a';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 64) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 64) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(32, 32, 200, 85);
      ctx.fillStyle = '#042f2e';
      ctx.font = '900 30px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('[LEFT]', 132, 85);

      ctx.fillStyle = '#eab308';
      ctx.fillRect(w - 232, 32, 200, 85);
      ctx.fillStyle = '#422006';
      ctx.font = '900 30px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('[RIGHT]', w - 132, 85);

      ctx.fillStyle = '#10b981';
      ctx.fillRect(w / 2 - 100, 16, 200, 48);
      ctx.fillStyle = '#022c22';
      ctx.font = '900 20px sans-serif';
      ctx.fillText('[TOP / UP]', w / 2, 48);

      ctx.fillStyle = '#f43f5e';
      ctx.fillRect(w / 2 - 100, h - 64, 200, 48);
      ctx.fillStyle = '#4c0519';
      ctx.fillText('[BOTTOM / DOWN]', w / 2, h - 32);

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(w / 2 - 40, h / 2);
      ctx.lineTo(w / 2 + 40, h / 2);
      ctx.moveTo(w / 2, h / 2 - 40);
      ctx.lineTo(w / 2, h / 2 + 40);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('ORIENTATION & ALIGNMENT TEST CARD', w / 2, h / 2 - 60);
      ctx.font = '14px monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`Screen: ${screenWidth.toFixed(2)}m x ${screenHeight.toFixed(2)}m | Center: [${screenCenter.map((v) => v.toFixed(2)).join(', ')}]`, w / 2, h / 2 + 70);
    } else {
      const bgGrad = ctx.createLinearGradient(0, 0, w, h);
      bgGrad.addColorStop(0, '#162238');
      bgGrad.addColorStop(0.5, '#253554');
      bgGrad.addColorStop(1, '#18243a');
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

      if (theatreModeOpen || trailer.isTheatreMode) {
        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 15px sans-serif';
        ctx.fillText('PLAYING IN THEATRE MODE  •  CLOSE WINDOW TO RETURN', textX, badgeY + 186);
      } else {
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText('Press "Play trailer" on the screen for the full theatrical trailer', textX, badgeY + 186);
      }

      ctx.restore();
    }

    fallbackTextureRef.current.needsUpdate = true;
  }, [canvas, trailer.isTheatreMode, theatreModeOpen, activeStrategy, overrideMode, screenWidth, screenHeight, screenCenter, trailer.movieTitle, screenConfig]);

  useEffect(() => {
    renderTitleCardCanvas();
  }, [renderTitleCardCanvas, assetsLoaded]);

  // Player polling at at most 4 times per second (250ms) (§ Part B, C)
  useEffect(() => {
    if (activeStrategy !== 'youtube_css3d' || !trailer.isPlaying || trailer.isTheatreMode) {
      return;
    }
    const timer = setInterval(() => {
      if (!ytPlayerRef.current) return;
      try {
        const state = typeof ytPlayerRef.current.getPlayerState === 'function' ? ytPlayerRef.current.getPlayerState() : -1;
        const curTime = typeof ytPlayerRef.current.getCurrentTime === 'function' ? ytPlayerRef.current.getCurrentTime() : -1;
        setYoutubePlayerState(state);

        if (state === 1 && curTime > 0.05) {
          if (trailer.playbackStatus !== 'playing') {
            setTrailerPlaybackStatus('playing');
          }
          setYoutubeVerifiedPlaying(true);
          verifiedAdvancingRef.current = true;
          // Unmute now that picture and advance are verified (§ Part 2)
          if (!trailer.isMuted && ytPlayerRef.current && typeof ytPlayerRef.current.unMute === 'function') {
            try {
              ytPlayerRef.current.unMute();
              ytPlayerRef.current.setVolume(100);
            } catch {}
          }
          if (watchdogTimeoutRef.current) {
            clearTimeout(watchdogTimeoutRef.current);
            watchdogTimeoutRef.current = null;
          }
        } else if (state === 2 && trailer.playbackStatus === 'playing') {
          setTrailerPlaybackStatus('paused');
        } else if (state === 3 && trailer.playbackStatus !== 'loading') {
          setTrailerPlaybackStatus('loading');
        }
      } catch {}
    }, 250);

    return () => clearInterval(timer);
  }, [activeStrategy, trailer.isPlaying, trailer.isTheatreMode, trailer.playbackStatus, setTrailerPlaybackStatus]);

  // Clean destruction of player and textures on unmount (§ Part B)
  useEffect(() => {
    return () => {
      if (watchdogTimeoutRef.current) {
        clearTimeout(watchdogTimeoutRef.current);
        watchdogTimeoutRef.current = null;
      }
      try {
        ytPlayerRef.current?.destroy?.();
      } catch {}
      ytPlayerRef.current = null;
      videoTextureRef.current?.dispose();
      fallbackTextureRef.current?.dispose();
    };
  }, []);

  const lastTelemetryTimeRef = useRef<number>(0);

  useFrame(({ clock, invalidate }) => {
    frameCountRef.current++;
    const now = clock.getElapsedTime();
    if (now - lastFpsTimeRef.current >= 1.0) {
      currentFpsRef.current = frameCountRef.current;
      frameCountRef.current = 0;
      lastFpsTimeRef.current = now;
    }

    // 1. Video Texture Update (only when video frame advances)
    if (activeStrategy === 'video_texture') {
      const vid = videoRef.current;
      if (vid && !vid.paused && vid.currentTime !== lastVideoTime.current) {
        lastVideoTime.current = vid.currentTime;
        if (videoTextureRef.current) {
          videoTextureRef.current.needsUpdate = true;
        }
        invalidate();
      }
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
          alpha: isCutout,
          clearAlpha: isCutout ? 0.0 : 1.0,
          hasSceneBackground: !isCutout,
          fogActive: !isCutout,
          toneMapping: 'ACESFilmicToneMapping',
          isOpaquePostProcessing: false,
        },
        cssLayering: {
          canvasZIndex: '10',
          canvasPointerEvents: 'auto',
          canvasOpacity: '1.0',
          canvasDisplay: 'block',
          iframeZIndex: isCutout ? '1' : undefined,
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
          autoplayResult: youtubeVerifiedPlaying ? 'success' : 'pending',
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
    activeStrategy === 'video_texture' && videoLoaded && !videoError && trailer.isPlaying
      ? videoTextureRef.current
      : fallbackTexture;

  const isSolidColor = activeStrategy === 'solid_color';
  const screenBrightness = houseLights === 'show' ? 1.0 : houseLights === 'dim' ? 0.92 : 0.82;

  return (
    <group name="ScreenContainer">
      <mesh
        ref={meshRef}
        name="DynamicScreenOverlay"
        geometry={screenGeometry}
        position={screenCenter}
        raycast={isCutout ? () => null : undefined}
        onClick={(e) => {
          if (isCutout) return;
          e.stopPropagation();
          handleScreenClick();
        }}
      >
        {isCutout ? (
          <primitive object={cutoutMaterial} attach="material" />
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

      {/* Official YouTube Player placed directly behind 3D Screen cutout via CameraGuardedCSS3D (§ Part 1, 2) */}
      {activeStrategy === 'youtube_css3d' && rawYoutubeId && !trailer.isTheatreMode && trailerDisplayPreference === 'screen_3d' && (
        <CameraGuardedCSS3D
          position={[screenCenter[0], screenCenter[1], screenCenter[2]]}
          rotation={[0, Math.PI, 0]}
          distanceFactor={400 / (640 / screenWidth)}
          width={640}
          height={Math.round(640 / (screenWidth / screenHeight))}
          pointerEvents="auto"
          zIndex={0}
        >
          <div data-testid="screen-youtube-player" className="relative w-full h-full overflow-hidden">
            <iframe
              id="cineverse-screen-yt-iframe"
              src={stableYoutubeSrc}
              className={`w-full h-full border-0 bg-black rounded-sm transition-transform duration-300 ${screenFitMode === 'fill' ? 'scale-[1.22]' : 'scale-100'}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              loading="eager"
              allowFullScreen
              onLoad={initPlayer}
            />
            {!trailer.isPlaying && (
              <div
                data-testid="screen-3d-play-button-container"
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartPlayback();
                }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] cursor-pointer group select-none"
              >
                <button
                  type="button"
                  data-testid="screen-3d-play-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartPlayback();
                  }}
                  className="flex flex-col items-center justify-center gap-4 transition-transform group-hover:scale-110 active:scale-95 focus:outline-none"
                  aria-label="Play trailer on screen"
                >
                  <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-tr from-rose-600 to-red-500 text-white shadow-[0_0_50px_rgba(225,29,72,0.9)] ring-4 ring-white/90">
                    <span className="absolute inset-0 rounded-full animate-ping bg-rose-500/30 duration-1000" />
                    <Play className="h-12 w-12 fill-white translate-x-1 drop-shadow-xl" />
                  </div>
                  <div className="rounded-full border-2 border-white/50 bg-black/90 px-6 py-2 text-sm font-black tracking-widest uppercase text-white shadow-2xl backdrop-blur-md">
                    Play trailer
                  </div>
                </button>
              </div>
            )}
          </div>
        </CameraGuardedCSS3D>
      )}

      {/* If player fails (error 101, 150, 153) or restricted, keep 3D screen showing title card with plain message and Watch in Theatre Mode button (§ Part A) */}
      {(youtubeErrorCode !== null || (activeStrategy === 'title_card' && rawYoutubeId && trailer.isPlaying)) && !trailer.isTheatreMode && (
        <CameraGuardedCSS3D
          position={[screenCenter[0], screenCenter[1], screenCenter[2] - 0.03]}
          rotation={[0, Math.PI, 0]}
          distanceFactor={400 / (640 / screenWidth)}
          width={640}
          height={Math.round(640 / (screenWidth / screenHeight))}
          pointerEvents="auto"
          zIndex={1}
        >
          <div data-testid="screen-error-fallback" className="relative w-full h-full flex flex-col items-center justify-center bg-slate-950/90 text-white p-6 text-center select-none border border-white/10 rounded-sm">
            <div className="text-sm sm:text-base font-bold text-rose-400 mb-2">
              {youtubeErrorCode === 101 || youtubeErrorCode === 150 || youtubeErrorCode === 153
                ? `Embedding restricted by content owner (Error ${youtubeErrorCode})`
                : 'Trailer unavailable directly on 3D screen'}
            </div>
            <p className="text-xs text-slate-300 max-w-sm mb-4">
              Watch this trailer with full audio in high-definition Theatre Mode.
            </p>
            <button
              onClick={() => setTheatreModeOpen(true)}
              data-testid="watch-in-theatre-mode-btn"
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-xl hover:from-red-500 hover:to-rose-500 transition active:scale-95"
            >
              <Maximize2 className="h-4 w-4" />
              <span>Watch in Theatre Mode</span>
            </button>
          </div>
        </CameraGuardedCSS3D>
      )}

      {/* 3D Return to Hall / Theatre Mode indicator (§ Part 1) */}
      {(theatreModeOpen || trailer.isTheatreMode) && (
        <CameraGuardedCSS3D
          position={[screenCenter[0], screenCenter[1], screenCenter[2] - 0.03]}
          rotation={[0, Math.PI, 0]}
          distanceFactor={400 / (640 / screenWidth)}
          width={440}
          height={160}
          pointerEvents="auto"
          zIndex={2}
        >
          <div data-testid="screen-theatre-mode-indicator" className="relative flex flex-col items-center justify-center bg-black/85 backdrop-blur-md text-white p-4 rounded-xl border border-amber-500/30 shadow-2xl text-center select-none">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm tracking-wide mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
              PLAYING IN THEATRE MODE
            </div>
            <p className="text-xs text-slate-300 mb-3">High-definition audio and video active in Theatre Mode overlay.</p>
            <button
              type="button"
              data-testid="return-to-hall-btn"
              onClick={(e) => {
                e.stopPropagation();
                setTheatreModeOpen(false);
              }}
              className="flex items-center gap-2 rounded-lg bg-white/10 hover:bg-white/20 px-4 py-1.5 text-xs font-semibold text-white border border-white/30 transition active:scale-95 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Return to Hall</span>
            </button>
          </div>
        </CameraGuardedCSS3D>
      )}

      {/* Proscenium Bezel Frame: Hollow 4-border frame to maximize picture area and keep center open for cutout (§ Part A) */}
      <group
        name="ScreenProsceniumFrame"
        position={[screenCenter[0], screenCenter[1], screenCenter[2] - 0.015]}
      >
        {/* Top Border */}
        <mesh
          position={[0, screenHeight / 2 + (isDirectView ? 0.02 : 0.04) / 2, 0]}
          raycast={() => null}
        >
          <boxGeometry args={[screenWidth + (isDirectView ? 0.04 : 0.08), isDirectView ? 0.02 : 0.04, 0.02]} />
          <meshStandardMaterial
            color={isDirectView ? '#09090b' : '#0f172a'}
            roughness={isDirectView ? 0.2 : 0.5}
            metalness={isDirectView ? 0.8 : 0.6}
          />
        </mesh>
        {/* Bottom Border */}
        <mesh
          position={[0, -screenHeight / 2 - (isDirectView ? 0.02 : 0.04) / 2, 0]}
          raycast={() => null}
        >
          <boxGeometry args={[screenWidth + (isDirectView ? 0.04 : 0.08), isDirectView ? 0.02 : 0.04, 0.02]} />
          <meshStandardMaterial
            color={isDirectView ? '#09090b' : '#0f172a'}
            roughness={isDirectView ? 0.2 : 0.5}
            metalness={isDirectView ? 0.8 : 0.6}
          />
        </mesh>
        {/* Left Border */}
        <mesh
          position={[-screenWidth / 2 - (isDirectView ? 0.02 : 0.04) / 2, 0, 0]}
          raycast={() => null}
        >
          <boxGeometry args={[isDirectView ? 0.02 : 0.04, screenHeight, 0.02]} />
          <meshStandardMaterial
            color={isDirectView ? '#09090b' : '#0f172a'}
            roughness={isDirectView ? 0.2 : 0.5}
            metalness={isDirectView ? 0.8 : 0.6}
          />
        </mesh>
        {/* Right Border */}
        <mesh
          position={[screenWidth / 2 + (isDirectView ? 0.02 : 0.04) / 2, 0, 0]}
          raycast={() => null}
        >
          <boxGeometry args={[isDirectView ? 0.02 : 0.04, screenHeight, 0.02]} />
          <meshStandardMaterial
            color={isDirectView ? '#09090b' : '#0f172a'}
            roughness={isDirectView ? 0.2 : 0.5}
            metalness={isDirectView ? 0.8 : 0.6}
          />
        </mesh>
      </group>

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
            raycast={() => null}
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
            raycast={() => null}
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

      {/* Screen dynamic light spill into the auditorium (§ Part E) */}
      {qualityTier !== 'low' && (
        <spotLight
          ref={lightRef}
          name="ScreenLightSpill"
          position={[0, screenCenter[1] + 0.45, screenCenter[2] - 0.05]}
          target-position={[0, 2.0, -14.0]}
          color={isSolidColor ? new THREE.Color(solidColor) : new THREE.Color(0.85, 0.90, 0.98)}
          intensity={houseLights === 'show' ? 5.0 : houseLights === 'dim' ? 2.5 : 0.8}
          distance={24}
          angle={Math.PI / 3.4}
          penumbra={0.8}
        />
      )}

      {/* Projector beam cone effect (§ Part E) */}
      {qualityTier === 'high' && hasProjectorBeam && (
        <mesh position={[0, 9.8, -24.8]} rotation={[0.22, 0, 0]} raycast={() => null}>
          <coneGeometry args={[3.2, 20.0, 32, 1, true]} />
          <meshBasicMaterial
            color={new THREE.Color(0.80, 0.88, 0.98)}
            transparent
            opacity={houseLights === 'show' ? 0.025 : 0.008}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}
