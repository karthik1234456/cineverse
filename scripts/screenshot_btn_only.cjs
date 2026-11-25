const { chromium } = require('d:/projects/CineVerse/frontend/node_modules/playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://localhost:3000/cinemas/1/auditorium/1?showtime=1&mode=3d');
  await page.waitForTimeout(4000);
  
  const btn = page.locator('[data-testid="screen-3d-play-button"]');
  await btn.screenshot({ path: 'scripts/btn_isolated.png' });
  console.log('Saved scripts/btn_isolated.png');
  await browser.close();
})();
