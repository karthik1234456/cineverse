const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/@playwright/test'));
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Testing Part A on /cinemas/6/auditorium/18?showtime=3449&mode=3d...');
  await page.goto('http://localhost:3002/cinemas/6/auditorium/18?showtime=3449&mode=3d', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.waitForTimeout(3000);

  // Take screenshot before play
  await page.screenshot({ path: 'evidence/part_a_lookaround_before_play.png' });
  console.log('Saved evidence/part_a_lookaround_before_play.png');

  // Verify DynamicScreenOverlay position
  const screenPos = await page.evaluate(() => {
    const obj = window.__threeScene?.getObjectByName('DynamicScreenOverlay');
    if (!obj) return null;
    const box = new window.THREE.Box3().setFromObject(obj);
    const center = new window.THREE.Vector3();
    box.getCenter(center);
    return {
      center: [center.x, center.y, center.z],
      raycastType: typeof obj.raycast
    };
  });
  console.log('DynamicScreenOverlay position:', screenPos);

  // Test seat hover and click in Look around mode
  // The canvas is in middle
  console.log('Testing seat hover in Look around mode...');
  // Hover over lower center of screen where rows H/G/F are visible
  await page.mouse.move(720, 650);
  await page.waitForTimeout(600);
  
  // Check if tooltip or hovered seat appeared in store
  let hovered = await page.evaluate(() => window.__cinemaStore?.getState()?.hoveredSeatId);
  console.log('Hovered seat in Look around at (720, 650):', hovered);

  // Test click to select
  await page.mouse.click(720, 650);
  await page.waitForTimeout(600);
  let selected = await page.evaluate(() => window.__cinemaStore?.getState()?.selectedSeats);
  console.log('Selected seats after click at (720, 650):', selected);

  // Now start playback
  console.log('Starting playback...');
  await page.evaluate(() => {
    if (window.__cineverse_play_trailer) {
      window.__cineverse_play_trailer();
    }
  });
  await page.waitForTimeout(3000);

  // Take screenshot with player active in Look around
  await page.screenshot({ path: 'evidence/part_a_lookaround_player_active.png' });
  console.log('Saved evidence/part_a_lookaround_player_active.png');

  // Test seat hover and click while player is active!
  console.log('Testing seat hover while player is active...');
  await page.mouse.move(720, 700);
  await page.waitForTimeout(600);
  hovered = await page.evaluate(() => window.__cinemaStore?.getState()?.hoveredSeatId);
  console.log('Hovered seat while playing at (720, 700):', hovered);

  await page.mouse.click(720, 700);
  await page.waitForTimeout(600);
  selected = await page.evaluate(() => window.__cinemaStore?.getState()?.selectedSeats);
  console.log('Selected seats while playing:', selected);

  // Switch to Sit view (...&mode=pov&seat=H08)
  console.log('Navigating to Sit view: /cinemas/6/auditorium/18?showtime=3449&mode=pov&seat=H08');
  await page.goto('http://localhost:3002/cinemas/6/auditorium/18?showtime=3449&mode=pov&seat=H08', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.waitForTimeout(3000);

  await page.screenshot({ path: 'evidence/part_a_sit_view_h08.png' });
  console.log('Saved evidence/part_a_sit_view_h08.png');

  const sitState = await page.evaluate(() => {
    const s = window.__cinemaStore?.getState();
    return {
      activeSeatId: s?.activeSeatId,
      cameraMode: s?.cameraMode,
      mode: s?.mode,
      trailerPlaying: s?.trailer?.isPlaying,
    };
  });
  console.log('Sit view state:', sitState);

  await browser.close();
  console.log('Part A verification complete.');
})();
