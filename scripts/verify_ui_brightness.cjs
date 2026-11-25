const { chromium } = require('d:/projects/CineVerse/frontend/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const ORIGIN = 'http://localhost:3002';
const EVIDENCE_DIR = path.resolve('evidence/ui-verification');
if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

const TEST_HALLS = [
  {
    slug: 'screen_2_st737',
    name: 'Screen 2: Standard Flat Hall',
    url: `${ORIGIN}/cinemas/11/auditorium/36?showtime=737&mode=3d`
  },
  {
    slug: 'screen_1_st732',
    name: 'Screen 1: Standard Wide Hall',
    url: `${ORIGIN}/cinemas/11/auditorium/35?showtime=732&mode=3d`
  },
  {
    slug: 'flagship_st1875',
    name: 'Big Hall Flagship: Large Curved Hall',
    url: `${ORIGIN}/cinemas/12/auditorium/39?showtime=1875&mode=3d`
  },
  {
    slug: 'original_100_st61',
    name: 'Original 100-Seat Boutique Hall',
    url: `${ORIGIN}/cinemas/4/auditorium/13?showtime=61&mode=3d`
  }
];

async function measureCanvasLuminance(page) {
  return await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return null;
    const c2d = document.createElement('canvas');
    c2d.width = canvas.width;
    c2d.height = canvas.height;
    const ctx = c2d.getContext('2d');
    ctx.drawImage(canvas, 0, 0);
    const imgData = ctx.getImageData(0, 0, c2d.width, c2d.height);
    const pixels = imgData.data;

    let totalLuma = 0;
    let darkCount = 0;
    let brightCount = 0;
    const totalPixels = c2d.width * c2d.height;

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i] / 255;
      const g = pixels[i + 1] / 255;
      const b = pixels[i + 2] / 255;
      // Rec. 709 relative luminance
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      totalLuma += luma;
      if (luma < 0.02) darkCount++;
      if (luma > 0.08) brightCount++;
    }

    return {
      width: c2d.width,
      height: c2d.height,
      totalPixels,
      meanLuminance: +(totalLuma / totalPixels).toFixed(4),
      darkShare: +(darkCount / totalPixels).toFixed(4),
      brightShare: +(brightCount / totalPixels).toFixed(4)
    };
  });
}

(async () => {
  console.log('==============================================================');
  console.log(` TASK 4: BRIGHTNESS & PHOTOMETRIC LUMINANCE VERIFICATION`);
  console.log(' Target (Normal): Mean [0.22-0.35], Pixels >0.08 >= 60%, Pixels <0.02 <= 8%');
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

  const results = [];

  for (const hall of TEST_HALLS) {
    console.log(`\nEvaluating: ${hall.name} (${hall.url})...`);
    await page.goto(hall.url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('canvas', { timeout: 20000 });
    // Let scene and textures stabilize
    await page.waitForTimeout(2500);

    // 1. Measure NORMAL light level
    const normalBtn = page.locator('[data-testid="light-level-normal"]');
    if (await normalBtn.isVisible()) {
      await normalBtn.click();
    } else {
      await page.evaluate(() => {
        // Fallback to store if button not directly in view
        const s = window.__cinemaStore?.getState?.();
        if (s?.setLightLevel) s.setLightLevel('normal');
      });
    }
    // Allow Three.js frame transition to complete
    await page.waitForTimeout(2000);

    const normalMetrics = await measureCanvasLuminance(page);
    const normalPath = path.join(EVIDENCE_DIR, `brightness_${hall.slug}_normal.png`);
    await page.screenshot({ path: normalPath });
    console.log(`  [Normal Mode] Mean: ${normalMetrics.meanLuminance}, >0.08: ${(normalMetrics.brightShare * 100).toFixed(1)}%, <0.02: ${(normalMetrics.darkShare * 100).toFixed(1)}%`);

    // Verify pass condition on Normal
    const normalPassed = (
      normalMetrics.meanLuminance >= 0.22 &&
      normalMetrics.meanLuminance <= 0.35 &&
      normalMetrics.brightShare >= 0.60 &&
      normalMetrics.darkShare <= 0.08
    );
    console.log(`  [Normal Target Evaluation]: ${normalPassed ? 'PASSED (Compliant with 0.22-0.35)' : 'NEEDS CALIBRATION'}`);

    // 2. Measure BRIGHT light level
    const brightBtn = page.locator('[data-testid="light-level-bright"]');
    if (await brightBtn.isVisible()) {
      await brightBtn.click();
    } else {
      await page.evaluate(() => {
        const s = window.__cinemaStore?.getState?.();
        if (s?.setLightLevel) s.setLightLevel('bright');
      });
    }
    await page.waitForTimeout(2000);

    const brightMetrics = await measureCanvasLuminance(page);
    const brightPath = path.join(EVIDENCE_DIR, `brightness_${hall.slug}_bright.png`);
    await page.screenshot({ path: brightPath });
    console.log(`  [Bright Mode] Mean: ${brightMetrics.meanLuminance}, >0.08: ${(brightMetrics.brightShare * 100).toFixed(1)}%, <0.02: ${(brightMetrics.darkShare * 100).toFixed(1)}%`);

    results.push({
      hall: hall.name,
      slug: hall.slug,
      url: hall.url,
      normal: {
        ...normalMetrics,
        screenshot: normalPath,
        passed: normalPassed
      },
      bright: {
        ...brightMetrics,
        screenshot: brightPath
      }
    });
  }

  const allNormalPassed = results.every(r => r.normal.passed);

  const report = {
    test: 'Task 4: Real GPU Luminance Benchmark across 4 Halls',
    executedAt: new Date().toISOString(),
    passCriteria: {
      normalMeanRange: [0.22, 0.35],
      minBrightPixelsShare: 0.60,
      maxDarkPixelsShare: 0.08
    },
    allNormalPassed,
    results
  };

  fs.writeFileSync(path.join(EVIDENCE_DIR, 'brightness_verification_results.json'), JSON.stringify(report, null, 2));
  console.log(`\nBRIGHTNESS BENCHMARK COMPLETE. ALL NORMAL PASSED: ${allNormalPassed}`);

  await browser.close();
})();
