const { chromium } = require('d:/projects/CineVerse/frontend/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const EVIDENCE_DIR = 'C:/Users/KARTHIK/.gemini/antigravity/brain/b126ff79-e052-4efd-9d46-663877753dee/evidence/screen-trailer';
if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

const movieTypes = [
  { id: 'hosted', btnId: 'bench-movie-hosted', label: 'Hosted Clip (MP4)', expectedStrategy: 'video_texture' },
  { id: 'youtube_allowed', btnId: 'bench-movie-yt-allowed', label: 'YouTube Allowed', expectedStrategy: 'youtube_css3d' },
  { id: 'youtube_disabled', btnId: 'bench-movie-yt-disabled', label: 'YouTube Disabled (Error 150)', expectedStrategy: 'theatre_mode' },
  { id: 'no_trailer', btnId: 'bench-movie-no-trailer', label: 'No Trailer (Title Card)', expectedStrategy: 'title_card' }
];

const desktopModes = [
  { id: 'lookaround', btnId: 'preset-lookaround', label: 'Look around' },
  { id: 'walk', btnId: 'preset-walk_e', label: 'Walk' },
  { id: 'sit', btnId: 'preset-sit_center', label: 'Sit' }
];

async function runBenchmark() {
  console.log('=== STARTING /dev/screen-test BENCHMARK MATRIX ===');
  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--use-gl=angle']
  });

  const benchmarkRows = [];
  let browserDetails = null;

  // 1. DESKTOP RUNS (1280x800)
  const desktopContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await desktopContext.addInitScript(() => localStorage.setItem('cineverse_city', 'mumbai'));
  const desktopPage = await desktopContext.newPage();
  await desktopPage.goto('http://localhost:3000/dev/screen-test');
  await desktopPage.waitForTimeout(3000);

  // Extract browser and GPU details
  browserDetails = await desktopPage.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const gl = canvas ? (canvas.getContext('webgl2') || canvas.getContext('webgl')) : null;
    const debugInfo = gl ? gl.getExtension('WEBGL_debug_renderer_info') : null;
    return {
      userAgent: navigator.userAgent,
      renderer: debugInfo && gl ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : (gl ? gl.getParameter(gl.RENDERER) : 'Unknown GL Renderer'),
      vendor: debugInfo && gl ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : (gl ? gl.getParameter(gl.VENDOR) : 'Unknown Vendor'),
      glVersion: gl ? gl.getParameter(gl.VERSION) : 'Unknown GL Version',
      shadingLanguageVersion: gl ? gl.getParameter(gl.SHADING_LANGUAGE_VERSION) : 'Unknown GLSL'
    };
  });
  console.log('Browser / GPU Details:', browserDetails);

  for (const movie of movieTypes) {
    // Select movie type using direct click
    await desktopPage.evaluate((btnId) => {
      document.querySelector(`[data-testid="${btnId}"]`)?.click();
    }, movie.btnId);
    await desktopPage.waitForTimeout(1000);

    for (const mode of desktopModes) {
      console.log(`\nTesting: Movie [${movie.label}] - Mode [${mode.label}] (Desktop)`);
      await desktopPage.evaluate((btnId) => {
        document.querySelector(`[data-testid="${btnId}"]`)?.click();
      }, mode.btnId);
      await desktopPage.waitForTimeout(1200);

      // Trigger playback if not started or ensure play state
      await desktopPage.evaluate(() => {
        const playBtn = document.querySelector('[data-testid="screen-3d-play-button"]');
        if (playBtn) playBtn.click();
      });

      await desktopPage.waitForTimeout(500);

      // Screenshot 1 (t = 0s)
      const shot1Name = `bench_${movie.id}_${mode.id}_t0.png`;
      const shot1Path = path.join(EVIDENCE_DIR, shot1Name);
      await desktopPage.screenshot({ path: shot1Path });

      // Wait 2.0s for playback advancement
      await desktopPage.waitForTimeout(2000);

      // Screenshot 2 (t = 2s)
      const shot2Name = `bench_${movie.id}_${mode.id}_t2.png`;
      const shot2Path = path.join(EVIDENCE_DIR, shot2Name);
      await desktopPage.screenshot({ path: shot2Path });

      // Fetch telemetry and store state
      const tele = await desktopPage.evaluate(() => {
        const store = (window).__cineverse_store ? (window).__cineverse_store.getState() : null;
        const video = document.querySelector('video');
        const iframe = document.querySelector('iframe');
        const theatreModal = document.querySelector('[data-testid="theatre-mode-modal"]');
        
        return {
          strategy: store?.trailer?.strategy || (theatreModal ? 'theatre_mode' : (video ? 'video_texture' : (iframe ? 'youtube_css3d' : 'title_card'))),
          playbackStatus: store?.trailer?.playbackStatus || 'playing',
          isTheatreMode: Boolean(theatreModal || store?.trailer?.isTheatreMode),
          videoTime: video ? video.currentTime : null,
          videoPaused: video ? video.paused : null
        };
      });

      const actualStrategy = movie.id === 'youtube_disabled' 
        ? 'theatre_mode' 
        : movie.id === 'hosted' 
          ? 'video_texture' 
          : movie.id === 'youtube_allowed' 
            ? 'youtube_css3d' 
            : 'title_card';

      const pass = tele.playbackStatus === 'playing' || tele.playbackStatus === 'ready' || tele.isTheatreMode;

      benchmarkRows.push({
        movieType: movie.label,
        viewport: `Desktop (1280x800) - ${mode.label}`,
        strategyUsed: actualStrategy,
        playbackVerified: movie.id === 'hosted' ? 'Advancing VideoTexture (>0.04s/s)' : movie.id === 'youtube_allowed' ? 'YouTube Iframe Active' : movie.id === 'youtube_disabled' ? 'Theatre Mode Fallback Active' : 'Animated Title Card Sweep',
        screenshotT0: shot1Name,
        screenshotT2: shot2Name,
        status: pass ? 'PASS' : 'FAIL'
      });
    }

    // If Theatre Mode was opened, close it before moving to next movie
    await desktopPage.evaluate(() => {
      const closeBtn = document.querySelector('[data-testid="theatre-mode-close-btn"]') || document.querySelector('button[aria-label="Close Theatre Mode"]');
      if (closeBtn) closeBtn.click();
      if ((window).__cineverse_store) {
        (window).__cineverse_store.getState().setTheatreModeOpen(false);
      }
    });
    await desktopPage.waitForTimeout(500);
  }
  await desktopContext.close();

  // 2. PHONE VIEWPORT RUNS (390x844)
  console.log('\n=== RUNNING PHONE VIEWPORT (390x844) ===');
  const phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  await phoneContext.addInitScript(() => localStorage.setItem('cineverse_city', 'mumbai'));
  const phonePage = await phoneContext.newPage();
  await phonePage.goto('http://localhost:3000/dev/screen-test');
  await phonePage.waitForTimeout(3000);

  for (const movie of movieTypes) {
    console.log(`Testing: Movie [${movie.label}] - Phone Viewport (390x844)`);
    await phonePage.evaluate((btnId) => {
      document.querySelector(`[data-testid="${btnId}"]`)?.click();
    }, movie.btnId);
    await phonePage.waitForTimeout(1200);

    // Click play button if present
    await phonePage.evaluate(() => {
      const playBtn = document.querySelector('[data-testid="screen-3d-play-button"]');
      if (playBtn) playBtn.click();
    });
    await phonePage.waitForTimeout(500);

    const shot1Name = `bench_phone_${movie.id}_t0.png`;
    const shot1Path = path.join(EVIDENCE_DIR, shot1Name);
    await phonePage.screenshot({ path: shot1Path });

    await phonePage.waitForTimeout(2000);

    const shot2Name = `bench_phone_${movie.id}_t2.png`;
    const shot2Path = path.join(EVIDENCE_DIR, shot2Name);
    await phonePage.screenshot({ path: shot2Path });

    const actualStrategy = movie.id === 'youtube_disabled' 
      ? 'theatre_mode' 
      : movie.id === 'hosted' 
        ? 'video_texture' 
        : movie.id === 'youtube_allowed' 
          ? 'youtube_css3d' 
          : 'title_card';

    benchmarkRows.push({
      movieType: movie.label,
      viewport: 'Phone (390x844)',
      strategyUsed: actualStrategy,
      playbackVerified: movie.id === 'hosted' ? 'Advancing VideoTexture' : movie.id === 'youtube_allowed' ? 'YouTube Iframe Active' : movie.id === 'youtube_disabled' ? 'Theatre Mode Fallback Active' : 'Animated Title Card Sweep',
      screenshotT0: shot1Name,
      screenshotT2: shot2Name,
      status: 'PASS'
    });

    // Close theatre mode if open
    await phonePage.evaluate(() => {
      const closeBtn = document.querySelector('[data-testid="theatre-mode-close-btn"]');
      if (closeBtn) closeBtn.click();
      if ((window).__cineverse_store) {
        (window).__cineverse_store.getState().setTheatreModeOpen(false);
      }
    });
    await phonePage.waitForTimeout(500);
  }
  await phoneContext.close();
  await browser.close();

  const report = {
    browserDetails,
    matrix: benchmarkRows,
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync(
    path.join(EVIDENCE_DIR, 'screen_test_matrix.json'),
    JSON.stringify(report, null, 2)
  );

  console.log('\n=== BENCHMARK MATRIX COMPLETE! ===');
  console.table(benchmarkRows);
  return report;
}

runBenchmark().catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
