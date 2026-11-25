const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function testHeartOfTheBeast() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--enable-webgl', '--use-gl=angle', '--autoplay-policy=no-user-gesture-required']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });

  const page = await context.newPage();
  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push({ type: msg.type(), text: msg.text() }));

  const url = 'http://localhost:3002/cinemas/5/auditorium/16?showtime=4368&mode=3d&debug=1';
  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

  await page.waitForTimeout(4000);

  // Click Play trailer
  const playBtn = page.locator('[data-testid="trailer-play-toggle"]').first();
  await playBtn.waitFor({ state: 'visible', timeout: 10000 });
  console.log('Clicking Play trailer...');
  await playBtn.click();

  await page.waitForTimeout(3000);

  // Check Theatre Mode modal
  const modal = page.locator('[data-testid="theatre-mode-modal"]');
  const isModalVisible = await modal.isVisible();
  console.log('Modal visible:', isModalVisible);

  const iframe = page.locator('[data-testid="theatre-mode-youtube-iframe"]');
  const hasIframe = await iframe.isVisible();
  const iframeSrc = hasIframe ? await iframe.getAttribute('src') : null;
  console.log('Has iframe:', hasIframe, 'src:', iframeSrc);

  const debugPanel = page.locator('[data-testid="trailer-debug-panel"]');
  const debugText = (await debugPanel.count()) > 0 ? await debugPanel.first().innerText() : '';
  console.log('Debug panel text:\n', debugText);

  // Screenshot
  const ssDir = path.resolve(__dirname, '../evidence');
  if (!fs.existsSync(ssDir)) fs.mkdirSync(ssDir, { recursive: true });
  const ssPath = path.join(ssDir, 'heart_of_the_beast_fixed_theatre_mode.png');
  await page.screenshot({ path: ssPath });
  console.log(`Saved screenshot to ${ssPath}`);

  // Take frame 1, wait 2s, take frame 2 to verify video difference
  const frame1 = await page.screenshot();
  await page.waitForTimeout(2000);
  const frame2 = await page.screenshot();
  const isDiff = !frame1.equals(frame2);
  console.log('Frames 2s apart differ (picture advancing):', isDiff);

  await browser.close();

  fs.writeFileSync(path.join(ssDir, 'heart_beast_fixed_result.json'), JSON.stringify({
    isModalVisible,
    hasIframe,
    iframeSrc,
    isDiff,
    debugText
  }, null, 2));
}

testHeartOfTheBeast().catch(err => {
  console.error(err);
  process.exit(1);
});
