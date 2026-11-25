const { chromium } = require('@playwright/test');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  console.log('--- PART C: Walk mode verification on Auditorium 9 ---');
  await page.goto('http://localhost:3000/cinemas/3/auditorium/9?showtime=41&mode=3d', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Switch to Walk mode via keyboard W or UI
  console.log('Switching to Walk mode...');
  await page.keyboard.press('KeyW');
  await page.waitForTimeout(1500);

  // Check reset position button
  const resetBtn = await page.$('[data-testid="walk-reset-position-btn"]');
  if (!resetBtn) {
    throw new Error('Reset position button not found in WalkHUD');
  }
  console.log('Reset position button found in WalkHUD');

  // Walk forward in aisle
  console.log('Walking forward in aisle...');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1000);
  await page.keyboard.up('KeyW');

  await page.screenshot({ path: 'frontend/evidence/part_c_walk_advancing.png' });
  console.log('Saved frontend/evidence/part_c_walk_advancing.png');

  // Click reset position button
  console.log('Clicking reset position button...');
  await resetBtn.click({ force: true });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'frontend/evidence/part_c_walk_reset.png' });
  console.log('Saved frontend/evidence/part_c_walk_reset.png');

  await browser.close();
  console.log('--- PART C Verification SUCCESS ---');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
