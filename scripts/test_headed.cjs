const { chromium } = require('d:/projects/CineVerse/frontend/node_modules/playwright');

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: false, channel: 'chrome' });
    console.log('Successfully launched headed Google Chrome');
  } catch (err) {
    console.log('Google Chrome channel failed, launching bundled headed Chromium:', err.message);
    browser = await chromium.launch({ headless: false });
    console.log('Successfully launched bundled headed Chromium');
  }
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/health', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await browser.close();
  console.log('Headed launch test passed!');
})();
