const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/@playwright/test'));
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const report = {};

  console.log('1. Testing Home page at http://localhost:3002/ ...');
  await page.goto('http://localhost:3002/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  const homeData = await page.evaluate(() => {
    const heroTitle = document.querySelector('h1')?.textContent;
    const heroError = document.body.innerText.includes('Unable to Load Movie of the Day');
    const nowShowingError = document.body.innerText.includes('Unable to load Now Showing releases');
    return {
      heroTitle,
      heroError,
      nowShowingError,
    };
  });
  report.home = homeData;
  console.log('Home check:', homeData);
  await page.screenshot({ path: 'verify_home_fixed.png' });

  console.log('\n2. Testing Screen 1 (showtime 3921, no red shape)...');
  await page.goto('http://localhost:3002/cinemas/1/auditorium/17?showtime=3921&mode=3d', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  const screen1Data = await page.evaluate(() => {
    const scene = window.__threeScene;
    let redMeshCount = 0;
    if (scene) {
      scene.traverse(o => {
        if (o.isMesh && o.material && o.material.color) {
          const hex = o.material.color.getHexString();
          if (hex === 'dc2626') redMeshCount++;
        }
      });
    }
    return {
      redMeshCount,
      hasCanvas: Boolean(document.querySelector('canvas')),
      mode: window.__cineverse_store?.getState()?.mode,
    };
  });
  report.screen1 = screen1Data;
  console.log('Screen 1 check:', screen1Data);
  await page.screenshot({ path: 'verify_screen1_fixed.png' });

  console.log('\n3. Testing Screen 3 (showtime 3374, trailer playback & motion)...');
  await page.goto('http://localhost:3002/cinemas/1/auditorium/37?showtime=3374&mode=3d', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  // Measure motion smoothness during look around orbital drag
  const startDrag = performance.now();
  await page.mouse.move(700, 450);
  await page.mouse.down();
  for (let dx = 0; dx < 200; dx += 20) {
    await page.mouse.move(700 + dx, 450 + Math.sin(dx / 20) * 30);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  const dragDuration = performance.now() - startDrag;

  // Click Play trailer via evaluate to avoid 3D transform actionability wait
  const clicked = await page.evaluate(() => {
    const playBtn = document.querySelector('[data-testid="screen-3d-play-button"]');
    if (playBtn) {
      playBtn.click();
      return '3D play button clicked';
    }
    const clusterBtn = document.querySelector('[data-testid="screen-cluster-play-btn"]');
    if (clusterBtn) {
      clusterBtn.click();
      return 'Cluster play button clicked';
    }
    return 'No button found';
  });
  console.log('Play button result:', clicked);

  await page.waitForTimeout(4000);

  const screen3Data = await page.evaluate(() => {
    const s = window.__cineverse_store?.getState();
    const yt = window.__cineverse_yt_player;
    return {
      isPlaying: s?.trailer?.isPlaying,
      playbackStatus: s?.trailer?.playbackStatus,
      isMuted: s?.trailer?.isMuted,
      isTheatreMode: s?.trailer?.isTheatreMode,
      ytPlayerState: yt?.getPlayerState ? yt.getPlayerState() : 'no player',
    };
  });
  screen3Data.dragDuration = Math.round(dragDuration);
  report.screen3 = screen3Data;
  console.log('Screen 3 check:', screen3Data);
  await page.screenshot({ path: 'verify_screen3_fixed.png' });

  console.log('\nFINAL VERIFICATION REPORT:');
  console.log(JSON.stringify(report, null, 2));

  await browser.close();
})();
