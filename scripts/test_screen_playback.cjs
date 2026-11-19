const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/@playwright/test'));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Navigating to Screen 3 /cinemas/1/auditorium/3?showtime=3374&mode=3d...');
  await page.goto('http://localhost:3002/cinemas/1/auditorium/3?showtime=3374&mode=3d', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.waitForTimeout(2000);

  // Click 3D play button
  const playBtn = page.locator('[data-testid="screen-3d-play-button"]').first();
  console.log('3D Play button visible:', await playBtn.isVisible());
  await playBtn.click();

  // Wait 4 seconds for video to start
  await page.waitForTimeout(4000);

  const status = await page.evaluate(() => {
    const iframe = document.querySelector('iframe#cineverse-screen-yt-iframe');
    const badge = document.querySelector('[data-testid="screen-playback-status-badge"]')?.textContent;
    const playBtnContainer = document.querySelector('[data-testid="screen-3d-play-button-container"]');
    return {
      iframePresent: Boolean(iframe),
      iframeSrc: iframe ? iframe.src : null,
      badgeText: badge,
      playButtonVisible: Boolean(playBtnContainer),
    };
  });
  console.log('Playback state after click:', status);

  await page.screenshot({ path: 'frontend/public/test-playing-screen3.png' });
  console.log('Saved frontend/public/test-playing-screen3.png');

  await browser.close();
})();
