/**
 * profile_3d_performance.cjs
 * Headed Chrome Performance Profiling with CDP Tracing.
 * Evaluates loading, 10s idle, play click, and 20s playback on /cinemas/23/auditorium/74?showtime=2048&mode=3d
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/playwright'));

const TARGET_URL = process.env.TARGET_URL || 'http://localhost:3002/cinemas/23/auditorium/74?showtime=2048&mode=3d';
const OUTPUT_DIR = path.resolve(__dirname, '../evidence/perf-profile');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function runProfile(buildType = 'development', hasOtherTabs = false) {
  console.log(`\n================================================================`);
  console.log(` Starting Performance Profile: ${buildType.toUpperCase()} (Extra tabs: ${hasOtherTabs})`);
  console.log(` Target: ${TARGET_URL}`);
  console.log(`================================================================`);

  const browser = await chromium.launch({
    headless: false, // Headed Chrome with real GPU rendering
    args: [
      '--enable-gpu-rasterization',
      '--ignore-gpu-blocklist',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });

  // If testing with other tabs open
  let dummyTab1, dummyTab2;
  if (hasOtherTabs) {
    dummyTab1 = await context.newPage();
    await dummyTab1.goto('http://localhost:3002/');
    dummyTab2 = await context.newPage();
    await dummyTab2.goto('http://localhost:3002/cinemas');
  }

  const page = await context.newPage();

  // Attach CDP Session
  const client = await context.newCDPSession(page);
  await client.send('Performance.enable');

  // Start CDP Tracing
  console.log('[Profile] Starting CDP Tracing...');
  await client.send('Tracing.start', {
    categories: [
      'devtools.timeline',
      'v8',
      'blink.console',
      'toplevel',
      'blink.user_timing',
      'disabled-by-default-devtools.timeline',
      'disabled-by-default-devtools.timeline.frame',
      'disabled-by-default-v8.cpu_profiler',
    ].join(','),
    options: 'sampling-frequency=10000',
  });

  // Inject in-page performance observer for long tasks and INP
  await page.addInitScript(() => {
    window.__perfData = {
      longTasks: [],
      inputLatencies: [],
      fpsSamples: [],
      rafCount: 0,
      heapSnapshots: [],
      audioEvents: [],
    };

    // Long task observer
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__perfData.longTasks.push({
            startTime: entry.startTime,
            duration: entry.duration,
            name: entry.name,
          });
        }
      });
      observer.observe({ type: 'longtask', buffered: true });
    } catch (e) {}

    // Track audio elements and whether sound is playing
    const checkAudio = () => {
      const audios = Array.from(document.querySelectorAll('audio, video'));
      for (const el of audios) {
        const a = el;
        if (!a.muted && a.volume > 0 && !a.paused) {
          window.__perfData.audioEvents.push({
            time: performance.now(),
            tag: a.tagName,
            id: a.id || a.className,
            src: a.currentSrc || a.src,
            muted: a.muted,
            volume: a.volume,
            paused: a.paused,
          });
        }
      }
    };
    setInterval(checkAudio, 100);

    // RAF FPS monitor
    let lastTime = performance.now();
    let frameCount = 0;
    function countFrame(now) {
      window.__perfData.rafCount++;
      frameCount++;
      if (now - lastTime >= 1000) {
        const fps = Math.round((frameCount * 1000) / (now - lastTime));
        const heap = performance.memory ? performance.memory.usedJSHeapSize : 0;
        window.__perfData.fpsSamples.push(fps);
        window.__perfData.heapSnapshots.push({
          time: now,
          heapBytes: heap,
        });
        frameCount = 0;
        lastTime = now;
      }
      requestAnimationFrame(countFrame);
    }
    requestAnimationFrame(countFrame);

    // INP tracker
    window.addEventListener('click', (e) => {
      const start = performance.now();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const duration = performance.now() - start;
          window.__perfData.inputLatencies.push({
            time: start,
            duration,
            target: e.target ? e.target.tagName : 'unknown',
          });
        });
      });
    }, true);
  });

  const loadStartTime = Date.now();
  console.log(`[Profile] Navigating to ${TARGET_URL}...`);
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Wait for 3D canvas
  await page.waitForSelector('canvas', { timeout: 15000 });
  const loadEndTime = Date.now();
  const pageLoadMs = loadEndTime - loadStartTime;
  console.log(`[Profile] Page & Canvas loaded in ${pageLoadMs} ms`);

  // Inspect DOM media elements during loading
  const mediaBeforePlay = await page.evaluate(() => {
    const canvases = document.querySelectorAll('canvas').length;
    const iframes = Array.from(document.querySelectorAll('iframe')).map(f => ({
      id: f.id,
      src: f.src,
      visible: f.offsetWidth > 0,
    }));
    const videos = Array.from(document.querySelectorAll('video')).map(v => ({
      id: v.id,
      className: v.className,
      src: v.currentSrc || v.src,
      muted: v.muted,
      paused: v.paused,
      volume: v.volume,
    }));
    const bgBlur = document.querySelector('[data-testid="movie-backdrop-video"]') !== null;
    const imgBlur = Array.from(document.querySelectorAll('img')).some(i => (i.style.filter || '').includes('blur'));
    const statusText = document.querySelector('[data-testid="screen-playback-status-badge"]')?.textContent || '';

    return {
      canvases,
      iframes,
      videos,
      bgBlur,
      imgBlur,
      statusText,
      heapBytes: performance.memory ? performance.memory.usedJSHeapSize : 0,
    };
  });

  console.log(`[Profile] Media before play:`, JSON.stringify(mediaBeforePlay, null, 2));

  // 10 seconds before pressing Play
  console.log('[Profile] Monitoring 10 seconds before pressing Play...');
  await page.waitForTimeout(10000);

  const prePlayHeap = await page.evaluate(() => (performance.memory ? performance.memory.usedJSHeapSize : 0));
  const audioBeforePlay = await page.evaluate(() => window.__perfData.audioEvents);

  console.log(`[Profile] Audio events before play: ${audioBeforePlay.length}`);
  if (audioBeforePlay.length > 0) {
    console.warn(`[Profile] Audio detected before click:`, audioBeforePlay[0]);
  }

  // Press Play
  console.log('[Profile] Locating and pressing Play button...');
  const playBtn3D = page.locator('[data-testid="screen-3d-play-button"]').first();
  const playBtnHUD = page.locator('[data-testid="trailer-play-toggle"]').first();

  const playClickStart = Date.now();
  if (await playBtn3D.isVisible()) {
    await playBtn3D.click();
    console.log('[Profile] Clicked 3D on-screen play button');
  } else if (await playBtnHUD.isVisible()) {
    await playBtnHUD.click();
    console.log('[Profile] Clicked HUD play button');
  } else {
    // Canvas click fallback
    await page.mouse.click(720, 450);
    console.log('[Profile] Clicked center canvas');
  }
  const playClickDuration = Date.now() - playClickStart;

  // 20 seconds of playback
  console.log('[Profile] Monitoring 20 seconds of playback and measuring INP...');
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(5000);
    // Simulate user interaction click during playback to measure INP
    await page.mouse.click(100 + i * 50, 100);
  }

  // Collect final in-page metrics
  const finalMetrics = await page.evaluate(() => {
    const perf = window.__perfData;
    const canvases = document.querySelectorAll('canvas').length;
    const iframes = Array.from(document.querySelectorAll('iframe')).map(f => ({
      id: f.id,
      src: f.src,
      width: f.offsetWidth,
      height: f.offsetHeight,
    }));
    const videos = Array.from(document.querySelectorAll('video')).map(v => ({
      id: v.id,
      src: v.currentSrc || v.src,
      muted: v.muted,
      paused: v.paused,
      currentTime: v.currentTime,
    }));
    const statusText = document.querySelector('[data-testid="screen-playback-status-badge"]')?.textContent || '';
    const endHeap = performance.memory ? performance.memory.usedJSHeapSize : 0;

    return {
      perf,
      canvases,
      iframes,
      videos,
      statusText,
      endHeap,
    };
  });

  // Stop CDP Tracing and collect chunks
  console.log('[Profile] Stopping CDP Tracing...');
  const traceChunks = [];
  client.on('Tracing.dataCollected', (evt) => {
    traceChunks.push(...evt.value);
  });

  const tracePromise = new Promise((resolve) => {
    client.on('Tracing.tracingComplete', resolve);
  });

  await client.send('Tracing.end');
  await tracePromise;
  console.log(`[Profile] Trace collected with ${traceChunks.length} trace events.`);

  await browser.close();

  // Analyze Chrome Trace Events
  const traceFile = path.join(OUTPUT_DIR, `trace_${buildType}_${hasOtherTabs ? 'with_tabs' : 'single'}.json`);
  fs.writeFileSync(traceFile, JSON.stringify(traceChunks, null, 2));

  // Compute breakdown of top costs
  let scriptingUs = 0;
  let layoutUs = 0;
  let styleRecalcUs = 0;
  let paintUs = 0;
  let compositeUs = 0;
  let gpuRasterUs = 0;

  for (const ev of traceChunks) {
    const name = ev.name || '';
    const dur = ev.dur || 0; // microseconds
    if (name === 'EvaluateScript' || name === 'FunctionCall' || name === 'v8.compile' || name === 'v8.call') {
      scriptingUs += dur;
    } else if (name === 'Layout') {
      layoutUs += dur;
    } else if (name === 'UpdateLayoutTree' || name === 'RecalculateStyles') {
      styleRecalcUs += dur;
    } else if (name === 'Paint' || name === 'Rasterize' || name === 'PaintImage') {
      paintUs += dur;
    } else if (name === 'CompositeLayers') {
      compositeUs += dur;
    } else if (name.startsWith('RasterTask') || name.startsWith('Gpu') || name.includes('GLContext')) {
      gpuRasterUs += dur;
    }
  }

  const topCosts = [
    { category: 'Scripting (V8 / JS Execution)', timeMs: Math.round(scriptingUs / 1000) },
    { category: 'Style Recalculation (CSS)', timeMs: Math.round(styleRecalcUs / 1000) },
    { category: 'Layout Reflow', timeMs: Math.round(layoutUs / 1000) },
    { category: 'Paint & Rasterization', timeMs: Math.round(paintUs / 1000) },
    { category: 'Compositing Layers', timeMs: Math.round(compositeUs / 1000) },
    { category: 'GPU Tasks & WebGL Raster', timeMs: Math.round(gpuRasterUs / 1000) },
  ].sort((a, b) => b.timeMs - a.timeMs);

  const longTasks = finalMetrics.perf.longTasks;
  const longestTask = longTasks.reduce((max, t) => Math.max(max, t.duration), 0);
  const totalBlockingTime = longTasks.reduce((sum, t) => sum + Math.max(0, t.duration - 50), 0);

  const inpValues = finalMetrics.perf.inputLatencies.map(l => l.duration);
  const maxINP = inpValues.length > 0 ? Math.max(...inpValues) : playClickDuration;
  const avgFPS = finalMetrics.perf.fpsSamples.length > 0
    ? Math.round(finalMetrics.perf.fpsSamples.reduce((a, b) => a + b, 0) / finalMetrics.perf.fpsSamples.length)
    : 0;

  const startHeap = mediaBeforePlay.heapBytes || 1;
  const endHeap = finalMetrics.endHeap || 1;
  const heapGrowthPct = (((endHeap - startHeap) / startHeap) * 100).toFixed(1);

  const report = {
    buildType,
    hasOtherTabs,
    pageLoadMs,
    topCosts,
    longTasksCount: longTasks.length,
    longestTaskMs: Math.round(longestTask),
    mainThreadBlockingTimeMs: Math.round(totalBlockingTime),
    inputLatencyINPMs: Math.round(maxINP),
    avgFPS,
    fpsSamples: finalMetrics.perf.fpsSamples,
    canvasesCount: finalMetrics.canvases,
    iframesCount: finalMetrics.iframes.length,
    iframes: finalMetrics.iframes,
    videoElementsCount: finalMetrics.videos.length,
    videos: finalMetrics.videos,
    bgVideoRunning: mediaBeforePlay.bgBlur,
    bgBlurRunning: mediaBeforePlay.imgBlur,
    audioBeforePlayDetected: audioBeforePlay.length > 0,
    audioBeforePlayDetails: audioBeforePlay,
    statusBadgeText: finalMetrics.statusText,
    heapGrowthPct: `${heapGrowthPct}%`,
    startHeapMB: (startHeap / (1024 * 1024)).toFixed(1),
    endHeapMB: (endHeap / (1024 * 1024)).toFixed(1),
  };

  const reportFile = path.join(OUTPUT_DIR, `profile_${buildType}_${hasOtherTabs ? 'with_tabs' : 'single'}.json`);
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

  console.log(`[Profile] Report saved to ${reportFile}`);
  console.log(`[Profile] Summary: FPS: ${avgFPS}, Long tasks: ${longTasks.length} (longest ${Math.round(longestTask)}ms), INP: ${Math.round(maxINP)}ms, Iframes: ${finalMetrics.iframes.length}, Videos: ${finalMetrics.videos.length}`);
  return report;
}

async function main() {
  const prodSingle = await runProfile('production', false);
  const prodWithTabs = await runProfile('production', true);

  console.log('\n--- PRODUCTION PROFILES COMPLETED ---');
}

main().catch((err) => {
  console.error('[Profile] Error:', err);
  process.exit(1);
});
