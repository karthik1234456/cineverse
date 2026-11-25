const { chromium } = require('d:/projects/CineVerse/frontend/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const ORIGIN = 'http://localhost:3002';
const EVIDENCE_DIR = path.resolve('evidence/ui-verification');
if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

const TARGET_URL = `${ORIGIN}/cinemas/12/auditorium/39?showtime=1875&mode=3d`;
const EXPECTED_SEATS = 522;
const ITERATIONS = 50;

(async () => {
  console.log('==============================================================');
  console.log(` TASK 5: 522-SEAT LARGE HALL MODE SWITCH & INTEGRITY BENCHMARK`);
  console.log(` Target: ${EXPECTED_SEATS} seats drawn across ${ITERATIONS} cycles + WebGL Loss/Restore`);
  console.log('==============================================================');

  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
    args: ['--enable-webgl', '--use-gl=angle']
  });

  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  await page.addInitScript(() => {
    localStorage.setItem('cineverse_city', 'bengaluru');
    localStorage.setItem('cineverse_city_id', '1');
    localStorage.setItem('cineverse_city_name', 'Bengaluru');
    localStorage.setItem('cineverse_city_modal_dismissed', 'true');
  });

  console.log(`Navigating to 522-seat hall: ${TARGET_URL}...`);
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 20000 });
  await page.waitForTimeout(3000);

  // Initial verification
  let initialCount = await page.evaluate(() => window.__cineverse?.getDrawnSeatCount?.() || 0);
  console.log(`Initial 3D seat instances drawn: ${initialCount} / ${EXPECTED_SEATS}`);
  if (initialCount !== EXPECTED_SEATS) {
    // Retry once if initialization is in flight
    await page.waitForTimeout(2000);
    initialCount = await page.evaluate(() => window.__cineverse?.getDrawnSeatCount?.() || 0);
  }
  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'missing_seats_initial_3d.png') });

  const loopRecords = [];
  let failures = 0;

  console.log(`\nBeginning ${ITERATIONS}-cycle 2D/3D toggle stress test...`);
  for (let i = 1; i <= ITERATIONS; i++) {
    // Switch to 2D
    const to2dBtn = page.locator('button:has-text("2D Map"), button[title*="2D"], [data-testid="mode-toggle-2d"]');
    if (await to2dBtn.first().isVisible()) {
      await to2dBtn.first().click();
    } else {
      await page.evaluate(() => window.useCinemaStore?.getState?.().setViewMode?.('2d'));
    }
    await page.waitForTimeout(200);

    // Switch back to 3D
    const to3dBtn = page.locator('button:has-text("3D View"), [data-testid="explore-in-3d-button"], [data-testid="mode-toggle-3d"]');
    if (await to3dBtn.first().isVisible()) {
      await to3dBtn.first().click();
    } else {
      await page.evaluate(() => window.useCinemaStore?.getState?.().setViewMode?.('3d'));
    }
    
    // Wait for canvas ready and inspect instance count
    await page.waitForSelector('canvas', { timeout: 5000 });
    await page.waitForTimeout(350);

    const count = await page.evaluate(() => window.__cineverse?.getDrawnSeatCount?.() || 0);
    const passed = (count === EXPECTED_SEATS);

    loopRecords.push({
      iteration: i,
      drawnCount: count,
      expected: EXPECTED_SEATS,
      passed
    });

    if (!passed) {
      failures++;
      console.error(`  FAIL at iteration ${i}: drawn = ${count}, expected = ${EXPECTED_SEATS}`);
    } else if (i % 10 === 0 || i === 1) {
      console.log(`  Cycle ${i}/${ITERATIONS}: ${count}/${EXPECTED_SEATS} seats drawn (100% intact)`);
    }
  }

  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'missing_seats_after_50_cycles.png') });

  // WebGL Context Loss and Recovery Test
  console.log('\n--- Testing WebGL Context Loss and Automatic Recovery ---');
  const contextLossTriggered = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return false;
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return false;
    const ext = gl.getExtension('WEBGL_lose_context');
    if (!ext) return false;
    window.__loseContextExt = ext;
    ext.loseContext();
    return true;
  });

  console.log(`WebGL context loss simulated: ${contextLossTriggered}`);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'missing_seats_context_lost.png') });

  const countDuringLoss = await page.evaluate(() => window.__cineverse?.getDrawnSeatCount?.() || 0);
  console.log(`Seats drawn during context loss: ${countDuringLoss}`);

  console.log('Triggering WebGL context restore...');
  const contextRestored = await page.evaluate(() => {
    if (window.__loseContextExt) {
      window.__loseContextExt.restoreContext();
      return true;
    }
    return false;
  });
  console.log(`WebGL context restore dispatched: ${contextRestored}`);
  await page.waitForTimeout(2500);

  const countAfterRestore = await page.evaluate(() => window.__cineverse?.getDrawnSeatCount?.() || 0);
  console.log(`Seats drawn after context restoration: ${countAfterRestore} / ${EXPECTED_SEATS}`);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'missing_seats_context_recovered.png') });

  const report = {
    test: 'Task 5: 522-Seat Hall Instance Stability & WebGL Recovery Benchmark',
    executedAt: new Date().toISOString(),
    hall: 'Screen 1 — Big Hall Flagship (Auditorium 39, Showtime 1875)',
    expectedSeats: EXPECTED_SEATS,
    totalCycles: ITERATIONS,
    failures,
    allCyclesPassed: failures === 0,
    contextLossTest: {
      lossTriggered: contextLossTriggered,
      countDuringLoss,
      restoreTriggered: contextRestored,
      countAfterRestore,
      restorationPassed: countAfterRestore === EXPECTED_SEATS
    },
    loopRecordsSample: loopRecords.filter((_, idx) => idx % 5 === 0 || !_.passed)
  };

  fs.writeFileSync(path.join(EVIDENCE_DIR, 'missing_seats_verification_results.json'), JSON.stringify(report, null, 2));
  console.log(`\nTASK 5 VERIFICATION COMPLETE: ALL CYCLES PASSED = ${failures === 0}, RECOVERY PASSED = ${countAfterRestore === EXPECTED_SEATS}`);

  await browser.close();
})();
