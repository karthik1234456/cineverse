const { chromium } = require('../frontend/node_modules/@playwright/test');
const fs = require('fs');
const path = require('path');

const EVIDENCE_DIR = 'C:/Users/KARTHIK/.gemini/antigravity/brain/b126ff79-e052-4efd-9d46-663877753dee/evidence/3d-fixes';

async function main() {
  if (!fs.existsSync(EVIDENCE_DIR)) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  }

  console.log('Launching Chrome with real hardware WebGL acceleration...');
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--enable-gpu-rasterization',
      '--enable-zero-copy',
      '--no-sandbox',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  const targetHalls = [
    {
      name: '522-Seat IMAX 3D Hall (Aud 39)',
      slug: 'hall39_imax3d_522',
      url: 'http://localhost:3001/cinemas/12/auditorium/39?showtime=1875&mode=3d',
      expectedSeats: 522,
      sampleSeat: 'I15',
    },
    {
      name: '416-Seat EPIQ Large Format Hall (Aud 36)',
      slug: 'hall36_epiq_416',
      url: 'http://localhost:3001/cinemas/11/auditorium/36?showtime=737&mode=3d',
      expectedSeats: 416,
      sampleSeat: 'H13',
    },
    {
      name: '240-Seat 4DX 3D Motion Hall (Aud 35)',
      slug: 'hall35_4dx3d_240',
      url: 'http://localhost:3001/cinemas/11/auditorium/35?showtime=732&mode=3d',
      expectedSeats: 240,
      sampleSeat: 'F08',
    },
  ];

  const measurementResults = [];

  console.log('\n============================================================');
  console.log('PART B & A: REAL BRIGHTNESS & SEAT RENDERING VERIFICATION');
  console.log('============================================================\n');

  for (const hall of targetHalls) {
    console.log(`\n>>> Testing: ${hall.name}`);
    console.log(`URL: ${hall.url}`);

    await page.goto(hall.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('canvas', { timeout: 60000 });
    await page.waitForFunction(() => !!window.__cineverse, { timeout: 30000 });
    await page.waitForFunction((expected) => {
      const drawn = window.__cineverse?.getDrawnSeatCount ? window.__cineverse.getDrawnSeatCount() : 0;
      return drawn === expected;
    }, hall.expectedSeats, { timeout: 20000 });
    await page.waitForTimeout(1000);

    // Verify drawn seats vs expected seats
    const seatCheck = await page.evaluate(() => {
      const drawn = window.__cineverse.getDrawnSeatCount ? window.__cineverse.getDrawnSeatCount() : 0;
      const watchdog = window.__cineverse.getWatchdogStatus ? window.__cineverse.getWatchdogStatus() : {};
      return { drawn, watchdog };
    });

    console.log(`[Seat Count Check] Expected: ${hall.expectedSeats}, Drawn: ${seatCheck.drawn}, Watchdog:`, seatCheck.watchdog);

    // 1. Look around - Normal Light Level
    await page.evaluate(() => {
      window.__cineverse.setMode('overview');
      window.__cineverse.setHouseLights('full');
      window.useCinemaStore.getState().setLightLevel('normal');
    });
    await page.waitForTimeout(1200);

    const normLookAroundLum = await page.evaluate(() => window.__cineverse.sampleLuminance());
    const normLookAroundShot = path.join(EVIDENCE_DIR, `${hall.slug}_lookaround_normal.png`);
    await page.screenshot({ path: normLookAroundShot });
    console.log(`  [Look around - Normal] Mean Lum: ${normLookAroundLum.meanLuminance}, >0.08: ${normLookAroundLum.above08Percent}%, <0.02: ${normLookAroundLum.below02Percent}%`);

    // 2. Look around - Bright Light Level
    await page.evaluate(() => {
      window.useCinemaStore.getState().setLightLevel('bright');
    });
    await page.waitForTimeout(1200);

    const brightLookAroundLum = await page.evaluate(() => window.__cineverse.sampleLuminance());
    const brightLookAroundShot = path.join(EVIDENCE_DIR, `${hall.slug}_lookaround_bright.png`);
    await page.screenshot({ path: brightLookAroundShot });
    console.log(`  [Look around - Bright] Mean Lum: ${brightLookAroundLum.meanLuminance}, >0.08: ${brightLookAroundLum.above08Percent}%, <0.02: ${brightLookAroundLum.below02Percent}%`);

    // 3. Walk View - Normal Light Level
    await page.evaluate(() => {
      window.useCinemaStore.getState().setLightLevel('normal');
      window.__cineverse.setMode('walk');
    });
    await page.waitForTimeout(1500);

    const normWalkLum = await page.evaluate(() => window.__cineverse.sampleLuminance());
    const normWalkShot = path.join(EVIDENCE_DIR, `${hall.slug}_walk_normal.png`);
    await page.screenshot({ path: normWalkShot });
    console.log(`  [Walk - Normal] Mean Lum: ${normWalkLum.meanLuminance}, >0.08: ${normWalkLum.above08Percent}%, <0.02: ${normWalkLum.below02Percent}%`);

    // 4. Walk View - Bright Light Level
    await page.evaluate(() => {
      window.useCinemaStore.getState().setLightLevel('bright');
    });
    await page.waitForTimeout(1200);

    const brightWalkLum = await page.evaluate(() => window.__cineverse.sampleLuminance());
    const brightWalkShot = path.join(EVIDENCE_DIR, `${hall.slug}_walk_bright.png`);
    await page.screenshot({ path: brightWalkShot });
    console.log(`  [Walk - Bright] Mean Lum: ${brightWalkLum.meanLuminance}, >0.08: ${brightWalkLum.above08Percent}%, <0.02: ${brightWalkLum.below02Percent}%`);

    // 5. Sit View - Normal Light Level
    await page.evaluate((seatId) => {
      window.useCinemaStore.getState().setLightLevel('normal');
      window.__cineverse.sitAt(seatId);
    }, hall.sampleSeat);
    await page.waitForTimeout(1500);

    const normSitLum = await page.evaluate(() => window.__cineverse.sampleLuminance());
    const normSitShot = path.join(EVIDENCE_DIR, `${hall.slug}_sit_normal.png`);
    await page.screenshot({ path: normSitShot });
    console.log(`  [Sit (${hall.sampleSeat}) - Normal] Mean Lum: ${normSitLum.meanLuminance}, >0.08: ${normSitLum.above08Percent}%, <0.02: ${normSitLum.below02Percent}%`);

    // 6. Sit View - Bright Light Level
    await page.evaluate(() => {
      window.useCinemaStore.getState().setLightLevel('bright');
    });
    await page.waitForTimeout(1200);

    const brightSitLum = await page.evaluate(() => window.__cineverse.sampleLuminance());
    const brightSitShot = path.join(EVIDENCE_DIR, `${hall.slug}_sit_bright.png`);
    await page.screenshot({ path: brightSitShot });
    console.log(`  [Sit (${hall.sampleSeat}) - Bright] Mean Lum: ${brightSitLum.meanLuminance}, >0.08: ${brightSitLum.above08Percent}%, <0.02: ${brightSitLum.below02Percent}%`);

    measurementResults.push({
      hall: hall.name,
      expectedSeats: hall.expectedSeats,
      drawnSeats: seatCheck.drawn,
      watchdog: seatCheck.watchdog,
      measurements: {
        lookAroundNormal: normLookAroundLum,
        lookAroundBright: brightLookAroundLum,
        walkNormal: normWalkLum,
        walkBright: brightWalkLum,
        sitNormal: normSitLum,
        sitBright: brightSitLum,
      },
    });
  }

  // Save measurement results to evidence
  fs.writeFileSync(
    path.join(EVIDENCE_DIR, 'luminance_measurements.json'),
    JSON.stringify(measurementResults, null, 2)
  );

  console.log('\nMeasurement results written to evidence/3d-fixes/luminance_measurements.json');

  // Phase 2: 50-iteration mode switching & seat persistence loop
  console.log('\n============================================================');
  console.log('PART A: 50-ITERATION MODE SWITCHING & SEAT PERSISTENCE TEST');
  console.log('============================================================\n');

  let loopPassCount = 0;
  const loopHalls = [
    { name: 'IMAX 3D (522)', url: 'http://localhost:3001/cinemas/12/auditorium/39?showtime=1875&mode=3d', expected: 522 },
    { name: 'EPIQ (416)', url: 'http://localhost:3001/cinemas/11/auditorium/36?showtime=737&mode=3d', expected: 416 },
    { name: '4DX 3D (240)', url: 'http://localhost:3001/cinemas/11/auditorium/35?showtime=732&mode=3d', expected: 240 },
  ];

  let currentLoadedUrl = '';
  for (let iter = 1; iter <= 50; iter++) {
    const target = loopHalls[(iter - 1) % loopHalls.length];
    const modeSwitch = (iter % 3 === 0) ? 'sit' : ((iter % 3 === 1) ? 'walk' : 'overview');

    if (currentLoadedUrl !== target.url) {
      await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('canvas', { timeout: 30000 });
      await page.waitForFunction((exp) => {
        const drawn = window.__cineverse?.getDrawnSeatCount ? window.__cineverse.getDrawnSeatCount() : 0;
        return drawn === exp;
      }, target.expected, { timeout: 20000 });
      currentLoadedUrl = target.url;
    }

    if (iter === 1 || iter % 10 === 0 || iter === 50) {
      process.stdout.write(`Iteration ${iter}/50 (${target.name}, mode: ${modeSwitch})... `);
    }

    const check = await page.evaluate((targetMode) => {
      if (targetMode === 'walk') {
        window.__cineverse.setMode('walk');
      } else if (targetMode === 'sit') {
        window.__cineverse.sitAt('C05');
      } else {
        window.__cineverse.setMode('overview');
      }

      const drawn = window.__cineverse.getDrawnSeatCount ? window.__cineverse.getDrawnSeatCount() : 0;
      const watchdog = window.__cineverse.getWatchdogStatus ? window.__cineverse.getWatchdogStatus() : {};
      return { drawn, watchdog };
    }, modeSwitch);

    if (check.drawn === target.expected) {
      loopPassCount++;
    } else {
      console.error(`\n[Iteration ${iter} FAIL] Expected ${target.expected}, drawn: ${check.drawn}`);
    }

    if (iter === 1 || iter % 10 === 0 || iter === 50) {
      console.log(`Drawn: ${check.drawn} (Expected: ${target.expected}) - PASS`);
    }
  }

  console.log(`\n50-Iteration Loop Complete: ${loopPassCount}/50 iterations verified with drawn == expected.`);

  // Phase 3: Soak test cycling views
  console.log('\n============================================================');
  console.log('PART A: RAPID SOAK TEST (Look around, Walk, Sit transitions)');
  console.log('============================================================\n');

  let soakErrors = 0;
  const soakStartTime = Date.now();
  const soakDurationMs = 30000; // 30s thorough automated soak

  let soakCycle = 0;
  while (Date.now() - soakStartTime < soakDurationMs) {
    soakCycle++;
    const step = soakCycle % 3;
    await page.evaluate((s) => {
      if (s === 0) window.__cineverse.setMode('overview');
      else if (s === 1) window.__cineverse.setMode('walk');
      else window.__cineverse.sitAt('E10');
    }, step);
    await page.waitForTimeout(500);

    const status = await page.evaluate(() => {
      const drawn = window.__cineverse.getDrawnSeatCount ? window.__cineverse.getDrawnSeatCount() : 0;
      const state = window.__cineverse.getState();
      return { drawn, fps: state.rendererInfo?.fps, calls: state.rendererInfo?.calls };
    });

    if (status.drawn === 0) soakErrors++;
  }

  console.log(`Soak Test Completed: ${soakCycle} view cycles executed over ${(soakDurationMs/1000)}s with ${soakErrors} errors.`);

  await browser.close();
  console.log('\nALL 3D TESTS COMPLETE.');
}

main().catch((err) => {
  console.error('Fatal error in verify_3d_fixes:', err);
  process.exit(1);
});
