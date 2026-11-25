const { chromium } = require('../frontend/node_modules/@playwright/test');

async function test() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.error('BROWSER ERROR:', err));

  await page.goto('http://localhost:3002/cinemas/1/auditorium/1?showtime=3374&mode=3d');
  await page.waitForTimeout(5000);

  const text = await page.innerText('body');
  console.log('Body text snippet:', text.slice(0, 300));
  await browser.close();
}

test();
