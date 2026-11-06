const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

async function runBenchmarkIteration(targetBaseUrl, iterationIndex, qualityMode = null) {
  console.log(`\n--- Running Benchmark Iteration ${iterationIndex + 1} (${qualityMode || 'default'}) against ${targetBaseUrl} ---`);

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      '--use-gl=angle',
      '--enable-webgl',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  // Set city selection and quality mode in storage
  await page.addInitScript((qMode) => {
    try {
      localStorage.setItem('cineverse_city_slug', 'bengaluru');
      localStorage.setItem('cineverse_city_name', 'Bengaluru');
      if (qMode) {
        localStorage.setItem('cineverse_quality_mode', qMode);
      }
    } catch (e) { }
  }, qualityMode);

  const startTime = Date.now();
  const targetUrl = `${targetBaseUrl}/cinemas/1/auditorium/1?showtime=1&mode=3d`;

  console.log(`Navigating to ${targetUrl}...`);
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
  const domContentLoadedTime = Date.now() - startTime;

  // Wait for 3D engine initialization
  await page.waitForFunction(() => !!window.__cineverse, { timeout: 35000 });
  const canvasInitTime = Date.now() - startTime;

  if (qualityMode) {
    await page.evaluate((q) => {
      window.__cineverse?.setQualityMode?.(q);
    }, qualityMode);
  }

  // Wait 1.5 seconds for model and shaders to settle
  await page.waitForTimeout(1500);

  // Setup performance observer and frame rate collector inside page
  await page.evaluate(() => {
    window.__perfBenchmark = {
      frameTimes: [],
      longTasks: [],
      active: false,
      lastTime: 0,
      rafId: null,
      observer: null,
    };

    if (window.PerformanceObserver) {
      try {
        const obs = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) {
              window.__perfBenchmark.longTasks.push({
                name: entry.name,
                duration: entry.duration,
                startTime: entry.startTime,
              });
            }
          }
        });
        obs.observe({ entryTypes: ['longtask'] });
        window.__perfBenchmark.observer = obs;
      } catch (e) { }
    }
  });

  // Start frame recording
  await page.evaluate(() => {
    const b = window.__perfBenchmark;
    b.active = true;
    b.lastTime = performance.now();
    function loop(now) {
      if (!b.active) return;
      const dt = now - b.lastTime;
      b.lastTime = now;
      if (dt > 0) b.frameTimes.push(dt);
      b.rafId = requestAnimationFrame(loop);
    }
    b.rafId = requestAnimationFrame(loop);
  });

  console.log('Executing Phase A: Seat hover sweeps across rows A to E (2.5s)...');
  await page.evaluate(async () => {
    const rows = ['A', 'B', 'C', 'D', 'E'];
    for (const row of rows) {
      for (let num = 1; num <= 10; num++) {
        const seatId = `${row}${String(num).padStart(2, '0')}`;
        window.__cineverse?.setHoveredSeat(seatId);
        await new Promise((r) => setTimeout(r, 40));
      }
    }
    window.__cineverse?.setHoveredSeat(null);
  });

  console.log('Executing Phase B: Camera viewpoint presets and orbit (3.0s)...');
  await page.evaluate(async () => {
    const presets = ['front', 'back', 'aerial', 'overview'];
    for (const p of presets) {
      window.__cineverse?.setCameraPreset(p);
      await new Promise((r) => setTimeout(r, 700));
    }
  });

  console.log('Executing Phase C: Walk mode navigation and aisle jumps (3.0s)...');
  await page.evaluate(async () => {
    window.__cineverse?.setMode('walk');
    await new Promise((r) => setTimeout(r, 600));
    const aisles = ['B', 'D', 'F', 'H', 'E'];
    for (const a of aisles) {
      window.__cineverse?.teleportToRow(a);
      await new Promise((r) => setTimeout(r, 450));
    }
  });

  console.log('Executing Phase D: Seated POV transitions and sightline checks (3.0s)...');
  await page.evaluate(async () => {
    window.__cineverse?.sitAt('E05');
    await new Promise((r) => setTimeout(r, 1200));
    window.__cineverse?.sitAt('E06');
    await new Promise((r) => setTimeout(r, 800));
    window.__cineverse?.sitAt('D05');
    await new Promise((r) => setTimeout(r, 800));
  });

  console.log('Executing Phase E: Cinema trailer playback and texture sampling (3.5s)...');
  await page.evaluate(async () => {
    const store = window.__cineverse?.getStore();
    if (store && !store.trailer?.isPlaying) {
      store.toggleTrailerPlay?.();
    }
    await new Promise((r) => setTimeout(r, 3500));
  });

  // Stop frame recording and collect metrics
  const results = await page.evaluate(() => {
    const b = window.__perfBenchmark;
    b.active = false;
    if (b.rafId) cancelAnimationFrame(b.rafId);
    if (b.observer) b.observer.disconnect();

    const state = window.__cineverse ? window.__cineverse.getState() : null;

    let gpuInfo = { unmaskedRenderer: 'Unknown', unmaskedVendor: 'Unknown' };
    try {
      const glCanvas = document.querySelector('canvas');
      if (glCanvas) {
        const gl = glCanvas.getContext('webgl2') || glCanvas.getContext('webgl');
        if (gl) {
          const dbg = gl.getExtension('WEBGL_debug_renderer_info');
          if (dbg) {
            gpuInfo.unmaskedRenderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);
            gpuInfo.unmaskedVendor = gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL);
          }
        }
      }
    } catch (e) { }

    const mem = (performance && performance.memory) ? {
      usedJSHeapMB: Math.round(performance.memory.usedJSHeapSize / (1024 * 1024) * 10) / 10,
      totalJSHeapMB: Math.round(performance.memory.totalJSHeapSize / (1024 * 1024) * 10) / 10,
    } : null;

    return {
      frameTimes: b.frameTimes,
      longTasks: b.longTasks,
      rendererInfo: state ? state.rendererInfo : null,
      gpuInfo,
      memory: mem,
    };
  });

  await browser.close();

  // Compute statistical percentiles
  const frames = results.frameTimes.filter((t) => t > 0);
  frames.sort((a, b) => a - b);

  const count = frames.length;
  const sum = frames.reduce((a, b) => a + b, 0);
  const avgFrameTime = count > 0 ? sum / count : 0;
  const avgFps = avgFrameTime > 0 ? 1000 / avgFrameTime : 0;

  const p50 = count > 0 ? frames[Math.floor(count * 0.50)] : 0;
  const p95 = count > 0 ? frames[Math.floor(count * 0.95)] : 0;
  const p99 = count > 0 ? frames[Math.floor(count * 0.99)] : 0;
  const maxFrameTime = count > 0 ? frames[count - 1] : 0;

  const longTasksCount = results.longTasks.length;
  const maxLongTaskMs = longTasksCount > 0 ? Math.max(...results.longTasks.map((t) => t.duration)) : 0;
  const totalBlockingTimeMs = results.longTasks.reduce((acc, t) => acc + (t.duration - 50), 0);

  return {
    iteration: iterationIndex + 1,
    domContentLoadedTimeMs: domContentLoadedTime,
    canvasInitTimeMs: canvasInitTime,
    totalFrames: count,
    avgFps: Math.round(avgFps * 10) / 10,
    p50Ms: Math.round(p50 * 100) / 100,
    p95Ms: Math.round(p95 * 100) / 100,
    p99Ms: Math.round(p99 * 100) / 100,
    maxFrameTimeMs: Math.round(maxFrameTime * 100) / 100,
    longTasksCount,
    maxLongTaskMs: Math.round(maxLongTaskMs * 10) / 10,
    totalBlockingTimeMs: Math.round(totalBlockingTimeMs * 10) / 10,
    drawCalls: results.rendererInfo?.calls ?? 0,
    triangles: results.rendererInfo?.triangles ?? 0,
    geometries: results.rendererInfo?.geometries ?? 0,
    textures: results.rendererInfo?.textures ?? 0,
    memory: results.memory,
    gpuInfo: results.gpuInfo,
  };
}

