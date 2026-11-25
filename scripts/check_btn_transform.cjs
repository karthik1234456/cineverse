const { chromium } = require('d:/projects/CineVerse/frontend/node_modules/playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://localhost:3000/cinemas/1/auditorium/1?showtime=1&mode=3d');
  await page.waitForTimeout(4000);
  const container = page.locator('[data-testid="screen-3d-play-button-container"]');
  const parent = container.locator('xpath=..');
  const parentHtml = await parent.evaluate(el => ({
    style: el.getAttribute('style'),
    computedTransform: window.getComputedStyle(el).transform,
    innerTransform: window.getComputedStyle(el.firstElementChild).transform
  }));
  console.log('Parent HTML style:', parentHtml);
  const btn = page.locator('[data-testid="screen-3d-play-button"]');
  await btn.screenshot({ path: 'scripts/play_button_crop.png' });
  console.log('Saved play_button_crop.png');
  await browser.close();
})();
