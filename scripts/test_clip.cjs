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

  // Get canvas bounding box
  const bbox = await page.locator('canvas').boundingBox();
  console.log('Canvas bbox:', bbox);

  await page.screenshot({
    path: 'scripts/canvas_clipped.png',
    clip: { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height }
  });
  console.log('Clipped canvas screenshot saved successfully!');

  await browser.close();
})();
