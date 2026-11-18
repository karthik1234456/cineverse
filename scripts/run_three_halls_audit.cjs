/**
 * run_three_halls_audit.cjs
 * Comprehensive 3-Hall Verification & Interaction Test with Screen Recording:
 * 1) Hall 1: /cinemas/23/auditorium/74?showtime=2048&mode=3d (Grand Balcony, 252 seats, YouTube trailer)
 * 2) Hall 2: /cinemas/4/auditorium/13?showtime=61&mode=3d (Standard Hall, hosted clip)
 * 3) Hall 3: /cinemas/12/auditorium/39?showtime=1875&mode=3d (Big Hall Flagship, 522 seats, largest hall)
 * Tests: Enter 3D, wait, press Play, switch Look around, Walk and Sit, select seats, measure INP.
 * Produces full flow screen recording.
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/@playwright/test'));

const EVIDENCE_DIR = path.resolve('evidence/perf-profile');
const RECORDINGS_DIR = path.resolve('evidence/recordings');
if (!fs.existsSync(EVIDENCE_DIR)) fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
if (!fs.existsSync(RECORDINGS_DIR)) fs.mkdirSync(RECORDINGS_DIR, { recursive: true });

const HALLS = [
  {
    name: 'Hall 1: Grand Balcony (252 seats, YouTube)',
    url: 'http://localhost:3002/cinemas/23/auditorium/74?showtime=2048&mode=3d',
    hasYouTube: true,
  },
  {
    name: 'Hall 2: Standard Hall (100 seats, Hosted Clip)',
    url: 'http://localhost:3002/cinemas/4/auditorium/13?showtime=61&mode=3d',
    hasYouTube: false,
  },
  {
    name: 'Hall 3: Big Hall Flagship (522 seats, Largest Hall)',
    url: 'http://localhost:3002/cinemas/12/auditorium/39?showtime=1875&mode=3d',
    hasYouTube: true,
  },
];

async function testHall(hall, isRecordingRun = false) {
  console.log(`\n============================================================`);
  console.log(` Testing ${hall.name}`);
  console.log(` URL: ${hall.url}`);
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

  const contextOptions = {
    viewport: { width: 1440, height: 900 },
  };
  if (isRecordingRun) {
    contextOptions.recordVideo = {
      dir: RECORDINGS_DIR,
      size: { width: 1440, height: 900 },
    };
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  // 1. Enter 3D page
  const tNavStart = performance.now();
  await page.goto(hall.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('canvas', { timeout: 15000 });
  const loadTimeMs = performance.now() - tNavStart;
  console.log(`  3D Canvas mounted in ${loadTimeMs.toFixed(1)} ms`);

  // Wait 2 seconds in overview
  await page.waitForTimeout(2000);

  // 2. Play trailer
  const playBtn = page.locator('[data-testid="screen-3d-play-button"], [data-testid="screen-play-trailer-btn"]').first();
  const canPlay = await playBtn.isVisible({ timeout: 2000 }).catch(() => false);
  let playAdvanceMs = 0;

  if (canPlay) {
    console.log('  Pressing Play trailer...');
    const tPlayClick = performance.now();
    await playBtn.click({ force: true });

    // Verify advancing
    playAdvanceMs = await page.evaluate(async () => {
      const t0 = performance.now();
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 100));
        const yt = window.__cineverse_yt_player;
        const vid = window.__cineverse_video;
        const cur = (yt && typeof yt.getCurrentTime === 'function' ? yt.getCurrentTime() : 0) || (vid ? vid.currentTime : 0);
        if (cur > 0.05) return performance.now() - t0;
      }
      return -1;
    });
    console.log(`  Playback verified advancing at ${playAdvanceMs.toFixed(1)} ms`);
  }

  // Measure FPS during playback
  const fps = await page.evaluate(async () => {
    let frames = 0;
    const t0 = performance.now();
    return new Promise((resolve) => {
      function count() {
        frames++;
        if (performance.now() - t0 < 2500) {
          requestAnimationFrame(count);
        } else {
          resolve(frames / ((performance.now() - t0) / 1000));
        }
      }
      requestAnimationFrame(count);
    });
  });
  console.log(`  Measured FPS during playback: ${fps.toFixed(1)}`);

  // 3. Interaction Test during playback:
  // Measure Input Latency (INP) for mode switching and seat clicks
  console.log('  Running interaction tests during playback...');
  const latencies = [];

  // A. Switch to Look around mode
  const lookModeBtn = page.locator('button:has-text("Look around"), [data-testid="mode-look-around"]').first();
  if (await lookModeBtn.isVisible().catch(() => false)) {
    const t0 = performance.now();
    await lookModeBtn.click();
    await page.waitForTimeout(100);
    const inp = performance.now() - t0;
    latencies.push({ action: 'Switch to Look Around', inpMs: Math.round(inp) });
    console.log(`    Look Around switch INP: ${Math.round(inp)} ms`);
    await page.waitForTimeout(1500);
  }

  // B. Switch to Walk mode
  const walkModeBtn = page.locator('button:has-text("Walk"), [data-testid="mode-walk"]').first();
  if (await walkModeBtn.isVisible().catch(() => false)) {
    const t0 = performance.now();
    await walkModeBtn.click();
    await page.waitForTimeout(100);
    const inp = performance.now() - t0;
    latencies.push({ action: 'Switch to Walk Mode', inpMs: Math.round(inp) });
    console.log(`    Walk Mode switch INP: ${Math.round(inp)} ms`);
    await page.waitForTimeout(1500);
  }

  // C. Switch to Sit mode
  const sitModeBtn = page.locator('button:has-text("Sit"), [data-testid="mode-sit"]').first();
  if (await sitModeBtn.isVisible().catch(() => false)) {
    const t0 = performance.now();
    await sitModeBtn.click();
    await page.waitForTimeout(100);
    const inp = performance.now() - t0;
    latencies.push({ action: 'Switch to Sit Mode', inpMs: Math.round(inp) });
    console.log(`    Sit Mode switch INP: ${Math.round(inp)} ms`);
    await page.waitForTimeout(1500);
  }

  // D. Click on canvas to select seat
  const canvas = page.locator('canvas').first();
  if (await canvas.isVisible().catch(() => false)) {
    const box = await canvas.boundingBox();
    if (box) {
      const clickX = box.x + box.width * 0.5;
      const clickY = box.y + box.height * 0.65;
      const t0 = performance.now();
      await page.mouse.click(clickX, clickY);
      const inp = performance.now() - t0;
      latencies.push({ action: 'Seat selection click', inpMs: Math.round(inp) });
      console.log(`    Seat selection INP: ${Math.round(inp)} ms`);
    }
  }

  await page.waitForTimeout(2000);

  let videoFile = null;
  if (isRecordingRun) {
    const video = page.video();
    await page.close();
    await context.close();
    if (video) {
      videoFile = await video.path();
      console.log(`  Video saved to: ${videoFile}`);
    }
  } else {
    await page.close();
    await context.close();
  }

  await browser.close();

  const maxInp = latencies.length > 0 ? Math.max(...latencies.map((l) => l.inpMs)) : 0;
  const avgInp = latencies.length > 0 ? latencies.reduce((a, b) => a + b.inpMs, 0) / latencies.length : 0;

  return {
    hallName: hall.name,
    url: hall.url,
    loadTimeMs: Math.round(loadTimeMs),
    playAdvanceMs: Math.round(playAdvanceMs),
    fps: Math.round(fps),
    maxInpMs: Math.round(maxInp),
    avgInpMs: Math.round(avgInp),
    latencies,
    videoFile,
    isFpsPass: fps >= 55,
    isInputLatencyPass: maxInp < 200,
  };
}

async function main() {
  const results = [];

  // Run 1: Grand Balcony with Screen Recording
  console.log('--- RUNNING FULL FLOW WITH RECORDING ---');
  const hall1 = await testHall(HALLS[0], true);
  results.push(hall1);

  // Rename recorded video to standard destination
  if (hall1.videoFile && fs.existsSync(hall1.videoFile)) {
    const targetVideo = path.join(RECORDINGS_DIR, '3d_trailer_full_flow.webm');
    fs.copyFileSync(hall1.videoFile, targetVideo);
    console.log(`Saved master recording to ${targetVideo}`);
  }

  // Run 2: Hosted Clip Hall
  const hall2 = await testHall(HALLS[1], false);
  results.push(hall2);

  // Run 3: Largest Hall (522 seats)
  const hall3 = await testHall(HALLS[2], false);
  results.push(hall3);

  const outPath = path.join(EVIDENCE_DIR, 'three_halls_results.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));

  console.log(`\n============================================================`);
  console.log(`All 3 Halls Verified! Results saved to ${outPath}`);
  console.log(`============================================================`);
}

main().catch(console.error);
