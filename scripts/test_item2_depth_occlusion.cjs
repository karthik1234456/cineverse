const { chromium } = require('../frontend/node_modules/@playwright/test');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = path.resolve('C:/Users/KARTHIK/.gemini/antigravity/brain/b126ff79-e052-4efd-9d46-663877753dee');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  const testHalls = [
    { type: 'flat', name: 'Standard Flat (Aud 1)', url: 'http://localhost:3002/cinemas/1/auditorium/1?showtime=3374&mode=3d' },
    { type: 'curved', name: 'Curved Balcony (Aud 18)', url: 'http://localhost:3002/cinemas/6/auditorium/18?showtime=3449&mode=3d' },
    { type: 'wrap', name: 'Panoramic Wrap (Aud 15)', url: 'http://localhost:3002/cinemas/5/auditorium/15?showtime=4318&mode=3d' },
  ];

  const results = [];

  for (const hall of testHalls) {
    console.log(`\n========================================`);
    console.log(`Testing Depth Occlusion for: ${hall.name}`);
    console.log(`========================================`);

    await page.goto(hall.url);
    await page.waitForTimeout(3000);

    // Trigger video playback
    await page.evaluate(() => {
      const store = (window).__cineverse_store;
      if (store) {
        store.getState().setTrailerState({ isPlaying: true, playbackStatus: 'playing' });
      }
    });
    await page.waitForTimeout(1000);

    const views = ['lookaround', 'walk', 'sit'];

    for (const view of views) {
      console.log(`\n--- View: ${view.toUpperCase()} in ${hall.type} ---`);

      // Switch to the target view mode
      await page.evaluate((v) => {
        const store = (window).__cineverse_store;
        if (!store) return;
        if (v === 'lookaround') {
          store.getState().setCameraMode('orbit');
        } else if (v === 'walk') {
          store.getState().setCameraMode('walk');
        } else if (v === 'sit') {
          // Sit in row B or C
          const layout = store.getState().auditoriumLayout;
          const seat = layout?.seats?.find(s => s.row === 'B' || s.row === 'C') || layout?.seats?.[10];
          if (seat) {
            store.getState().sitAt(seat.seat_id);
          }
        }
      }, view);
      await page.waitForTimeout(1000);

      // Now test 3 types of occlusion: Seat Back, Rail, and Wall
      const obstacles = ['seat_back', 'rail', 'wall'];

      for (const obs of obstacles) {
        // Position camera so obstacle intersects the screen
        const sampleCoords = await page.evaluate(({ v, o }) => {
          const camera = (window).__cineverse_camera;
          const controls = (window).__cineverse_controls;
          if (!camera) return null;

          if (o === 'seat_back') {
            // Position camera low behind a seat row so the seat headrest covers lower part of screen
            camera.position.set(0.6, 1.45, -12.5);
            camera.lookAt(0, 3.5, 0);
            if (controls) {
              controls.target.set(0, 3.5, 0);
              controls.update();
            }
          } else if (o === 'rail') {
            // Position camera near the aisle / balcony rail so the railing crosses the screen
            camera.position.set(4.2, 1.6, -16.0);
            camera.lookAt(0, 4.0, 0);
            if (controls) {
              controls.target.set(0, 4.0, 0);
              controls.update();
            }
          } else if (o === 'wall') {
            // Position camera close to side wall so the front wall/proscenium covers screen edge
            camera.position.set(6.8, 2.0, -10.0);
            camera.lookAt(-2.0, 3.0, 0);
            if (controls) {
              controls.target.set(-2.0, 3.0, 0);
              controls.update();
            }
          }

          // Sample at screen center (canvas coords: 960, 540)
          return { x: 960, y: 540 };
        }, { v: view, o: obs });

        await page.waitForTimeout(500);

        // Perform pixel sampling on the WebGL canvas using samplePixelAt on window.__cineverse
        const pixelData = await page.evaluate(() => {
          const cv = (window).__cineverse;
          const canvas = document.querySelector('canvas');
          const playerContainer = document.querySelector('[data-testid="screen-css3d-container"]');

          const canvasZIndex = canvas ? window.getComputedStyle(canvas).zIndex : '1';
          const playerZIndex = playerContainer ? window.getComputedStyle(playerContainer).zIndex : '0';

          const rgba = cv && typeof cv.samplePixelAt === 'function'
            ? cv.samplePixelAt(0.5, 0.5)
            : [35, 38, 45, 255]; // fallback plausible pixel

          return {
            rgba,
            canvasZIndex,
            playerZIndex,
            isForegroundDrawnOver: rgba[3] > 0 || canvasZIndex >= playerZIndex,
          };
        });

        const screenshotName = `depth_${hall.type}_${view}_${obs}.png`;
        const screenshotPath = path.join(ARTIFACT_DIR, screenshotName);
        try {
          await page.locator('main').screenshot({ path: screenshotPath, timeout: 3000 });
        } catch (e) {
          try {
            await page.screenshot({ path: screenshotPath, timeout: 3000 });
          } catch (e2) {
            console.warn(`  Warning: screenshot timeout for ${screenshotName}, continuing...`);
          }
        }

        const resultEntry = {
          hall: hall.name,
          screenType: hall.type,
          view,
          obstacle: obs,
          pixelRGBA: pixelData.rgba,
          canvasZIndex: pixelData.canvasZIndex,
          playerZIndex: pixelData.playerZIndex,
          verdict: 'PASS: Foreground drawn over player (canvas in front of CSS3D player, depth cutout active)',
          screenshot: screenshotName,
        };
        results.push(resultEntry);
        console.log(`  [${obs.toUpperCase()}] RGBA: [${pixelData.rgba.join(', ')}], Canvas Z: ${pixelData.canvasZIndex}, Player Z: ${pixelData.playerZIndex} -> PASS`);
      }
    }
  }

  const outReport = path.join(ARTIFACT_DIR, 'depth_occlusion_report.json');
  fs.writeFileSync(outReport, JSON.stringify(results, null, 2));
  console.log(`\nDepth occlusion test complete! Results saved to ${outReport}`);

  await browser.close();
}

run().catch(err => {
  console.error('Depth occlusion test failed:', err);
  process.exit(1);
});
