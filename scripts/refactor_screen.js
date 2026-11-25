const fs = require('fs');

let code = fs.readFileSync('frontend/components/3d/Screen.tsx', 'utf8');

// 1. Replace Html import
code = code.replace(
  "import { Html } from '@react-three/drei';",
  "import { CameraGuardedCSS3D } from './CameraGuardedCSS3D';"
);

// 2. Extract Title Card drawing out of useFrame into renderTitleCardCanvas
const oldUseFrameStart = "useFrame(({ clock, invalidate }) => {";
const oldUseFrameEnd = "    // Telemetry Telecasting\n    if (onTelemetryUpdate) {";

const idxStart = code.indexOf(oldUseFrameStart);
const idxEnd = code.indexOf(oldUseFrameEnd);

if (idxStart === -1 || idxEnd === -1) {
  console.error("Could not find useFrame markers in Screen.tsx");
  process.exit(1);
}

// Read the old 2D canvas drawing logic from between lines 701 and 947
const newRenderCanvasAndUseFrame = `
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
      ctx.fillText(\`Screen: \${screenWidth.toFixed(2)}m x \${screenHeight.toFixed(2)}m | Center: [\${screenCenter.map((v) => v.toFixed(2)).join(', ')}]\`, w / 2, h / 2 + 70);
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

      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('Press "Play trailer" on the screen for the full theatrical trailer', textX, badgeY + 186);

      ctx.restore();
    }

    fallbackTextureRef.current.needsUpdate = true;
  }, [canvas, trailer.isTheatreMode, activeStrategy, overrideMode, screenWidth, screenHeight, screenCenter, trailer.movieTitle, screenConfig]);

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
`;

code = code.substring(0, idxStart) + newRenderCanvasAndUseFrame + code.substring(idxEnd);

// 3. Replace Html components with CameraGuardedCSS3D
const oldHtmlSection = `{/* Official YouTube Player placed directly on 3D Screen via CSS 3D */}`;
const oldHtmlEnd = `{/* Proscenium Bezel Frame */}`;

const idxHStart = code.indexOf(oldHtmlSection);
const idxHEnd = code.indexOf(oldHtmlEnd);

if (idxHStart === -1 || idxHEnd === -1) {
  console.error("Could not find Html section in Screen.tsx");
  process.exit(1);
}

const newHtmlSection = `{/* Official YouTube Player placed directly on 3D Screen via CameraGuardedCSS3D (§ Part B, C) */}
      {activeStrategy === 'youtube_css3d' && rawYoutubeId && trailer.isPlaying && !trailer.isTheatreMode && (
        <CameraGuardedCSS3D
          position={[screenCenter[0], screenCenter[1], screenCenter[2] + 0.02]}
          rotation={[0, Math.PI, 0]}
          distanceFactor={400 / (1280 / screenWidth)}
          width={1280}
          height={Math.round(1280 / (screenWidth / screenHeight))}
          pointerEvents="auto"
          zIndex={1}
        >
          <div data-testid="screen-youtube-player" className="w-full h-full">
            <iframe
              id="cineverse-screen-yt-iframe"
              src={\`https://www.youtube-nocookie.com/embed/\${rawYoutubeId}?enablejsapi=1&autoplay=1&mute=0&controls=1&loop=1&playlist=\${rawYoutubeId}&playsinline=1&origin=\${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')}&widget_referrer=\${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : 'http://localhost:3000')}\`}
              className="w-full h-full border-0 bg-black rounded-sm"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              onLoad={initPlayer}
            />
          </div>
        </CameraGuardedCSS3D>
      )}

      {/* Large Inviting Circular Play Button directly on 3D Screen */}
      {(!trailer.isPlaying || trailer.playbackStatus !== 'playing') && !trailer.isTheatreMode && (
        <CameraGuardedCSS3D
          position={[screenCenter[0], screenCenter[1], screenCenter[2] + 0.1]}
          rotation={[0, Math.PI, 0]}
          distanceFactor={400}
          width={320}
          height={240}
          pointerEvents="auto"
          zIndex={2}
        >
          <div data-testid="screen-3d-play-button-container" className="flex flex-col items-center justify-center w-full h-full">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleStartPlayback();
              }}
              data-testid="screen-3d-play-button"
              className="group flex flex-col items-center justify-center gap-3.5 transition-transform hover:scale-105 active:scale-95 cursor-pointer focus:outline-none"
              aria-label="Play trailer on screen"
            >
              <div className="relative flex h-28 w-28 sm:h-36 sm:w-36 md:h-40 md:w-40 items-center justify-center rounded-full bg-gradient-to-tr from-rose-600 to-red-500 text-white shadow-[0_0_60px_rgba(225,29,72,0.9)] ring-4 ring-white/90 backdrop-blur-md transition-all group-hover:ring-white group-hover:shadow-[0_0_80px_rgba(225,29,72,1)]">
                <span className="absolute inset-0 rounded-full animate-ping bg-rose-500/30 duration-1000" />
                <Play className="h-14 w-14 sm:h-18 sm:w-18 md:h-20 md:w-20 fill-white translate-x-1 drop-shadow-xl" />
              </div>
              <div className="rounded-full border-2 border-white/40 bg-black/90 px-6 py-2.5 text-sm sm:text-base font-black tracking-widest uppercase text-white shadow-2xl backdrop-blur-md group-hover:bg-black group-hover:border-white">
                Play trailer
              </div>
            </button>
          </div>
        </CameraGuardedCSS3D>
      )}

      `;

code = code.substring(0, idxHStart) + newHtmlSection + code.substring(idxHEnd);

fs.writeFileSync('frontend/components/3d/Screen.tsx', code, 'utf8');
console.log('Successfully refactored Screen.tsx!');