async function benchmarkServer(targetUrl, serverLabel, iterations = 2, qualityMode = null) {
  console.log(`\n===============================================================`);
  console.log(`BENCHMARKING: ${serverLabel} (${targetUrl}) [${qualityMode || 'default'}] - ${iterations} Iterations`);
  console.log(`===============================================================`);

  const runs = [];
  for (let i = 0; i < iterations; i++) {
    const run = await runBenchmarkIteration(targetUrl, i, qualityMode);
    runs.push(run);
    console.log(`Run ${i + 1} Result: Avg FPS=${run.avgFps}, p50=${run.p50Ms}ms, p95=${run.p95Ms}ms, p99=${run.p99Ms}ms, DrawCalls=${run.drawCalls}, Triangles=${run.triangles}`);
  }

  // Aggregate averages
  const avg = (fn) => Math.round((runs.reduce((s, r) => s + fn(r), 0) / runs.length) * 100) / 100;

  return {
    serverLabel,
    targetUrl,
    runs,
    summary: {
      avgFps: avg((r) => r.avgFps),
      p50Ms: avg((r) => r.p50Ms),
      p95Ms: avg((r) => r.p95Ms),
      p99Ms: avg((r) => r.p99Ms),
      maxFrameTimeMs: Math.max(...runs.map((r) => r.maxFrameTimeMs)),
      longTasksCount: avg((r) => r.longTasksCount),
      maxLongTaskMs: Math.max(...runs.map((r) => r.maxLongTaskMs)),
      totalBlockingTimeMs: avg((r) => r.totalBlockingTimeMs),
      canvasInitTimeMs: avg((r) => r.canvasInitTimeMs),
      domContentLoadedTimeMs: avg((r) => r.domContentLoadedTimeMs),
      drawCalls: Math.round(avg((r) => r.drawCalls)),
      triangles: Math.round(avg((r) => r.triangles)),
      geometries: Math.round(avg((r) => r.geometries)),
      textures: Math.round(avg((r) => r.textures)),
      usedJSHeapMB: runs[0].memory ? avg((r) => r.memory?.usedJSHeapMB || 0) : null,
      gpu: runs[0].gpuInfo,
    },
  };
}

module.exports = { benchmarkServer, runBenchmarkIteration };

if (require.main === module) {
  const target = process.argv[2] || 'http://localhost:3001';
  const label = process.argv[3] || 'Production_Build';
  const iters = parseInt(process.argv[4] || '2', 10);
  const qMode = process.argv[5] || null;

  benchmarkServer(target, label, iters, qMode)
    .then((result) => {
      console.log('\n[FINAL SUMMARY RESULT]');
      console.log(JSON.stringify(result.summary, null, 2));
      const outDir = path.join(__dirname, '../../docs/performance');
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(
        path.join(outDir, `${label.toLowerCase().replace(/[^a-z0-9]/g, '_')}_raw.json`),
        JSON.stringify(result, null, 2),
        'utf-8'
      );
    })
    .catch((err) => {
      console.error('Benchmark failed:', err);
      process.exit(1);
    });
}
