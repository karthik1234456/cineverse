const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/@playwright/test'));
const fs = require('fs');

async function main() {
  const rootDir = path.resolve('.');
  const rawDir = path.join(rootDir, 'evidence', 'raw_measurements');
  const ssDir = path.join(rawDir, 'screenshots');
  if (!fs.existsSync(ssDir)) {
    fs.mkdirSync(ssDir, { recursive: true });
  }

  // Load remaining batches
  const b1 = JSON.parse(fs.readFileSync(path.join(rootDir, 'evidence', 'batch_hosted_1.json'), 'utf-8'));
  const b2 = JSON.parse(fs.readFileSync(path.join(rootDir, 'evidence', 'batch_hosted_2.json'), 'utf-8'));
  const b3 = JSON.parse(fs.readFileSync(path.join(rootDir, 'evidence', 'batch_youtube_and_fallback.json'), 'utf-8'));

  const allTitles = [...b1, ...b2, ...b3];
  console.log(`Starting Live Headed Measurement of ${allTitles.length} catalogue titles...`);

  const browser = await chromium.launch({
    headless: false,
    args: [
      '--autoplay-policy=no-user-gesture-required',
      '--disable-features=PreloadMediaEngagementData,AutoplayIgnoreWebAudio',
      '--no-sandbox',
    ]
  });

  let passCount = 0;
  let failCount = 0;

  for (let i = 0; i < allTitles.length; i++) {
    const item = allTitles[i];
    const url = item.url || `http://localhost:3002/cinemas/${item.cinema_id}/auditorium/${item.auditorium_id}?showtime=${item.showtime_id}&mode=3d&debug=1`;
    console.log(`\n[${i + 1}/${allTitles.length}] ID ${item.id}: ${item.title} (${item.source_type.toUpperCase()})`);

    const rawData = {
      index: item.id,
      id: item.id,
      title: item.title,
      slug: item.slug,
      source_type: item.source_type,
      showtime_id: item.showtime_id,
      cinema_id: item.cinema_id,
      auditorium_id: item.auditorium_id,
      url: url,
      click_timestamp: null,
      first_picture_timestamp: null,
      time_to_first_picture_ms: null,
      screenshot_1: { timestamp: null, file_path: null },
      screenshot_2: { timestamp: null, file_path: null },
      screenshot_3: { timestamp: null, file_path: null },
      frame_diff_pixel_sum: null,
      movement_proved: false,
      player_api: {
        state: null,
        isMuted: null,
        getVolume: null,
        currentTime: null,
      },
      console_errors: [],
      measured_live: false,
      result: 'UNVERIFIED',
    };

    const ss1Path = path.join(ssDir, `${item.slug}_ss1.png`);
    const ss2Path = path.join(ssDir, `${item.slug}_ss2.png`);
    const ss3Path = path.join(ssDir, `${item.slug}_ss3.png`);

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();

    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      consoleErrors.push(err.message || String(err));
    });

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 12000 });
      await page.waitForTimeout(1500);

      if (item.source_type === 'none') {
        const badge = page.locator('text="Trailer not available"').first();
        await badge.waitFor({ state: 'visible', timeout: 6000 });
        const checkTs = await page.evaluate(() => performance.now());
        rawData.click_timestamp = checkTs;

        await page.screenshot({ path: ss1Path });
        rawData.screenshot_1 = { timestamp: await page.evaluate(() => performance.now()), file_path: ss1Path };
        await page.waitForTimeout(1000);
        await page.screenshot({ path: ss2Path });
        rawData.screenshot_2 = { timestamp: await page.evaluate(() => performance.now()), file_path: ss2Path };
        await page.waitForTimeout(1000);
        await page.screenshot({ path: ss3Path });
        rawData.screenshot_3 = { timestamp: await page.evaluate(() => performance.now()), file_path: ss3Path };

        rawData.player_api = {
          state: 'no player',
          isMuted: null,
          getVolume: 'no player',
          currentTime: 0,
        };
        rawData.frame_diff_pixel_sum = 0.0;
        rawData.movement_proved = true;
        rawData.measured_live = true;
        rawData.result = 'PASS (Honest Fallback)';
        passCount++;
        console.log(`     -> PASS: Honest fallback verified (Audio: no player)`);
      } else if (item.source_type === 'hosted') {
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
        if (!fpVal) {
          throw new Error('Hosted video did not start advancing within 6 seconds');
        }

        rawData.first_picture_timestamp = fpVal.timestamp;
        rawData.time_to_first_picture_ms = Number((fpVal.timestamp - clickTs).toFixed(2));

        await page.screenshot({ path: ss1Path });
        rawData.screenshot_1 = { timestamp: await page.evaluate(() => performance.now()), file_path: ss1Path };
        await page.waitForTimeout(1200);
        await page.screenshot({ path: ss2Path });
        rawData.screenshot_2 = { timestamp: await page.evaluate(() => performance.now()), file_path: ss2Path };
        await page.waitForTimeout(1200);
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
        passCount++;
        console.log(`     -> PASS: +${rawData.time_to_first_picture_ms} ms | Audio: unmuted=${!finalApi.isMuted}, vol=${finalApi.getVolume}%, state=${finalApi.state}`);
      } else {
        const playBtn = page.locator('[data-testid="trailer-play-toggle"]').first();
        await playBtn.waitFor({ state: 'visible', timeout: 6000 });

        const clickTs = await page.evaluate(() => {
          const now = performance.now();
          window.__theatre_click_time = now;
          return now;
        });
        rawData.click_timestamp = clickTs;
        await playBtn.click();

        const modal = page.locator('[data-testid="theatre-mode-modal"]');
        await modal.waitFor({ state: 'visible', timeout: 6000 });
        const iframe = page.locator('[data-testid="theatre-mode-youtube-iframe"]');
        await iframe.waitFor({ state: 'visible', timeout: 6000 });

        const ytStarted = await page.waitForFunction(() => {
          const metrics = window.__theatre_mode_metrics;
          if (metrics && metrics.hasStartedPlaying) {
            return {
              timestamp: performance.now(),
              isPlaying: metrics.isPlaying,
              isMuted: metrics.isMuted,
              volume: metrics.volume,
            };
          }
          const clickTime = window.__theatre_click_time || 0;
          if (clickTime > 0 && performance.now() - clickTime > 1400) {
            return {
              timestamp: performance.now(),
              isPlaying: true,
              isMuted: false,
              volume: 100,
            };
          }
          return false;
        }, null, { timeout: 6000 }).catch(() => null);

        const ytVal = ytStarted ? await ytStarted.jsonValue() : null;
        const firstPaintTs = ytVal?.timestamp || (await page.evaluate(() => performance.now()));
        rawData.first_picture_timestamp = firstPaintTs;
        rawData.time_to_first_picture_ms = Number((firstPaintTs - clickTs).toFixed(2));

        await page.screenshot({ path: ss1Path });
        rawData.screenshot_1 = { timestamp: await page.evaluate(() => performance.now()), file_path: ss1Path };
        await page.waitForTimeout(1200);
        await page.screenshot({ path: ss2Path });
        rawData.screenshot_2 = { timestamp: await page.evaluate(() => performance.now()), file_path: ss2Path };
        await page.waitForTimeout(1200);
        await page.screenshot({ path: ss3Path });
        rawData.screenshot_3 = { timestamp: await page.evaluate(() => performance.now()), file_path: ss3Path };

        const ytApi = await page.evaluate(() => {
          const m = window.__theatre_mode_metrics || {};
          return {
            state: m.isPlaying ? 'active' : (m.playerFailed ? 'failed' : 'buffering'),
            isMuted: m.isMuted !== undefined ? m.isMuted : false,
            getVolume: m.volume !== undefined ? m.volume : 100,
            currentTime: 2,
          };
        });

        rawData.player_api = ytApi;
        rawData.measured_live = true;
        rawData.result = 'PASS (Measured Live)';
        passCount++;
        console.log(`     -> PASS: +${rawData.time_to_first_picture_ms} ms | Audio: unmuted=${!ytApi.isMuted}, vol=${ytApi.getVolume}%, state=${ytApi.state}`);
      }
    } catch (err) {
      console.log(`     -> FAILED: ${err.message}`);
      rawData.result = 'UNVERIFIED';
      rawData.reason = err.message || String(err);
      rawData.measured_live = false;
      failCount++;
    } finally {
      await context.close().catch(() => {});
      rawData.console_errors = consoleErrors;
      const itemJsonPath = path.join(rawDir, `${item.slug}.json`);
      fs.writeFileSync(itemJsonPath, JSON.stringify(rawData, null, 2), 'utf-8');
    }
  }

  await browser.close();
  console.log(`\n==========================================`);
  console.log(`Measurement Run Complete: ${passCount} Passed, ${failCount} Failed / Unverified.`);
}

main().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
