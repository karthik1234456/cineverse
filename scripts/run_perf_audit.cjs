/**
 * run_perf_audit.cjs
 * Comprehensive Performance Profile Audit:
 * Measures Cold & Warm starts on production build (port 3002)
 * With and Without 4x CPU throttling in headed Chrome with hardware WebGL.
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/@playwright/test'));

const EVIDENCE_DIR = path.resolve('evidence/perf-profile');
if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

const TARGET_URL = 'http://localhost:3002/cinemas/23/auditorium/74?showtime=2048&mode=3d';

async function profileRun({ isCold, cpuThrottleRate, label }) {
  console.log(`\n============================================================`);
  console.log(` [BENCHMARK] Running ${label} (Cold=${isCold}, CPU Throttling=${cpuThrottleRate}x)`);
  console.log(`============================================================`);

  const browser = await chromium.launch({
    headless: false,
    args: [
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--use-gl=angle',
      '--enable-gpu-rasterization',
      '--js-flags=--expose-gc',
      '--no-sandbox',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    serviceWorkers: 'block',
  });

  const page = await context.newPage();
  const client = await context.newCDPSession(page);

  if (isCold) {
    await client.send('Network.enable');
    await client.send('Network.clearBrowserCache');
    await client.send('Network.clearBrowserCookies');
    await client.send('Network.setCacheDisabled', { cacheDisabled: true });
  }

  if (cpuThrottleRate > 1) {
    await client.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottleRate });
  }

  // Setup CDP Tracing
  const traceEvents = [];
  client.on('Tracing.dataCollected', (data) => {
    if (data.value) traceEvents.push(...data.value);
  });

  await client.send('Tracing.start', {
    traceConfig: {
      includedCategories: [
        'devtools.timeline',
        'v8',
        'v8.compile',
        'toplevel',
        'blink.user_timing',
        'benchmark',
        'disabled-by-default-devtools.timeline',
      ],
    },
  });

  const tStart = performance.now();
  console.log(`[Trace] Navigating to ${TARGET_URL}...`);
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Check how fast loading skeleton appears
  const loadingVisibleAt = await page.evaluate(() => {
    const start = performance.now();
    const hasLoader = !!document.querySelector('.animate-ping') || !!document.querySelector('canvas');
    return { hasLoader, time: performance.now() - start };
  });

  // Wait for canvas or 3D scene to mount
  try {
    await page.waitForSelector('canvas', { timeout: 15000 });
  } catch (e) {
    console.warn('[Trace] Canvas wait timeout');
  }

  const interactiveTime = performance.now() - tStart;
  console.log(`[Trace] Interactive at ${interactiveTime.toFixed(1)} ms`);

  // Wait 5 seconds after navigation to capture the initial 5-second window
  const wait5s = Math.max(0, 5000 - (performance.now() - tStart));
  if (wait5s > 0) {
    await page.waitForTimeout(wait5s);
  }

  // Play trailer if available
  const playButton = page.locator('[data-testid="screen-3d-play-button"], [data-testid="screen-play-trailer-btn"]').first();
  const canPlay = await playButton.isVisible({ timeout: 2000 }).catch(() => false);
  let playClickTime = 0;
  let firstAdvanceTime = 0;

  if (canPlay) {
    console.log('[Trace] Clicking Play trailer button...');
    playClickTime = performance.now();
    await playButton.click({ force: true });

    // Sample video playback advance for 5 seconds
    const advanceResult = await page.evaluate(async () => {
      const t0 = performance.now();
      let lastTime = 0;
      let advancingAt = 0;
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 100));
        const yt = window.__cineverse_yt_player;
        const vid = window.__cineverse_video;
        const cur = (yt && typeof yt.getCurrentTime === 'function' ? yt.getCurrentTime() : 0) || (vid ? vid.currentTime : 0);
        if (cur > 0 && cur > lastTime && advancingAt === 0) {
          advancingAt = performance.now() - t0;
          break;
        }
        lastTime = cur;
      }
      return advancingAt;
    });
    firstAdvanceTime = advanceResult;
    console.log(`[Trace] First advancing frame at ${firstAdvanceTime.toFixed(1)} ms after click`);
  }

  // Measure FPS during 5 seconds of playback
  const fpsData = await page.evaluate(async () => {
    let frames = 0;
    const t0 = performance.now();
    return new Promise((resolve) => {
      function loop() {
        frames++;
        if (performance.now() - t0 < 3000) {
          requestAnimationFrame(loop);
        } else {
          resolve(frames / ((performance.now() - t0) / 1000));
        }
      }
      requestAnimationFrame(loop);
    });
  });
  console.log(`[Trace] Measured FPS: ${fpsData.toFixed(1)}`);

  // Stop Tracing
  const tracingCompletePromise = new Promise((resolve) => client.once('Tracing.tracingComplete', resolve));
  await client.send('Tracing.end');
  await tracingCompletePromise;

  const tracePath = path.join(EVIDENCE_DIR, `trace_${label.toLowerCase().replace(/[^a-z0-9]/g, '_')}.json`);
  fs.writeFileSync(tracePath, JSON.stringify(traceEvents, null, 2));
  console.log(`[Trace] Saved trace with ${traceEvents.length} events to ${tracePath}`);

  // Analyze events in first 5 seconds
  const firstEventTs = traceEvents.find((e) => e.name === 'navigationStart' || e.name === 'ResourceSendRequest')?.ts || traceEvents[0]?.ts || 0;
  const fiveSecLimitUs = firstEventTs + 5000000;

  let longTasksCount = 0;
  let longestTaskDur = 0;
  let mainThreadBlockingUs = 0;
  let scriptingUs = 0;
  let layoutUs = 0;
  let styleRecalcUs = 0;
  let paintUs = 0;
  let compositingUs = 0;
  let gpuRasterUs = 0;

  for (const e of traceEvents) {
    if (!e.dur) continue;
    const durMs = e.dur / 1000;

    // Check if within first 5 seconds
    const inFirst5s = e.ts <= fiveSecLimitUs;

    if (e.name === 'RunTask' && inFirst5s) {
      if (durMs > 50) {
        longTasksCount++;
        mainThreadBlockingUs += (e.dur - 50000);
      }
      if (durMs > longestTaskDur) {
        longestTaskDur = durMs;
      }
    }

    if (e.name === 'EvaluateScript' || e.name === 'v8.callFunction' || e.name === 'FunctionCall') {
      scriptingUs += e.dur;
    } else if (e.name === 'Layout') {
      layoutUs += e.dur;
    } else if (e.name === 'UpdateLayoutTree') {
      styleRecalcUs += e.dur;
    } else if (e.name === 'Paint') {
      paintUs += e.dur;
    } else if (e.name === 'CompositeLayers') {
      compositingUs += e.dur;
    } else if (e.name === 'RasterTask') {
      gpuRasterUs += e.dur;
    }
  }

  await browser.close();

  const result = {
    label,
    isCold,
    cpuThrottleRate,
    interactiveTimeMs: Math.round(interactiveTime),
    longTasksCountFirst5s: longTasksCount,
    longestTaskDurMs: Math.round(longestTaskDur),
    mainThreadBlockingMs: Math.round(mainThreadBlockingUs / 1000),
    scriptingMs: Math.round(scriptingUs / 1000),
    layoutMs: Math.round(layoutUs / 1000),
    styleRecalcMs: Math.round(styleRecalcUs / 1000),
    paintMs: Math.round(paintUs / 1000),
    gpuRasterMs: Math.round(gpuRasterUs / 1000),
    fps: Math.round(fpsData),
    firstAdvanceTimeMs: Math.round(firstAdvanceTime),
    budgets: {
      longestTaskTarget: '< 200 ms',
      longestTaskPass: longestTaskDur <= 200,
      longTasksCountTarget: '<= 3 in first 5s',
      longTasksCountPass: longTasksCount <= 3,
      interactiveTarget: '< 2000 ms',
      interactivePass: interactiveTime < 2000,
      fpsTarget: '>= 60 FPS',
      fpsPass: fpsData >= 55,
    },
  };

  console.log(`[Result] ${label}:`);
  console.log(`  Interactive: ${result.interactiveTimeMs} ms (Pass: ${result.budgets.interactivePass})`);
  console.log(`  Long Tasks First 5s: ${result.longTasksCountFirst5s} (Pass: ${result.budgets.longTasksCountPass})`);
  console.log(`  Longest Task: ${result.longestTaskDurMs} ms (Pass: ${result.budgets.longestTaskPass})`);
  console.log(`  FPS: ${result.fps} (Pass: ${result.budgets.fpsPass})`);
  console.log(`  Click to advance: ${result.firstAdvanceTimeMs} ms`);

  return result;
}

async function main() {
  const runs = [
    { isCold: true, cpuThrottleRate: 1, label: 'Production Cold Load (1x)' },
    { isCold: false, cpuThrottleRate: 1, label: 'Production Warm Load (1x)' },
    { isCold: true, cpuThrottleRate: 4, label: 'Production Cold Load (4x Throttle)' },
    { isCold: false, cpuThrottleRate: 4, label: 'Production Warm Load (4x Throttle)' },
  ];

  const results = [];
  for (const r of runs) {
    try {
      const res = await profileRun(r);
      results.push(res);
    } catch (err) {
      console.error(`Error in run ${r.label}:`, err);
    }
  }

  const outPath = path.join(EVIDENCE_DIR, 'perf_audit_results.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\n============================================================`);
  console.log(`All runs complete! Results saved to ${outPath}`);
  console.log(`============================================================`);
}

main().catch(console.error);
