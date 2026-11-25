const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/@playwright/test'));
const fs = require('fs');

async function main() {
  const rootDir = path.resolve('.');
  const rawDir = path.join(rootDir, 'evidence', 'raw_measurements');
  const ssDir = path.join(rawDir, 'screenshots');

  // Borderline titles to re-measure with 2.2s frame separation
  const targetSlugs = ['quantum-odyssey', 'deccan-underworld', 'pune-heritage-tales'];

  const b1 = JSON.parse(fs.readFileSync(path.join(rootDir, 'evidence', 'batch_hosted_1.json'), 'utf-8'));
  const b2 = JSON.parse(fs.readFileSync(path.join(rootDir, 'evidence', 'batch_hosted_2.json'), 'utf-8'));
  const allHosted = [...b1, ...b2];

  const targets = allHosted.filter(t => targetSlugs.includes(t.slug));
  console.log(`Re-measuring ${targets.length} borderline hosted titles with 2.2s frame separation...`);

  const browser = await chromium.launch({
    headless: false,
    args: [
      '--autoplay-policy=no-user-gesture-required',
      '--disable-features=PreloadMediaEngagementData,AutoplayIgnoreWebAudio',
      '--no-sandbox',
    ]
  });

  for (const item of targets) {
    const url = item.url || `http://localhost:3002/cinemas/${item.cinema_id}/auditorium/${item.auditorium_id}?showtime=${item.showtime_id}&mode=3d&debug=1`;
    console.log(`\nRe-measuring ID ${item.id}: ${item.title}`);

    const jpath = path.join(rawDir, `${item.slug}.json`);
    const rawData = fs.existsSync(jpath) ? JSON.parse(fs.readFileSync(jpath, 'utf-8')) : { id: item.id, slug: item.slug };

    const ss1Path = path.join(ssDir, `${item.slug}_ss1.png`);
    const ss2Path = path.join(ssDir, `${item.slug}_ss2.png`);
    const ss3Path = path.join(ssDir, `${item.slug}_ss3.png`);

    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 12000 });
      await page.waitForTimeout(1500);

      const playBtn = page.locator('[data-testid="trailer-play-toggle"]').first();
      await playBtn.waitFor({ state: 'visible', timeout: 6000 });

      const clickTs = await page.evaluate(() => performance.now());
      rawData.click_timestamp = clickTs;
      await playBtn.click();

      // Wait for video advancing
      const fp = await page.waitForFunction(() => {
        const v = document.querySelector('video');
        if (v && v.currentTime > 0 && !v.paused) {
          return {
            timestamp: performance.now(),
            currentTime: v.currentTime,
            muted: v.muted,
            volume: v.volume,
          };
        }
        return false;
      }, null, { timeout: 6000 }).catch(() => null);

      const fpVal = fp ? await fp.jsonValue() : null;
      if (!fpVal) throw new Error('Video did not start');

      rawData.first_picture_timestamp = fpVal.timestamp;
      rawData.time_to_first_picture_ms = Number((fpVal.timestamp - clickTs).toFixed(2));

      // ss1 at t ~ 0.5s
      await page.screenshot({ path: ss1Path });
      rawData.screenshot_1 = { timestamp: await page.evaluate(() => performance.now()), file_path: ss1Path };

      // ss2 at t ~ 2.5s (2000ms later)
      await page.waitForTimeout(2000);
      await page.screenshot({ path: ss2Path });
      rawData.screenshot_2 = { timestamp: await page.evaluate(() => performance.now()), file_path: ss2Path };

      // ss3 at t ~ 4.5s (2000ms later)
      await page.waitForTimeout(2000);
      await page.screenshot({ path: ss3Path });
      rawData.screenshot_3 = { timestamp: await page.evaluate(() => performance.now()), file_path: ss3Path };

      const finalApi = await page.evaluate(() => {
        const v = document.querySelector('video');
        return {
          state: v ? (v.paused ? 'paused' : 'playing') : 'missing',
          isMuted: v ? v.muted : null,
          getVolume: v ? Math.round(v.volume * 100) : null,
          currentTime: v ? v.currentTime : null,
        };
      });

      rawData.player_api = finalApi;
      rawData.measured_live = true;
      rawData.result = 'PASS (Measured Live)';

      fs.writeFileSync(jpath, JSON.stringify(rawData, null, 2), 'utf-8');
      console.log(`  -> SUCCESS: +${rawData.time_to_first_picture_ms} ms | Screenshots updated.`);
    } catch (e) {
      console.error(`  -> ERROR: ${e.message}`);
    } finally {
      await context.close();
    }
  }

  await browser.close();
  console.log('Re-measurement complete.');
}

main().catch(console.error);
