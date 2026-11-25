const { chromium } = require('d:/projects/CineVerse/frontend/node_modules/playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(() => localStorage.setItem('cineverse_city', 'mumbai'));
  const page = await context.newPage();
  await page.goto('http://localhost:3000/dev/screen-test');
  await page.waitForTimeout(3000);

  // Switch to test card
  await page.click('[data-testid="mode-test_card"]');
  await page.waitForTimeout(1000);

  // Take screenshot of canvas directly
  const canvas = page.locator('canvas');
  await canvas.screenshot({ path: 'scripts/canvas_testcard.png' });
  console.log('Canvas screenshot saved to scripts/canvas_testcard.png');

  await browser.close();
})();
