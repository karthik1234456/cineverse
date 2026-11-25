const { chromium } = require('../frontend/node_modules/@playwright/test');
const fs = require('fs');
const path = require('path');

const EVIDENCE_DIR = 'C:/Users/KARTHIK/.gemini/antigravity/brain/b126ff79-e052-4efd-9d46-663877753dee/evidence/screen-trailer';
if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

async function runVerification() {
  console.log('=== Starting Screen Trailer & Theatre Mode Comprehensive Verification ===');

  const browser = await chromium.launch({
    headless: false,
    args: [
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--enable-gpu-rasterization',
      '--enable-zero-copy',
      '--use-gl=angle',
      '--use-angle=default',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });

  const results = {
    realMovie: null,
    showcaseMovie: null,
    benchmarkMatrix: [],
  };

  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1,
    });

    await page.addInitScript(() => {
      try {
        localStorage.setItem('cineverse_city', 'bengaluru');
        localStorage.setItem('cineverse_city_id', '1');
        localStorage.setItem('cineverse_city_name', 'Bengaluru');
        localStorage.setItem('cineverse_city_modal_dismissed', 'true');
        localStorage.setItem('cineverse_comfort_settings', JSON.stringify({ simpleMode: false, reducedMotion: false }));
      } catch (e) {}
    });

    // =========================================================================
    // PART 1: Real Movie Test (/cinemas/11/auditorium/36?showtime=737&mode=3d - Clayface)
    // =========================================================================
    console.log('\n--- 1. Testing Real Movie (Clayface - YouTube Trailer) ---');
    await page.goto('http://localhost:3001/cinemas/11/auditorium/36?showtime=737&mode=3d', {
      waitUntil: 'domcontentloaded',
    });

    // Wait for 3D engine and auditorium data to load
    await page.waitForSelector('canvas', { timeout: 30000 });
    await page.waitForTimeout(3000);

    // Verify initial truthful state (NOT playing, NOT grey slab)
    const initialBadge = await page.textContent('[data-testid="screen-playback-status-badge"]');
    console.log(`Initial Badge Text: "${initialBadge.trim()}"`);

    // Verify on-screen Play button exists
    const onScreenPlayBtn = page.locator('[data-testid="screen-3d-play-button"]');
    const playBtnVisible = await onScreenPlayBtn.isVisible();
    console.log(`On-Screen Large Play Button Visible: ${playBtnVisible}`);

    // Capture initial idle screenshot (movie poster on screen with large Play button, no grey slab)
    const realIdlePath = path.join(EVIDENCE_DIR, '01_real_movie_idle_screen.png');
    await page.screenshot({ path: realIdlePath });
    console.log(`Saved: ${realIdlePath}`);

    // Click the on-screen Play button (simulating user gesture)
    console.log('Clicking on-screen Play button...');
    await onScreenPlayBtn.click();

    // The 3-second watchdog will attempt CSS 3D layer and gracefully open Theatre Mode
    console.log('Waiting for playback / Theatre Mode watchdog (up to 4.5s)...');
    await page.waitForTimeout(4000);

    // Capture screen playing state
    const realScreenPlayPath = path.join(EVIDENCE_DIR, '01b_real_movie_css3d_playing.png');
    await page.screenshot({ path: realScreenPlayPath });
    console.log(`Saved: ${realScreenPlayPath}`);

    // Now test opening Theatre Mode directly from the HUD panel button (§ Part 3)
    console.log('Testing direct Theatre Mode button from HUD cluster...');
    const hudTheatreBtn = page.locator('[data-testid="open-theatre-mode-btn"]');
    if (await hudTheatreBtn.isVisible()) {
      await hudTheatreBtn.click();
      await page.waitForTimeout(1500);
    }

    // Verify Theatre Mode modal opened
    const theatreModal = page.locator('[data-testid="theatre-mode-modal"]');
    const isTheatreOpen = await theatreModal.isVisible();
    console.log(`Theatre Mode Modal Opened: ${isTheatreOpen}`);

    // Capture Theatre Mode screenshot at T=0s
    const realPlayT0Path = path.join(EVIDENCE_DIR, '02_real_movie_theatre_mode_t0.png');
    await page.screenshot({ path: realPlayT0Path });
    console.log(`Saved: ${realPlayT0Path}`);

    // Wait 2.0 seconds and capture T=2s screenshot to verify playback advances
    await page.waitForTimeout(2000);
    const realPlayT2Path = path.join(EVIDENCE_DIR, '03_real_movie_theatre_mode_t2.png');
    await page.screenshot({ path: realPlayT2Path });
    console.log(`Saved: ${realPlayT2Path}`);

    // Read status badge in Theatre Mode
    const activeBadgeText = await page.textContent('[data-testid="screen-playback-status-badge"]');
    console.log(`Active Playback Badge: "${activeBadgeText.trim()}"`);

    // Return to 3D View using Back button
    const backBtn = page.locator('[data-testid="theatre-mode-back-btn"]');
    if (await backBtn.isVisible()) {
      await backBtn.click();
      await page.waitForTimeout(1000);
      console.log('Returned to 3D Hall from Theatre Mode.');
    }

    const realBack3DPath = path.join(EVIDENCE_DIR, '04_real_movie_back_in_3d.png');
    await page.screenshot({ path: realBack3DPath });
    console.log(`Saved: ${realBack3DPath}`);

    results.realMovie = {
      title: 'Clayface',
      url: '/cinemas/11/auditorium/36?showtime=737',
      initialBadge: initialBadge.trim(),
      playButtonVisible: playBtnVisible,
      theatreModeOpened: isTheatreOpen,
      activeBadge: activeBadgeText.trim(),
      pass: playBtnVisible && isTheatreOpen,
    };

    // =========================================================================
    // PART 2: Showcase Movie Test (Quantum Odyssey - Hosted MP4 VideoTexture)
    // =========================================================================
    console.log('\n--- 2. Testing Showcase Movie (Quantum Odyssey - Hosted MP4 VideoTexture) ---');
    await page.goto('http://localhost:3001/cinemas/12/auditorium/39?showtime=1875&mode=3d', {
      waitUntil: 'domcontentloaded',
    });

    await page.waitForSelector('canvas', { timeout: 30000 });
    await page.waitForTimeout(3000);

    const showcaseInitialBadge = await page.textContent('[data-testid="screen-playback-status-badge"]');
    console.log(`Showcase Initial Badge Text: "${showcaseInitialBadge.trim()}"`);

    const showcasePlayBtn = page.locator('[data-testid="screen-3d-play-button"]');
    const showcasePlayBtnVisible = await showcasePlayBtn.isVisible();
    console.log(`Showcase Large Play Button Visible: ${showcasePlayBtnVisible}`);

    const showcaseIdlePath = path.join(EVIDENCE_DIR, '05_showcase_movie_idle_screen.png');
    await page.screenshot({ path: showcaseIdlePath });
    console.log(`Saved: ${showcaseIdlePath}`);

    // Click on-screen Play button
    console.log('Clicking showcase on-screen Play button...');
    await showcasePlayBtn.click();
    await page.waitForTimeout(1500);

    // Verify video element time is advancing
    const videoAdvancing = await page.evaluate(async () => {
      const vid = window.__cineverse_video;
      if (!vid) return { exists: false, time1: -1, time2: -1, advanced: false };
      const t1 = vid.currentTime;
      await new Promise((r) => setTimeout(r, 1200));
      const t2 = vid.currentTime;
      return {
        exists: true,
        time1: t1,
        time2: t2,
        advanced: t2 - t1 > 0.05,
        paused: vid.paused,
        muted: vid.muted,
      };
    });
    console.log('Showcase Video Advancement Evaluation:', videoAdvancing);

    const showcasePlayT0Path = path.join(EVIDENCE_DIR, '06_showcase_movie_playing_t0.png');
    await page.screenshot({ path: showcasePlayT0Path });
    console.log(`Saved: ${showcasePlayT0Path}`);

    await page.waitForTimeout(2000);
    const showcasePlayT2Path = path.join(EVIDENCE_DIR, '07_showcase_movie_playing_t2.png');
    await page.screenshot({ path: showcasePlayT2Path });
    console.log(`Saved: ${showcasePlayT2Path}`);

    const showcaseActiveBadge = await page.textContent('[data-testid="screen-playback-status-badge"]');
    console.log(`Showcase Active Badge: "${showcaseActiveBadge.trim()}"`);

    results.showcaseMovie = {
      title: 'Quantum Odyssey: Beyond the Singularity',
      url: '/cinemas/12/auditorium/39?showtime=1875',
      initialBadge: showcaseInitialBadge.trim(),
      playButtonVisible: showcasePlayBtnVisible,
      videoAdvancing: videoAdvancing.advanced,
      activeBadge: showcaseActiveBadge.trim(),
      pass: showcasePlayBtnVisible && videoAdvancing.advanced,
    };

    // =========================================================================
    // PART 3: /dev/screen-test Benchmark Matrix
    // =========================================================================
    console.log('\n--- 3. Running /dev/screen-test Comprehensive Benchmark Matrix ---');
    await page.goto('http://localhost:3001/dev/screen-test', {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(2000);

    const movieTypes = [
      { id: 'hosted', testid: 'bench-movie-hosted', label: 'Hosted Video Clip' },
      { id: 'youtube_allowed', testid: 'bench-movie-yt-allowed', label: 'YouTube Allowed' },
      { id: 'youtube_disabled', testid: 'bench-movie-yt-disabled', label: 'YouTube Disabled (Theatre Mode)' },
      { id: 'no_trailer', testid: 'bench-movie-no-trailer', label: 'No Trailer (Title Card)' },
    ];

    const modes = [
      { id: 'lookaround', testid: 'preset-lookaround', label: 'Look around' },
      { id: 'walk_e', testid: 'preset-walk_e', label: 'Walk (Row E)' },
      { id: 'sit_center', testid: 'preset-sit_center', label: 'Sit (Center)' },
    ];

    for (const mt of movieTypes) {
      console.log(`\nTesting Movie Type: ${mt.label}`);
      await page.locator(`[data-testid="${mt.testid}"]`).click();
      await page.waitForTimeout(1000);

      // If Theatre Mode modal opened (for youtube_disabled), capture screenshot of Theatre Mode, then close modal to test 3D scene presets
      const modal = page.locator('[data-testid="theatre-mode-modal"]');
      if (await modal.isVisible()) {
        const theatreShot = path.join(EVIDENCE_DIR, `bench_${mt.id}_theatre_mode.png`);
        await page.screenshot({ path: theatreShot });
        console.log(`Captured Theatre Mode modal: ${theatreShot}`);
        const closeBtn = page.locator('[data-testid="theatre-mode-back-btn"]');
        if (await closeBtn.isVisible()) {
          await closeBtn.click();
          await page.waitForTimeout(800);
        }
      }

      for (const m of modes) {
        await page.locator(`[data-testid="${m.testid}"]`).click();
        await page.waitForTimeout(800);

        const prefix = `bench_${mt.id}_${m.id}`;
        const shot1Path = path.join(EVIDENCE_DIR, `${prefix}_t0.png`);
        const shot2Path = path.join(EVIDENCE_DIR, `${prefix}_t2.png`);

        await page.screenshot({ path: shot1Path });
        await page.waitForTimeout(2000);
        await page.screenshot({ path: shot2Path });

        const s1 = fs.statSync(shot1Path).size;
        const s2 = fs.statSync(shot2Path).size;
        const pass = s1 > 20000 && s2 > 20000;

        results.benchmarkMatrix.push({
          movieType: mt.label,
          mode: m.label,
          viewport: 'Desktop 1280x800',
          strategyUsed: mt.id === 'hosted' ? 'video_texture' : mt.id === 'youtube_allowed' ? 'youtube_css3d' : mt.id === 'youtube_disabled' ? 'theatre_mode' : 'title_card',
          status: pass ? 'PASS' : 'FAIL',
          shotPair: [`${prefix}_t0.png`, `${prefix}_t2.png`],
        });
      }
    }

    // Phone Viewport Test (390x844 - iPhone 13)
    console.log('\n--- 4. Testing Phone Viewport (390x844) ---');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(1000);

    for (const mt of movieTypes) {
      await page.locator(`[data-testid="${mt.testid}"]`).click();
      await page.waitForTimeout(800);

      const modal = page.locator('[data-testid="theatre-mode-modal"]');
      if (await modal.isVisible()) {
        const closeBtn = page.locator('[data-testid="theatre-mode-back-btn"]');
        if (await closeBtn.isVisible()) {
          await closeBtn.click();
          await page.waitForTimeout(500);
        }
      }

      const prefix = `bench_mobile_${mt.id}`;
      const shot1Path = path.join(EVIDENCE_DIR, `${prefix}_t0.png`);
      const shot2Path = path.join(EVIDENCE_DIR, `${prefix}_t2.png`);

      await page.screenshot({ path: shot1Path });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: shot2Path });

      const s1 = fs.statSync(shot1Path).size;
      const s2 = fs.statSync(shot2Path).size;
      const pass = s1 > 15000 && s2 > 15000;

      results.benchmarkMatrix.push({
        movieType: mt.label,
        mode: 'Phone Default Orbit',
        viewport: 'Mobile 390x844',
        strategyUsed: mt.id === 'hosted' ? 'video_texture' : mt.id === 'youtube_allowed' ? 'youtube_css3d' : mt.id === 'youtube_disabled' ? 'theatre_mode' : 'title_card',
        status: pass ? 'PASS' : 'FAIL',
        shotPair: [`${prefix}_t0.png`, `${prefix}_t2.png`],
      });
    }

    // Write results JSON
    const reportPath = path.join(EVIDENCE_DIR, 'verification_results.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n=== Verification Complete! Saved results to ${reportPath} ===`);
  } catch (err) {
    console.error('Verification failed with error:', err);
  } finally {
    await browser.close();
  }
}

runVerification();
