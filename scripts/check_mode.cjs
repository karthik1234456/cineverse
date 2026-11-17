const { chromium } = require('d:/projects/CineVerse/frontend/node_modules/playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(() => localStorage.setItem('cineverse_city', 'mumbai'));
  const page = await context.newPage();
  await page.goto('http://localhost:3000/dev/screen-test');
  await page.waitForTimeout(3000);
  
  await page.click('[data-testid="mode-test_card"]');
  await page.waitForTimeout(1000);

  const badgeText = await page.evaluate(() => {
    const badge = document.querySelector('.font-mono.backdrop-blur-md');
    return badge ? badge.textContent : 'not found';
  });
  console.log('Badge text after clicking mode-test_card:', badgeText);

  // Check what Three.js is rendering on the screen
  const screenInfo = await page.evaluate(() => {
    // Check if __cineverse_last_telemetry exists
    return (window).__cineverse_screen_telemetry || 'no telemetry on window';
  });
  console.log('Screen info:', screenInfo);

  await browser.close();
})();
