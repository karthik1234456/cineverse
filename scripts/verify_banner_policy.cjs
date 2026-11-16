const path = require('path');
const { chromium } = require(path.join(__dirname, '..', 'frontend', 'node_modules', '@playwright', 'test'));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Test 1: Check readiness page has banner with real reason and last sync time
  console.log('Testing /dev/readiness ...');
  await page.goto('http://localhost:3000/dev/readiness', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const readinessBanner = await page.$('[data-testid="tmdb-readiness-banner"]');
  console.log('Readiness page banner present?', !!readinessBanner);
  if (readinessBanner) {
    const text = await readinessBanner.innerText();
    console.log('Readiness banner text:', text.replace(/\n+/g, ' '));
  }

  // Test 2: Check booking path (auditorium seat selection) NEVER has banner
  console.log('Testing /cinemas/11/auditorium/36?showtime=737 ...');
  await page.goto('http://localhost:3000/cinemas/11/auditorium/36?showtime=737', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const audBanner = await page.$('[data-testid="tmdb-readiness-banner"]');
  console.log('Auditorium page banner present (MUST BE FALSE)?', !!audBanner);

  // Test 3: Check checkout page NEVER has banner
  console.log('Testing /checkout ...');
  await page.goto('http://localhost:3000/checkout', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const checkoutBanner = await page.$('[data-testid="tmdb-readiness-banner"]');
  console.log('Checkout page banner present (MUST BE FALSE)?', !!checkoutBanner);

  // Test 4: Check booking confirmation page NEVER has banner
  console.log('Testing /booking/1 ...');
  await page.goto('http://localhost:3000/booking/1', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  const bookingBanner = await page.$('[data-testid="tmdb-readiness-banner"]');
  console.log('Booking page banner present (MUST BE FALSE)?', !!bookingBanner);

  await browser.close();
  if (readinessBanner && !audBanner && !checkoutBanner && !bookingBanner) {
    console.log('\n>>> ALL BANNER POLICY CHECKS PASSED PERFECTLY! <<<');
    process.exit(0);
  } else {
    console.error('\nFAILED BANNER POLICY CHECKS!');
    process.exit(1);
  }
})();
