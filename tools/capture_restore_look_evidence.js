const { chromium } = require('../frontend/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const OUTPUT_DIR = path.resolve(__dirname, '../frontend/evidence/restore-look');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const HALLS = [
  {
    id: 'compact',
    name: 'Compact Reference Hall (100-seat)',
    url: 'http://localhost:3000/cinemas/1/auditorium/1?showtime=1&mode=3d',
    sitSeat: 'E05',
  },
  {
    id: 'standard',
    name: 'Standard Multiplex Hall (Continental 216-seat)',
    url: 'http://localhost:3000/cinemas/2/auditorium/6?showtime=26&mode=3d',
    sitSeat: 'E09',
  },
  {
    id: 'large_format',
    name: 'Large Format Flagship Hall (560-seat)',
    url: 'http://localhost:3000/cinemas/1/auditorium/2?showtime=6&mode=3d',
    sitSeat: 'F10',
  },
  {
    id: 'motion_seat',
    name: 'Motion-Seat Hall (Arena Pods 264-seat)',
    url: 'http://localhost:3000/cinemas/2/auditorium/5?showtime=21&mode=3d',
    sitSeat: 'F11',
  },
];

async function run() {
  console.log('Launching headless browser with WebGL...');
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

  for (const hall of HALLS) {
    console.log(`\n=== Capturing Evidence for ${hall.name} ===`);
    try {
      await page.goto(hall.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForSelector('canvas', { timeout: 35000 });
      console.log('Canvas mounted. Waiting for 3D render loop...');
      
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
      const lookaroundPath = path.join(OUTPUT_DIR, `${hall.id}_lookaround.png`);
      await page.screenshot({ path: lookaroundPath, fullPage: false });
      console.log(`Saved Look around view: ${lookaroundPath}`);

      // 2. Walk Mode
      const walkBtn = page.locator('button:has-text("Walk")');
      if (await walkBtn.isVisible()) {
        await walkBtn.click();
        await page.waitForTimeout(700);
      }
      const walkPath = path.join(OUTPUT_DIR, `${hall.id}_walk.png`);
      await page.screenshot({ path: walkPath, fullPage: false });
      console.log(`Saved Walk view: ${walkPath}`);

      // 3. Sit Mode
      await page.evaluate((seatId) => {
        if ((window).__cineverse) {
          (window).__cineverse.selectSeat(seatId);
          (window).__cineverse.sitAt(seatId);
        }
      }, hall.sitSeat);
      await page.waitForTimeout(1400); // Allow smooth POV Bezier transition

      const sitPath = path.join(OUTPUT_DIR, `${hall.id}_sit.png`);
      await page.screenshot({ path: sitPath, fullPage: false });
      console.log(`Saved Sit view: ${sitPath}`);

    } catch (err) {
      console.error(`Error capturing ${hall.id}:`, err.message);
    }
  }

  await browser.close();
  console.log('\nAll screenshots captured successfully in:', OUTPUT_DIR);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
