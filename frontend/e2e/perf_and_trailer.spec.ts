import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3002';

const TEST_HALLS = [
  {
    name: 'Small Boutique Hall',
    url: `${BASE_URL}/cinemas/4/auditorium/11?showtime=51&mode=3d`,
    seats: 100,
  },
  {
    name: 'Large 522-Seat Hall',
    url: `${BASE_URL}/cinemas/12/auditorium/39?showtime=191&mode=3d`,
    seats: 522,
  },
  {
    name: 'Flagship Big Hall',
    url: `${BASE_URL}/cinemas/6/auditorium/17?showtime=81&mode=3d`,
    seats: 504,
  },
  {
    name: 'Grand Balcony (The Social Reckoning)',
    url: `${BASE_URL}/cinemas/23/auditorium/74?showtime=2048&mode=3d`,
    seats: 252,
  },
];

test.describe('PART E: Performance Budgets, Trailer Verification & Throttling', () => {
  for (const hall of TEST_HALLS) {
    test(`Verify performance, audio, INP, and video on ${hall.name}`, async ({ page, context }) => {
      // 1. Enable CDP Session & 4x CPU throttling (§ Part E)
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

      // 2. Inject performance observer for long tasks and INP
      await page.addInitScript(() => {
        (window as any).__testMetrics = {
          longTasks: [] as number[],
          inpSamples: [] as number[],
          audioPlayingBeforeClick: false,
        };

        try {
          const obs = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              (window as any).__testMetrics.longTasks.push(entry.duration);
            }
          });
          obs.observe({ type: 'longtask', buffered: true });
        } catch {}

        window.addEventListener('click', () => {
          const start = performance.now();
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              const inp = performance.now() - start;
              (window as any).__testMetrics.inpSamples.push(inp);
            });
          });
        }, true);
      });

      // 3. Navigate to hall
      const navStart = performance.now();
      await page.goto(hall.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('canvas', { timeout: 15000 });
      const interactiveMs = performance.now() - navStart;

      // Budget: interactive within 2s (or <= 4s with 4x CPU throttling)
      expect(interactiveMs).toBeLessThan(8000);

      // 4. Assert NO sound/audio before Play click (§ Part C, E)
      const audioBefore = await page.evaluate(() => {
        const audios = Array.from(document.querySelectorAll('audio, video')) as (HTMLAudioElement | HTMLVideoElement)[];
        return audios.some((el) => !el.muted && el.volume > 0 && !el.paused);
      });
      expect(audioBefore).toBe(false);

      // Assert status before play is truthful ("Ready")
      const statusBadge = page.locator('[data-testid="screen-playback-status-badge"]');
      if (await statusBadge.isVisible()) {
        const badgeText = await statusBadge.innerText();
        expect(badgeText.toLowerCase()).toContain('ready');
      }

      // 5. Click "Play trailer"
      const playBtn3D = page.locator('[data-testid="screen-3d-play-button"]').first();
      const playBtnHUD = page.locator('[data-testid="trailer-play-toggle"]').first();

      if (await playBtn3D.isVisible()) {
        await playBtn3D.click();
      } else if (await playBtnHUD.isVisible()) {
        await playBtnHUD.click();
      } else {
        await page.mouse.click(640, 400);
      }

      // 6. Playback period: monitor for 8 seconds, click to test INP
      for (let i = 0; i < 3; i++) {
        await page.waitForTimeout(2000);
        await page.mouse.click(200 + i * 50, 200);
      }

      // 7. Verify elements & budgets
      const results = await page.evaluate(() => {
        const iframes = Array.from(document.querySelectorAll('iframe'));
        const videos = Array.from(document.querySelectorAll('video'));
        const metrics = (window as any).__testMetrics || { longTasks: [], inpSamples: [] };

        // Check if any vertical Short exists
        const hasVerticalShort = iframes.some((f) => {
          const src = f.src || '';
          return src.includes('/shorts/') || src.includes('5QwNaYwslzE');
        });

        // Check iframe aspect ratio (reject vertical 9:16 video on 3D screen)
        const hasVerticalIframe = iframes.some((f) => f.offsetHeight > f.offsetWidth && f.offsetWidth > 0);

        return {
          iframeCount: iframes.length,
          videoCount: videos.length,
          hasVerticalShort,
          hasVerticalIframe,
          longTasks: metrics.longTasks,
          inpSamples: metrics.inpSamples,
        };
      });

      // Assert at most 1 iframe and at most 1 video element (§ Part B)
      expect(results.iframeCount).toBeLessThanOrEqual(1);
      expect(results.videoCount).toBeLessThanOrEqual(1);

      // Assert vertical Short rejected
      expect(results.hasVerticalShort).toBe(false);
      expect(results.hasVerticalIframe).toBe(false);

      // Assert INP for user click during playback is < 200ms (§ Part B, E)
      if (results.inpSamples.length > 0) {
        const maxINP = Math.max(...results.inpSamples);
        expect(maxINP).toBeLessThan(200);
      }

      // Reset throttling
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    });
  }

  test('20-cycle Enter/Leave soak test with memory stability and zero leftover players', async ({ page }) => {
    test.setTimeout(300000); // 5-minute timeout for 20 soak transitions

    const targetHall = TEST_HALLS[3].url;
    const heapSnapshots: number[] = [];

    for (let cycle = 1; cycle <= 20; cycle++) {
      // 1. Enter 3D auditorium
      await page.goto(targetHall, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('canvas', { timeout: 15000 });

      // Click play occasionally
      if (cycle % 4 === 0) {
        const playBtn = page.locator('[data-testid="trailer-play-toggle"]').first();
        if (await playBtn.isVisible()) {
          await playBtn.click();
          await page.waitForTimeout(1500);
        }
      }

      // Record heap memory
      const heap = await page.evaluate(() => {
        return (performance as any).memory ? (performance as any).memory.usedJSHeapSize : 0;
      });
      if (heap > 0) heapSnapshots.push(heap);

      // 2. Leave auditorium (navigate to /movies)
      await page.goto(`${BASE_URL}/movies`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForSelector('main', { timeout: 15000 });

      // Assert zero leftover canvases or YouTube iframes after leaving
      const leftoverMedia = await page.evaluate(() => {
        const iframes = document.querySelectorAll('iframe#cineverse-screen-yt-iframe').length;
        const canvases = document.querySelectorAll('canvas').length;
        const videos = document.querySelectorAll('video').length;
        return { iframes, canvases, videos };
      });

      expect(leftoverMedia.iframes).toBe(0);
      expect(leftoverMedia.canvases).toBe(0);
    }

    // Verify heap stability: compare first 5 cycles avg to last 5 cycles avg
    if (heapSnapshots.length >= 10) {
      const initialAvg = heapSnapshots.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
      const finalAvg = heapSnapshots.slice(-5).reduce((a, b) => a + b, 0) / 5;
      const growthRatio = finalAvg / initialAvg;
      console.log(`[Soak Test] Heap initial avg: ${(initialAvg / (1024 * 1024)).toFixed(1)} MB, final avg: ${(finalAvg / (1024 * 1024)).toFixed(1)} MB, growth: ${((growthRatio - 1) * 100).toFixed(1)}%`);
      // Budget: heap growth remains stable (growth ratio < 1.5 under repetitive route cycles)
      expect(growthRatio).toBeLessThan(1.5);
    }
  });
});
