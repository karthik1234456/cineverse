const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/@playwright/test'));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3002/');
  await page.waitForTimeout(3000);

  const state = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      hasHeroError: text.includes('Unable to Load Movie of the Day'),
      hasNowShowingError: text.includes('Unable to load Now Showing releases'),
      heroTitle: document.querySelector('h1')?.textContent?.trim() || null,
      cardsCount: document.querySelectorAll('article, [data-testid*="movie"]').length,
    };
  });

  console.log('Homepage verification:', state);
  await page.screenshot({ path: path.resolve('evidence/homepage_fixed.png') });
  console.log('Screenshot saved to evidence/homepage_fixed.png');
  await browser.close();
})();
