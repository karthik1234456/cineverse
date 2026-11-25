/**
 * run_memory_audit.cjs
 * Comprehensive Memory and WebGL Leak Benchmark:
 * Measures 20 enter-and-leave cycles of /cinemas/23/auditorium/74?showtime=2048&mode=3d
 * with forced garbage collection via CDP HeapProfiler.collectGarbage.
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/@playwright/test'));

const EVIDENCE_DIR = path.resolve('evidence/perf-profile');
if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

const URL_3D = 'http://localhost:3002/cinemas/23/auditorium/74?showtime=2048&mode=3d';
const URL_2D = 'http://localhost:3002/cinemas/23/auditorium/74?showtime=2048&mode=2d';

async function main() {
  console.log('============================================================');
  console.log(' Starting 20-Cycle Memory & WebGL Leak Audit (Headed Chrome)');
  console.log('============================================================');

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

  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  await client.send('HeapProfiler.enable');

  const cycles = [];

  for (let cycle = 1; cycle <= 20; cycle++) {
    // 1. Enter 3D mode
    await page.goto(URL_3D, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('canvas', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(500);

    // Measure while inside 3D
    const inside3D = await page.evaluate(() => {
      const canvases = document.querySelectorAll('canvas').length;
      const iframes = document.querySelectorAll('iframe').length;
      const videos = document.querySelectorAll('video').length;
      const heapMb = (window.performance && (window.performance).memory)
        ? (window.performance).memory.usedJSHeapSize / (1024 * 1024)
        : 0;
      return { canvases, iframes, videos, heapMb };
    });

    // 2. Leave 3D mode (switch to 2D)
    await page.goto(URL_2D, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(500);

    // 3. Force Garbage Collection
    await client.send('HeapProfiler.collectGarbage');
    await client.send('HeapProfiler.collectGarbage');
    await page.waitForTimeout(300);

    // 4. Measure clean state after GC
    const cleanState = await page.evaluate(() => {
      const canvases = document.querySelectorAll('canvas').length;
      const iframes = document.querySelectorAll('iframe').length;
      const videos = document.querySelectorAll('video').length;
      const heapMb = (window.performance && (window.performance).memory)
        ? (window.performance).memory.usedJSHeapSize / (1024 * 1024)
        : 0;

      // Count all active DOM nodes
      const allNodes = document.querySelectorAll('*').length;

      return { canvases, iframes, videos, heapMb, allNodes };
    });

    console.log(`[Cycle ${cycle}/20] 3D Heap: ${inside3D.heapMb.toFixed(2)} MB | After 2D+GC: ${cleanState.heapMb.toFixed(2)} MB | Leftover Canvases: ${cleanState.canvases} | Leftover Iframes: ${cleanState.iframes}`);

    cycles.push({
      cycle,
      inside3D,
      afterLeaveGC: cleanState,
    });
  }

  await browser.close();

  const startHeap = cycles[0].afterLeaveGC.heapMb;
  const endHeap = cycles[cycles.length - 1].afterLeaveGC.heapMb;
  const heapGrowthPct = startHeap > 0 ? ((endHeap - startHeap) / startHeap) * 100 : 0;
  const maxLeftoverCanvases = Math.max(...cycles.map((c) => c.afterLeaveGC.canvases));
  const maxLeftoverIframes = Math.max(...cycles.map((c) => c.afterLeaveGC.iframes));

  const summary = {
    totalCycles: 20,
    startHeapMb: parseFloat(startHeap.toFixed(2)),
    endHeapMb: parseFloat(endHeap.toFixed(2)),
    heapGrowthPct: parseFloat(heapGrowthPct.toFixed(2)),
    maxLeftoverCanvases,
    maxLeftoverIframes,
    isHeapGrowthBudgetPassed: heapGrowthPct < 10.0,
    isLeftoverResourcesClean: maxLeftoverCanvases === 0 && maxLeftoverIframes === 0,
    cycles,
  };

  const outPath = path.join(EVIDENCE_DIR, 'memory_audit_results.json');
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log('\n============================================================');
  console.log(`Memory Audit Complete:`);
  console.log(`  Initial Heap: ${summary.startHeapMb} MB`);
  console.log(`  Final Heap:   ${summary.endHeapMb} MB`);
  console.log(`  Growth:       ${summary.heapGrowthPct}% (Budget < 10%: ${summary.isHeapGrowthBudgetPassed})`);
  console.log(`  Leftover Canvases: ${summary.maxLeftoverCanvases}`);
  console.log(`  Leftover Iframes:  ${summary.maxLeftoverIframes}`);
  console.log(`Saved to ${outPath}`);
  console.log('============================================================');
}

main().catch(console.error);
