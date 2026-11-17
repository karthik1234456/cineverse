const { chromium } = require('d:/projects/CineVerse/frontend/node_modules/playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => localStorage.setItem('cineverse_city', 'mumbai'));
  const page = await context.newPage();
  await page.goto('http://localhost:3000/dev/screen-test');
  await page.waitForTimeout(3000);
  
  await page.click('[data-testid="mode-test_card"]');
  // Also switch camera to Sweet spot (Sit) or Walk
  await page.click('[data-testid="preset-sit_center"]');
  await page.waitForTimeout(1500);

  await page.screenshot({ path: 'scripts/full_sit_testcard.png' });
  console.log('Saved scripts/full_sit_testcard.png');

  // Let's also click preset-walk_e and capture
  await page.click('[data-testid="preset-walk_e"]');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'scripts/full_walk_testcard.png' });
  console.log('Saved scripts/full_walk_testcard.png');

  // Let's also click preset-lookaround and capture
  await page.click('[data-testid="preset-lookaround"]');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'scripts/full_lookaround_testcard.png' });
  console.log('Saved scripts/full_lookaround_testcard.png');

  await browser.close();
})();
