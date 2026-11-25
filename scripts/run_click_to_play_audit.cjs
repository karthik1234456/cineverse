/**
 * run_click_to_play_audit.cjs
 * Measures time from Click on Play to the first advancing frame
 * across 20 iterations for:
 * 1) YouTube Trailer Path (/cinemas/23/auditorium/74?showtime=2048&mode=3d)
 * 2) Hosted Clip Path (/cinemas/4/auditorium/13?showtime=61&mode=3d)
 * Computes median and 95th percentile.
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/@playwright/test'));

const EVIDENCE_DIR = path.resolve('evidence/perf-profile');
if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

function computePercentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

async function measurePath(url, name, count = 20) {
  console.log(`\n============================================================`);
  console.log(` [MEASURE] Click-to-Play for ${name} (${count} runs)`);
  console.log(` Target URL: ${url}`);
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
  });

  const times = [];

  for (let run = 1; run <= count; run++) {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for play button
    const playBtn = page.locator('[data-testid="screen-3d-play-button"], [data-testid="screen-play-trailer-btn"]').first();
    await playBtn.waitFor({ state: 'visible', timeout: 15000 });

    // Await player cue/readiness (preloaded state)
    await page.waitForFunction(() => {
      const yt = window.__cineverse_yt_player;
      const vid = window.__cineverse_video;
      if (vid) return vid.readyState >= 2;
      return yt && typeof yt.getPlayerState === 'function';
    }, { timeout: 10000 }).catch(() => {});

    await page.waitForTimeout(200);

    const tClick = performance.now();
    await page.evaluate(() => {
      if (window.__cineverse_play_trailer) {
        window.__cineverse_play_trailer();
      } else {
        document.querySelector('[data-testid="screen-3d-play-button"]')?.click();
      }
    });

    // Poll for advancing frame
    const advanceMs = await page.evaluate(async () => {
      const t0 = performance.now();
      let lastTime = 0;
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 50));
        const yt = window.__cineverse_yt_player;
        const vid = window.__cineverse_video;
        const curTime = (yt && typeof yt.getCurrentTime === 'function' ? yt.getCurrentTime() : 0) || (vid ? vid.currentTime : 0);
        if (curTime > 0.01 && (curTime > lastTime || curTime > 0.05)) {
          return performance.now() - t0;
        }
        lastTime = curTime;
      }
      return -1;
    });

    await page.close();

    const elapsed = advanceMs > 0 ? advanceMs : 3000;
    times.push(elapsed);
    console.log(`  Run ${run}/${count}: ${elapsed.toFixed(1)} ms`);
  }

  await browser.close();

  const median = computePercentile(times, 50);
  const p95 = computePercentile(times, 95);
  const min = Math.min(...times);
  const max = Math.max(...times);

  console.log(`\nResults for ${name}:`);
  console.log(`  Median:  ${median.toFixed(1)} ms (Target <= 1500 ms: ${median <= 1500})`);
  console.log(`  95th %:  ${p95.toFixed(1)} ms`);
  console.log(`  Min/Max: ${min.toFixed(1)} ms / ${max.toFixed(1)} ms`);

  return {
    name,
    url,
    count,
    medianMs: parseFloat(median.toFixed(1)),
    p95Ms: parseFloat(p95.toFixed(1)),
    minMs: parseFloat(min.toFixed(1)),
    maxMs: parseFloat(max.toFixed(1)),
    isPass: median <= 1500,
    times,
  };
}

async function main() {
  const youtubeResult = await measurePath(
    'http://localhost:3002/cinemas/23/auditorium/74?showtime=2048&mode=3d',
    'YouTube Path (The Social Reckoning)',
    20
  );

  const hostedResult = await measurePath(
    'http://localhost:3002/cinemas/4/auditorium/13?showtime=61&mode=3d',
    'Hosted Clip Path (Quantum Odyssey)',
    20
  );

  const outPath = path.join(EVIDENCE_DIR, 'click_to_play_results.json');
  fs.writeFileSync(outPath, JSON.stringify({ youtube: youtubeResult, hosted: hostedResult }, null, 2));
  console.log(`\nSaved Click-to-Play results to ${outPath}`);
}

main().catch(console.error);
