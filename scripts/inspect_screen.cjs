const { chromium } = require('d:/projects/CineVerse/frontend/node_modules/playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  console.log('Navigating to 3D page...');
  await page.goto('http://localhost:3000/cinemas/1/auditorium/1?showtime=1&mode=3d');
  await page.waitForTimeout(4000);
  const btn = page.locator('[data-testid="screen-3d-play-button"]');
  console.log('Play button count:', await btn.count());
  if (await btn.count() > 0) {
    const text = await btn.innerText();
    console.log('Button text content:', JSON.stringify(text));
    const box = await btn.boundingBox();
    console.log('Button bounding box:', box);
  }
  await page.screenshot({ path: 'scripts/current_screen_button.png' });
  await browser.close();
  console.log('Saved scripts/current_screen_button.png');
})();
