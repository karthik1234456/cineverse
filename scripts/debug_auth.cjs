const { chromium } = require('d:/projects/CineVerse/frontend/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('cineverse_city', 'bengaluru');
    localStorage.setItem('cineverse_city_modal_dismissed', 'true');
  });
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('response', res => {
    if (res.url().includes('/api/v1/auth/')) {
      console.log('AUTH API:', res.status(), res.url());
    }
  });
  await page.goto('http://localhost:3002/');
  await page.click('button:has-text("Sign In")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("Register")');
  await page.waitForTimeout(500);
  const email = 'debug_' + Date.now() + '@example.com';
  await page.fill('input[placeholder="Karthik R"]', 'Debug User');
  await page.fill('input[placeholder="user@example.com"]', email);
  await page.fill('input[placeholder="At least 6 characters"]', 'Password123!');
  await page.click('button[type="submit"]:has-text("Create Account")');
  await page.waitForTimeout(3000);
  console.log('HEADER HTML:', await page.locator('header').innerHTML());
  await browser.close();
})();
