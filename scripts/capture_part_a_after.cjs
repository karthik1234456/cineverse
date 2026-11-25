const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACTS_DIR = 'C:/Users/KARTHIK/.gemini/antigravity/brain/b126ff79-e052-4efd-9d46-663877753dee';

const HALLS = [
  {
    name: 'compact',
    label: 'Compact Hall',
    urlLook: 'http://localhost:3002/cinemas/1/auditorium/1?showtime=1&mode=3d',
    urlSit: 'http://localhost:3002/cinemas/1/auditorium/1?showtime=1&mode=pov&seat=E05',
    seat: 'E05'
  },
  {
    name: 'standard',
    label: 'Standard Stadium Hall',
    urlLook: 'http://localhost:3002/cinemas/4/auditorium/12?showtime=56&mode=3d',
    urlSit: 'http://localhost:3002/cinemas/4/auditorium/12?showtime=56&mode=pov&seat=E08',
    seat: 'E08'
  },
  {
    name: 'motion_seat',
    label: 'Motion-seat Arena',
    urlLook: 'http://localhost:3002/cinemas/2/auditorium/5?showtime=21&mode=3d',
    urlSit: 'http://localhost:3002/cinemas/2/auditorium/5?showtime=21&mode=pov&seat=E08',
    seat: 'E08'
  },
  {
    name: 'grand_balcony',
    label: 'Grand Balcony Hall',
    urlLook: 'http://localhost:3002/cinemas/6/auditorium/18?showtime=3449&mode=3d',
    urlSit: 'http://localhost:3002/cinemas/6/auditorium/18?showtime=3449&mode=pov&seat=H08',
    seat: 'H08'
  }
];

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=default', '--enable-webgl', '--no-sandbox']
  });

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const results = {};

  for (const hall of HALLS) {
    console.log(`\n=== Capturing AFTER for ${hall.label} ===`);

    // 1. Look around mode
    await page.goto(hall.urlLook, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);

    const lookMetrics = await page.evaluate(() => {
      const store = window.useCinemaStore ? window.useCinemaStore.getState() : null;
      const layout = store ? store.auditoriumLayout : null;
      return {
        screenWidth: layout ? layout.screen?.width : null,
        screenHeight: layout ? layout.screen?.height : null,
        screenWidthM: layout ? Math.round((layout.screen?.width || 0) * 0.5 * 10) / 10 : null,
        screenHeightM: layout ? Math.round((layout.screen?.height || 0) * 0.5 * 10) / 10 : null,
        aspect: layout ? layout.screen?.aspect : null,
        totalSeats: store ? Object.keys(store.seatStatuses || {}).length : null,
        screenFitMode: store ? store.screenFitMode : null,
      };
    });

    const lookPath = path.join(ARTIFACTS_DIR, `part_a_after_${hall.name}_lookaround.png`);
    await page.screenshot({ path: lookPath });
    console.log(`Saved Look around: ${lookPath}`, lookMetrics);

    // 2. Sit POV mode
    await page.goto(hall.urlSit, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);

    const sitPath = path.join(ARTIFACTS_DIR, `part_a_after_${hall.name}_sit.png`);
    await page.screenshot({ path: sitPath });
    console.log(`Saved Sit POV: ${sitPath}`);

    results[hall.name] = {
      label: hall.label,
      metrics: lookMetrics,
      lookScreenshot: `part_a_after_${hall.name}_lookaround.png`,
      sitScreenshot: `part_a_after_${hall.name}_sit.png`
    };
  }

  // 3. Capture Theatre Mode
  console.log(`\n=== Capturing Theatre Mode on Grand Balcony ===`);
  await page.goto('http://localhost:3002/cinemas/6/auditorium/18?showtime=3449&mode=3d', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Click Theatre Mode button in Trailer panel
  const tmBtn = page.locator('button:has-text("Theatre Mode")').first();
  if (await tmBtn.count() > 0) {
    await tmBtn.click();
    await page.waitForTimeout(1500);
  } else {
    // Open via store if button hidden
    await page.evaluate(() => {
      if (window.useCinemaStore) window.useCinemaStore.getState().setTheatreModeOpen(true);
    });
    await page.waitForTimeout(1500);
  }

  const tmPath = path.join(ARTIFACTS_DIR, 'part_a_theatre_mode.png');
  await page.screenshot({ path: tmPath });
  console.log(`Saved Theatre Mode: ${tmPath}`);

  const outJson = path.join(ARTIFACTS_DIR, 'part_a_after_metrics.json');
  fs.writeFileSync(outJson, JSON.stringify(results, null, 2));
  console.log(`\nSaved all metrics to ${outJson}`);

  await browser.close();
})();
