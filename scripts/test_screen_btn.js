const { chromium } = require('../frontend/node_modules/@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  await page.addInitScript(() => {
    try {
      localStorage.setItem('cineverse_city', 'bengaluru');
      localStorage.setItem('cineverse_city_id', '1');
      localStorage.setItem('cineverse_city_modal_dismissed', 'true');
    } catch (e) {}
  });

  await page.goto('http://localhost:3001/cinemas/11/auditorium/36?showtime=737&mode=3d');
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForTimeout(5000);

  const locator = page.locator('[data-testid="screen-3d-play-button"]');
  const count = await locator.count();
  const visible = await locator.isVisible();
  console.log('Button count:', count, 'Visible:', visible);

  if (count > 0) {
    const box = await locator.boundingBox();
    console.log('Bounding box:', box);
    const html = await locator.evaluate((el) => el.outerHTML);
    console.log('HTML preview:', html.slice(0, 150));
    const parentHtml = await locator.evaluate((el) => el.parentElement?.parentElement?.outerHTML);
    console.log('Parent container preview:', parentHtml?.slice(0, 200));
  } else {
    // Check trailer state in window
    const trailerState = await page.evaluate(() => {
      const store = window.__cineverse;
      return {
        hasCineverse: Boolean(store),
        video: Boolean(window.__cineverse_video),
        yt: Boolean(window.__cineverse_yt_player),
      };
    });
    console.log('Trailer state eval:', trailerState);
  }

  await browser.close();
})();
