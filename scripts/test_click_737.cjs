const { chromium } = require('d:/projects/CineVerse/frontend/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-gl=angle'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(() => localStorage.setItem('cineverse_city', 'mumbai'));
  const page = await context.newPage();

  await page.goto('http://localhost:3000/cinemas/11/auditorium/36?showtime=737&mode=3d');
  await page.waitForTimeout(4000);

  // Click on-screen play button
  const btn = page.locator('[data-testid="screen-3d-play-button"]');
  console.log('Play button is visible:', await btn.isVisible());

  await btn.click();
  console.log('Clicked play button. Waiting 4.5 seconds for 3s watchdog to transition to Theatre Mode if embed does not advance...');
  await page.waitForTimeout(4500);

  const check = await page.evaluate(() => {
    const theatreModal = document.querySelector('[data-testid="theatre-mode-modal"]');
    const iframe = document.querySelector('#cineverse-screen-yt-iframe');
    const panelStatus = document.querySelector('[data-testid="media-cluster-status"]')?.textContent;
    return {
      hasTheatreModal: Boolean(theatreModal),
      theatreModalVisible: theatreModal ? window.getComputedStyle(theatreModal).display !== 'none' : false,
      hasScreenIframe: Boolean(iframe),
      panelStatus: panelStatus || 'none'
    };
  });
  console.log('After 4.5s check:', check);

  await page.screenshot({ path: 'scripts/st737_after_click.png' });
  console.log('Saved scripts/st737_after_click.png');

  await browser.close();
})();
