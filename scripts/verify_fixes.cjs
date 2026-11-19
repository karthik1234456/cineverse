const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/@playwright/test'));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('--- 1. Testing Homepage http://localhost:3002 ---');
  await page.goto('http://localhost:3002', { waitUntil: 'networkidle' });
  const heroError = await page.locator('text=Unable to Load Movie of the Day').count();
  const moviesCount = await page.locator('[data-testid="movie-card"]').count();
  console.log('Homepage hero error count:', heroError, 'Movie cards found:', moviesCount);

  console.log('--- 2. Testing Screen 3 /cinemas/1/auditorium/3?showtime=3374&mode=3d ---');
  await page.goto('http://localhost:3002/cinemas/1/auditorium/3?showtime=3374&mode=3d', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.waitForTimeout(3000);

  // Check Play button on screen
  const playButton3D = page.locator('[data-testid="screen-3d-play-button"]').first();
  const isPlayBtnVisible = await playButton3D.isVisible();
  console.log('Play button on 3D screen visible before click:', isPlayBtnVisible);

  // Check iframe position & visibility before play
  const iframeBefore = await page.evaluate(() => {
    const iframe = document.querySelector('iframe#cineverse-screen-yt-iframe');
    if (!iframe) return { found: false };
    const rect = iframe.getBoundingClientRect();
    return {
      found: true,
      rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
    };
  });
  console.log('Iframe before play:', JSON.stringify(iframeBefore, null, 2));

  // Click Play trailer
  if (isPlayBtnVisible) {
    console.log('Clicking 3D Play button on screen...');
    await playButton3D.click();
  } else {
    console.log('Clicking HUD Play button...');
    await page.locator('[data-testid="trailer-play-toggle"]').first().click();
  }
  await page.waitForTimeout(3500);

  const iframeAfter = await page.evaluate(() => {
    const iframe = document.querySelector('iframe#cineverse-screen-yt-iframe');
    const root = document.querySelector('.cineverse-css3d-root');
    const badge = document.querySelector('[data-testid="screen-playback-status-badge"]')?.textContent;
    if (!iframe) return { found: false };
    const rect = iframe.getBoundingClientRect();
    return {
      found: true,
      badge,
      rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
      rootDisplay: root ? window.getComputedStyle(root).display : null,
      iframeDisplay: window.getComputedStyle(iframe).display,
    };
  });
  console.log('Iframe after play:', JSON.stringify(iframeAfter, null, 2));

  await page.screenshot({ path: 'frontend/public/test-screen3.png' });
  console.log('Saved frontend/public/test-screen3.png');

  console.log('--- 3. Testing Screen 1 Look around mode /cinemas/1/auditorium/1?showtime=3921&mode=3d ---');
  await page.goto('http://localhost:3002/cinemas/1/auditorium/1?showtime=3921&mode=3d', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.waitForTimeout(2000);

  // Switch to Look around mode
  const lookaroundBtn = page.locator('button:has-text("Look around")').first();
  if (await lookaroundBtn.isVisible()) {
    await lookaroundBtn.click();
  }
  await page.waitForTimeout(500);

  // Drag mouse smoothly across the screen in Look around
  console.log('Simulating mouse drags in Look around mode...');
  await page.mouse.move(720, 450);
  await page.mouse.down();
  for (let i = 0; i <= 15; i++) {
    await page.mouse.move(720 + i * 20, 450 + Math.sin(i * 0.5) * 15);
    await page.waitForTimeout(30);
  }
  await page.mouse.up();

  await page.waitForTimeout(500);

  const state = await page.evaluate(() => {
    return window.__cineverse?.getState ? window.__cineverse.getState() : null;
  });
  console.log('Auditorium state after look around drag:', {
    fps: state?.rendererInfo?.fps,
    cameraPosition: state?.cameraPosition,
    mode: state?.mode,
  });

  await page.screenshot({ path: 'frontend/public/test-lookaround.png' });
  console.log('Saved frontend/public/test-lookaround.png');

  await browser.close();
  console.log('All verifications completed successfully!');
})();
