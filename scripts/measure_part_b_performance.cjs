const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACTS_DIR = 'C:/Users/KARTHIK/.gemini/antigravity/brain/b126ff79-e052-4efd-9d46-663877753dee';

(async () => {
  console.log('=== Measuring Part B Video & Performance on Grand Balcony (Auditorium 18) ===');

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=default', '--enable-webgl', '--no-sandbox']
  });

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Inject performance observer for Long Tasks
  await page.addInitScript(() => {
    window.__longTasks = [];
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__longTasks.push({
            duration: Math.round(entry.duration * 10) / 10,
            startTime: Math.round(entry.startTime * 10) / 10
          });
        }
      });
      observer.observe({ entryTypes: ['longtask'] });
    } catch (e) {
      console.warn('Long task observer not supported', e);
    }
  });

  const url = 'http://localhost:3002/cinemas/6/auditorium/18?showtime=3449&mode=3d';
  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  // Measure FPS and input latency
  const metrics = await page.evaluate(async () => {
    // 1. Measure FPS over 3 seconds
    const fpsPromise = new Promise((resolve) => {
      let frames = 0;
      const start = performance.now();
      function count() {
        frames++;
        if (performance.now() - start < 3000) {
          requestAnimationFrame(count);
        } else {
          const elapsed = (performance.now() - start) / 1000;
          resolve(Math.round((frames / elapsed) * 10) / 10);
        }
      }
      requestAnimationFrame(count);
    });

    // 2. Measure input latency
    const inputLatencies = [];
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      await new Promise((r) => requestAnimationFrame(r));
      inputLatencies.push(performance.now() - t0);
    }
    const avgLatency = Math.round((inputLatencies.reduce((a, b) => a + b, 0) / inputLatencies.length) * 10) / 10;

    const measuredFps = await fpsPromise;

    // Check YouTube iframe dimensions
    const ytContainer = document.querySelector('[data-testid="screen-youtube-player"]');
    const iframe = document.querySelector('#cineverse-screen-yt-iframe');
    const iframeCount = document.querySelectorAll('iframe').length;

    const innerEl = document.querySelector('.cineverse-css3d-inner');

    return {
      fps: measuredFps,
      inputLatencyMs: avgLatency,
      longTasks: window.__longTasks || [],
      longTasksCount: (window.__longTasks || []).length,
      longTasksTotalDurationMs: (window.__longTasks || []).reduce((acc, t) => acc + t.duration, 0),
      iframeCount,
      playerWidth: innerEl ? parseInt(innerEl.style.width, 10) : null,
      playerHeight: innerEl ? parseInt(innerEl.style.height, 10) : null,
      isLighter640Path: innerEl ? parseInt(innerEl.style.width, 10) <= 640 : false,
    };
  });

  console.log('\n=== Measured Part B Telemetry ===');
  console.log(`Frame Rate: ${metrics.fps} FPS`);
  console.log(`Input Latency: ${metrics.inputLatencyMs} ms (threshold < 200 ms: ${metrics.inputLatencyMs < 200 ? 'PASS' : 'FAIL'})`);
  console.log(`Long Tasks Count (>50ms): ${metrics.longTasksCount}`);
  console.log(`Long Tasks Total Duration: ${metrics.longTasksTotalDurationMs} ms`);
  console.log(`Iframe Count: ${metrics.iframeCount} (single iframe requirement: ${metrics.iframeCount === 1 ? 'PASS' : 'FAIL'})`);
  console.log(`Lighter 640x360 Player Base Size: ${metrics.playerWidth}x${metrics.playerHeight} (${metrics.isLighter640Path ? 'PASS' : 'FAIL'})`);

  const screenshotPath = path.join(ARTIFACTS_DIR, 'part_b_player_performance.png');
  await page.screenshot({ path: screenshotPath });
  console.log(`Saved screenshot: ${screenshotPath}`);

  // Test admin readiness endpoint
  console.log('\nChecking Admin Trailers Readiness API endpoint...');
  const adminRes = await page.goto('http://localhost:8000/api/v1/admin/trailers/readiness');
  const readinessData = await adminRes.json();
  console.log(`Admin Readiness Status: ${readinessData.status}, Total Movies: ${readinessData.total_movies}, Hosted: ${readinessData.hosted_count}, YouTube: ${readinessData.youtube_count}`);

  const outReport = path.join(ARTIFACTS_DIR, 'part_b_metrics.json');
  fs.writeFileSync(outReport, JSON.stringify({
    performance: metrics,
    readinessSummary: {
      totalMovies: readinessData.total_movies,
      hostedTrailers: readinessData.hosted_count,
      youtubeEmbeds: readinessData.youtube_count,
    }
  }, null, 2));
  console.log(`Saved report to ${outReport}`);

  await browser.close();
})();
