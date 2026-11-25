const { chromium } = require('../frontend/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const OUTPUT_DIR = path.resolve(__dirname, '../frontend/evidence/restore-look');

async function run() {
  console.log('Capturing Motion-Seat Hall screenshots...');
  const browser = await chromium.launch({
    args: [
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      '--use-gl=angle',
      '--enable-webgl',
    ],
  });

  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });

  const url = 'http://localhost:3000/cinemas/2/auditorium/5?showtime=21&mode=3d';
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector('canvas', { timeout: 35000 });
  console.log('Canvas mounted. Waiting for render calls...');

  await page.waitForFunction(
    () => (window).__cineverse?.getState?.()?.rendererInfo?.calls > 0,
    null,
    { timeout: 30000 }
  );
  await page.waitForTimeout(1000);

  // 1. Look around Mode
  const lookaroundBtn = page.locator('button:has-text("Look around")');
  if (await lookaroundBtn.isVisible()) {
    await lookaroundBtn.click();
    await page.waitForTimeout(600);
  }
  const lookaroundPath = path.join(OUTPUT_DIR, 'motion_seat_lookaround.png');
  await page.screenshot({ path: lookaroundPath, fullPage: false });
  console.log(`Saved: ${lookaroundPath}`);

  // 2. Walk Mode
  const walkBtn = page.locator('button:has-text("Walk")');
  if (await walkBtn.isVisible()) {
    await walkBtn.click();
    await page.waitForTimeout(700);
  }
  const walkPath = path.join(OUTPUT_DIR, 'motion_seat_walk.png');
  await page.screenshot({ path: walkPath, fullPage: false });
  console.log(`Saved: ${walkPath}`);

  // 3. Sit Mode
  await page.evaluate(() => {
    if ((window).__cineverse) {
      (window).__cineverse.selectSeat('F11');
      (window).__cineverse.sitAt('F11');
    }
  });
  await page.waitForTimeout(1400);

  const sitPath = path.join(OUTPUT_DIR, 'motion_seat_sit.png');
  await page.screenshot({ path: sitPath, fullPage: false });
  console.log(`Saved: ${sitPath}`);

  await browser.close();
  console.log('Motion-seat captures complete!');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
