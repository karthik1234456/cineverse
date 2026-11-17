const { chromium } = require('../frontend/node_modules/@playwright/test');

async function testUiLogin() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  page.on('requestfailed', req => console.log('REQUEST FAILED:', req.method(), req.url(), req.failure()?.errorText));

  console.log('Navigating to http://localhost:3001...');
  await page.goto('http://localhost:3001/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // Check sign in button
  const signInBtn = await page.locator('button:has-text("Sign In")').first();
  await signInBtn.click();
  await page.waitForTimeout(500);

  // Fill login
  await page.locator('input[placeholder*="patron@example.com"]').fill('patron@example.com');
  await page.locator('input[type="password"]').fill('Patron@123');

  // Click submit
  console.log('Submitting login form...');
  await page.locator('button[type="submit"]:has-text("Sign In")').click();

  await page.waitForTimeout(1500);

  const tokenInStorage = await page.evaluate(() => localStorage.getItem('cineverse_token'));
  console.log('Token in storage:', !!tokenInStorage);

  const headerText = await page.locator('header').innerText();
  console.log('Header text after login:', headerText.replace(/\n/g, ' '));

  await browser.close();
}

testUiLogin().catch(console.error);
