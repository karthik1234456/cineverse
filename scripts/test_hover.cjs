const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/@playwright/test'));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  console.log('Navigating to auditorium 15 (showtime 4318)...');
  await page.goto('http://localhost:3002/cinemas/5/auditorium/15?showtime=4318&mode=3d', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  // Scan across canvas to see if any seat is hovered
  let foundHover = null;
  for (let y = 400; y <= 700; y += 50) {
    for (let x = 400; x <= 1000; x += 100) {
      await page.mouse.move(x, y);
      await page.waitForTimeout(50);
      const hId = await page.evaluate(() => window.__cineverse_store?.getState()?.hoveredSeatId);
      if (hId) {
        foundHover = { x, y, hId };
        break;
      }
    }
    if (foundHover) break;
  }
  console.log('Found hover result:', foundHover);

  const hoverDetails = await page.evaluate(() => {
    const s = window.__cineverse_store?.getState();
    const tooltip = document.querySelector('[data-testid="seat-hover-tooltip"]');
    return {
      hoveredSeatId: s?.hoveredSeatId,
      selectedSeats: s?.selectedSeats,
      tooltipFound: Boolean(tooltip),
      tooltipText: tooltip?.innerText,
      theatreModeOpen: s?.theatreModeOpen,
      isTheatreMode: s?.trailer?.isTheatreMode,
    };
  });
  console.log('Hover details:', hoverDetails);

  await page.screenshot({ path: 'test_hover_result.png' });

  // Now test Sit view: /cinemas/5/auditorium/15?showtime=4318&mode=pov&seat=E08
  console.log('\nNavigating to Sit view (E08)...');
  await page.goto('http://localhost:3002/cinemas/5/auditorium/15?showtime=4318&mode=pov&seat=E08', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  const sitState = await page.evaluate(() => {
    const s = window.__cineverse_store?.getState();
    const modal = document.querySelector('[data-testid="theatre-mode-modal"]');
    const toast = document.querySelector('[data-testid="toast-notification"]');
    return {
      mode: s?.mode,
      cameraMode: s?.cameraMode,
      activeSeatId: s?.activeSeatId,
      theatreModeOpen: s?.theatreModeOpen,
      isTheatreMode: s?.trailer?.isTheatreMode,
      modalFound: Boolean(modal),
      toastText: toast?.innerText || document.body.innerText.includes('Switched to Theatre Mode'),
    };
  });
  console.log('Sit view state:', sitState);
  await page.screenshot({ path: 'test_sit_view_result.png' });

  await browser.close();
})();
