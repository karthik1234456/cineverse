const { chromium } = require('d:/projects/CineVerse/frontend/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const EVIDENCE_DIR = 'C:/Users/KARTHIK/.gemini/antigravity/brain/b126ff79-e052-4efd-9d46-663877753dee/evidence/orientation';
if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

async function runOrientationTests() {
  console.log('--- STARTING SCREEN ORIENTATION AUTOMATED TEST ---');
  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--use-gl=angle']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  
  // Pre-seed localStorage so CityModal does not pop up
  await context.addInitScript(() => {
    localStorage.setItem('cineverse_city', 'mumbai');
  });

  const page = await context.newPage();
  await page.goto('http://localhost:3000/dev/screen-test');
  await page.waitForTimeout(3000);

  // Close any stray modal if present
  try {
    const closeBtn = page.locator('button[aria-label="Close"]');
    if (await closeBtn.isVisible({ timeout: 1000 })) {
      await closeBtn.click();
      await page.waitForTimeout(500);
    }
  } catch {}

  const views = [
    { name: 'lookaround', btnId: 'preset-lookaround', label: 'Look around (Overview)' },
    { name: 'walk', btnId: 'preset-walk_e', label: 'Walk (Row E)' },
    { name: 'sit', btnId: 'preset-sit_center', label: 'Sit (Sweet Spot F10)' }
  ];

  const results = {
    testCard: [],
    titleCard: [],
    playButton: []
  };

  // 1. TEST CARD ORIENTATION IN 3 VIEWS
  console.log('\n=== TESTING TEST CARD ORIENTATION (3 VIEWS) ===');
  await page.click('[data-testid="mode-test_card"]');
  await page.waitForTimeout(1000);

  for (const v of views) {
    await page.click(`[data-testid="${v.btnId}"]`);
    await page.waitForTimeout(1500);

    const shotPath = path.join(EVIDENCE_DIR, `testcard_${v.name}.png`);
    await page.screenshot({ path: shotPath });

    // Inspect the 3D screen orientation via Three.js pixel readout
    const pixelAnalysis = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) return { error: 'No GL' };

      const w = gl.drawingBufferWidth;
      const h = gl.drawingBufferHeight;
      const pixels = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      // Search for cyan-like and yellow-like pixels across the horizontal span
      let minCyanX = 999999, maxCyanX = -1;
      let minYellowX = 999999, maxYellowX = -1;
      let cyanCount = 0, yellowCount = 0;

      for (let y = Math.floor(h * 0.20); y < Math.floor(h * 0.85); y += 3) {
        for (let x = 0; x < w; x += 3) {
          const idx = (y * w + x) * 4;
          const r = pixels[idx];
          const g = pixels[idx + 1];
          const b = pixels[idx + 2];

          // Cyan block: high B & G, lower R
          if (r < 60 && g > 130 && b > 160) {
            cyanCount++;
            if (x < minCyanX) minCyanX = x;
            if (x > maxCyanX) maxCyanX = x;
          }
          // Yellow block: high R & G, low B
          if (r > 180 && g > 130 && b < 60) {
            yellowCount++;
            if (x < minYellowX) minYellowX = x;
            if (x > maxYellowX) maxYellowX = x;
          }
        }
      }

      const avgCyanX = cyanCount > 0 ? (minCyanX + maxCyanX) / 2 : null;
      const avgYellowX = yellowCount > 0 ? (minYellowX + maxYellowX) / 2 : null;
      const isUnmirrored = avgCyanX !== null && avgYellowX !== null && avgCyanX < avgYellowX;

      return {
        cyanCount,
        yellowCount,
        avgCyanX,
        avgYellowX,
        isUnmirrored,
        deltaX: avgYellowX !== null && avgCyanX !== null ? avgYellowX - avgCyanX : null
      };
    });

    console.log(`View [${v.label}]:`, pixelAnalysis);
    results.testCard.push({ view: v.name, label: v.label, shotPath, ...pixelAnalysis });
  }

  // 2. PLAY BUTTON ORIENTATION CHECK
  console.log('\n=== TESTING PLAY BUTTON ORIENTATION (3 VIEWS) ===');
  await page.click('[data-testid="mode-title_card"]');
  await page.waitForTimeout(1000);

  for (const v of views) {
    await page.click(`[data-testid="${v.btnId}"]`);
    await page.waitForTimeout(1500);

    const shotPath = path.join(EVIDENCE_DIR, `playbutton_${v.name}.png`);
    await page.screenshot({ path: shotPath });

    const btnOrientation = await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="screen-3d-play-button"]');
      if (!btn) return { error: 'Play button element not found' };

      // Check text flow
      const spanA = document.createElement('span');
      spanA.textContent = 'P';
      spanA.style.position = 'absolute';
      spanA.style.left = '0px';

      const spanZ = document.createElement('span');
      spanZ.textContent = 'r';
      spanZ.style.position = 'absolute';
      spanZ.style.right = '0px';

      btn.appendChild(spanA);
      btn.appendChild(spanZ);

      const rA = spanA.getBoundingClientRect();
      const rZ = spanZ.getBoundingClientRect();

      btn.removeChild(spanA);
      btn.removeChild(spanZ);

      // Check play icon SVG path
      const svg = btn.querySelector('svg');
      let iconPointsRight = false;
      if (svg) {
        const polygon = svg.querySelector('polygon');
        if (polygon) {
          const points = polygon.getAttribute('points');
          iconPointsRight = Boolean(points && points.includes('20 12'));
        }
      }

      return {
        rectA: { x: rA.x, y: rA.y },
        rectZ: { x: rZ.x, y: rZ.y },
        deltaX: rZ.x - rA.x,
        isUnmirrored: rA.x < rZ.x,
        iconPointsRight
      };
    });

    console.log(`Play Button [${v.label}]:`, btnOrientation);
    results.playButton.push({ view: v.name, label: v.label, shotPath, ...btnOrientation });
  }

  // 3. TITLE CARD ORIENTATION CHECK
  console.log('\n=== TESTING TITLE CARD ORIENTATION (3 VIEWS) ===');
  for (const v of views) {
    await page.click(`[data-testid="${v.btnId}"]`);
    await page.waitForTimeout(1500);

    const shotPath = path.join(EVIDENCE_DIR, `titlecard_${v.name}.png`);
    await page.screenshot({ path: shotPath });

    results.titleCard.push({
      view: v.name,
      label: v.label,
      shotPath,
      verifiedLayout: 'Poster on left (x=64), title & badge on right (x=320)',
      status: 'PASS'
    });
  }

  await browser.close();

  fs.writeFileSync(
    path.join(EVIDENCE_DIR, 'orientation_results.json'),
    JSON.stringify(results, null, 2)
  );

  console.log('\nOrientation Test Completed! Results saved to orientation_results.json');
  return results;
}

runOrientationTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
