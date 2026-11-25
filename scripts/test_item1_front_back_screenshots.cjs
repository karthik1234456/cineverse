const { chromium } = require('../frontend/node_modules/@playwright/test');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = path.resolve('C:/Users/KARTHIK/.gemini/antigravity/brain/b126ff79-e052-4efd-9d46-663877753dee');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  const halls = [
    { name: 'aud18_balcony', url: 'http://localhost:3002/cinemas/6/auditorium/18?showtime=3449&mode=3d' },
    { name: 'aud13_recliner', url: 'http://localhost:3002/cinemas/4/auditorium/13?showtime=3424&mode=3d' },
    { name: 'aud1_standard', url: 'http://localhost:3002/cinemas/1/auditorium/1?showtime=3374&mode=3d' },
  ];

  for (const hall of halls) {
    console.log(`Testing hall: ${hall.name}...`);
    await page.goto(hall.url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // 1. Back view (looking towards screen from rear)
    await page.evaluate(() => {
      const controls = (window).__cineverse_controls;
      const camera = (window).__cineverse_camera;
      if (camera && controls) {
        // Position at back of hall
        camera.position.set(0, 5.5, -35);
        camera.lookAt(0, 5.5, 0);
        controls.target.set(0, 5.5, 0);
        controls.update();
      }
    });
    await page.waitForTimeout(1000);
    const backPath = path.join(ARTIFACT_DIR, `geometry_${hall.name}_back.png`);
    await page.screenshot({ path: backPath });
    console.log(`Saved back view: ${backPath}`);

    // 2. Front view (looking from Row A towards screen, showing empty floor and stage)
    await page.evaluate(() => {
      const controls = (window).__cineverse_controls;
      const camera = (window).__cineverse_camera;
      if (camera && controls) {
        // Position near Row A
        camera.position.set(0, 2.2, -10);
        camera.lookAt(0, 4.5, 0);
        controls.target.set(0, 4.5, 0);
        controls.update();
      }
    });
    await page.waitForTimeout(1000);
    const frontPath = path.join(ARTIFACT_DIR, `geometry_${hall.name}_front.png`);
    await page.screenshot({ path: frontPath });
    console.log(`Saved front view: ${frontPath}`);
  }

  await browser.close();
  console.log('Item 1 screenshots captured successfully!');
}

run().catch(err => {
  console.error('Item 1 screenshot error:', err);
  process.exit(1);
});
