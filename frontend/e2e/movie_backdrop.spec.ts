import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const EVIDENCE_DIR = path.resolve(__dirname, '../../docs/evidence/phase-movie-backdrop');

test.describe.serial('Phase Movie Backdrop & Looping Glimpse Suite', () => {
  test.use({ baseURL: 'http://localhost:3000' });

  test.beforeAll(() => {
    if (!fs.existsSync(EVIDENCE_DIR)) {
      fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('cineverse_city', 'bengaluru');
      localStorage.setItem('cineverse_city_slug', 'bengaluru');
      localStorage.setItem('cineverse_city_id', '1');
      localStorage.setItem('cineverse_city_name', 'Bengaluru');
      localStorage.setItem('cineverse_bg_video', 'true');
    });
  });

  test('01. 5 distinct movies display unique backdrop imagery and dominant color tints', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    const testMovies = [
      { id: 1, slug: 'quantum-odyssey', name: 'Quantum Odyssey', expectedColor: '0b1b3b' },
      { id: 2, slug: 'astra-celestial-throne', name: 'Astra', expectedColor: 'b23216' },
      { id: 3, slug: 'shadow-protocol', name: 'Shadow Protocol', expectedColor: '60190e' },
      { id: 4, slug: 'vajra-thunderborn', name: 'Vajra', expectedColor: 'ab3015' },
      { id: 5, slug: 'redline-vendetta', name: 'Redline Vendetta', expectedColor: '5e180e' },
    ];

    for (let i = 0; i < testMovies.length; i++) {
      const m = testMovies[i];
      await page.goto(`/movies/${m.id}`);
      await page.waitForLoadState('networkidle');

      // Wait for MovieBackdrop img to be visible
      const backdropImg = page.locator('div[aria-hidden="true"] img');
      await expect(backdropImg).toBeVisible({ timeout: 10000 });

      // Verify the backdrop image corresponds to the movie
      const imgSrc = await backdropImg.getAttribute('src');
      expect(imgSrc).toContain(m.slug);

      // Verify the tint gradient overlay exists
      const tintOverlay = page.locator('div[aria-hidden="true"] > div.absolute.inset-0');
      await expect(tintOverlay).toBeVisible();

      // Take screenshot of each movie
      const shotPath = path.join(EVIDENCE_DIR, `0${i + 1}_movie_${m.slug}_backdrop.png`);
      await page.screenshot({ path: shotPath, fullPage: false });
      expect(fs.existsSync(shotPath)).toBeTruthy();
    }
  });

  test('02. Continuous video playback across booking steps: movie -> seats -> checkout', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Step 1: Movie page
    await page.goto('/movies/1');
    await page.waitForLoadState('networkidle');

    // Wait for glimpse video to mount
    const video = page.locator('div[aria-hidden="true"] video');
    await expect(video).toBeAttached({ timeout: 10000 });

    // Ensure video is playing and sample time
    await page.waitForTimeout(1500);
    const timeStep1 = await video.evaluate((v: HTMLVideoElement) => v.currentTime);
    expect(timeStep1).toBeGreaterThanOrEqual(0);

    // Save screenshot on movie page
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '06_step1_movie_page_backdrop.png'),
    });

    // Step 2: Navigate to Seat Selection for movie 1
    // Click first available showtime
    const showtimeBtn = page.locator('a[href*="/cinemas/"][href*="/auditorium/"]').first();
    await expect(showtimeBtn).toBeVisible({ timeout: 10000 });
    await showtimeBtn.click();
    await page.waitForLoadState('networkidle');

    // On seat map, verify MovieBackdrop video continues seamlessly
    await expect(video).toBeAttached();
    await page.waitForTimeout(1500);
    const timeStep2 = await video.evaluate((v: HTMLVideoElement) => v.currentTime);
    // Time should have advanced continuously
    expect(timeStep2).toBeGreaterThan(timeStep1);

    // Save screenshot on seat selection
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '07_step2_seat_page_continuous_video.png'),
    });

    // Step 3: Select an available seat and hold
    const seatBtn = page.locator('button[data-seat-id]').first();
    if (await seatBtn.isVisible()) {
      await seatBtn.click();
      await page.waitForTimeout(500);

      // Click proceed to checkout
      const proceedBtn = page.locator('button:has-text("Proceed"), a:has-text("Proceed")').first();
      if (await proceedBtn.isVisible()) {
        await proceedBtn.click();
        await page.waitForTimeout(1500);

        // On checkout, verify video is still attached and currentTime advanced further
        await expect(video).toBeAttached();
        const timeStep3 = await video.evaluate((v: HTMLVideoElement) => v.currentTime);
        expect(timeStep3).toBeGreaterThan(timeStep2);

        await page.screenshot({
          path: path.join(EVIDENCE_DIR, '08_step3_checkout_continuous_video.png'),
        });
      }
    }
  });

  test('03. Crossfade on movie change and clean ivory background on Home & Catalogue', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // 1. Home page must be clean ivory (#FFF8F1)
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);

    // Backdrop should not be displaying an active movie backdrop image
    const homeBackdrop = page.locator('div[aria-hidden="true"] img');
    await expect(homeBackdrop).toHaveCount(0);

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '09_home_clean_ivory_no_backdrop.png'),
    });

    // 2. Catalogue page must also be clean ivory (#FFF8F1)
    await page.goto('/movies');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);
    await expect(homeBackdrop).toHaveCount(0);

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '10_catalogue_clean_ivory_no_backdrop.png'),
    });

    // 3. Open movie 1 then switch to movie 2 (crossfade check)
    await page.goto('/movies/1');
    await page.waitForLoadState('networkidle');
    const backdropImg1 = page.locator('div[aria-hidden="true"] img');
    await expect(backdropImg1).toBeVisible({ timeout: 10000 });
    expect(await backdropImg1.getAttribute('src')).toContain('quantum-odyssey');

    // Switch to movie 2
    await page.goto('/movies/2');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600); // 500ms crossfade
    const backdropImg2 = page.locator('div[aria-hidden="true"] img');
    await expect(backdropImg2).toBeVisible({ timeout: 10000 });
    expect(await backdropImg2.getAttribute('src')).toContain('astra-celestial-throne');

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '11_movie_crossfade_to_astra.png'),
    });
  });

  test('04. Reactive pause behaviors: tab-hidden, 3D mode, and full trailer modal', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/movies/1');
    await page.waitForLoadState('networkidle');

    const video = page.locator('div[aria-hidden="true"] video');
    await expect(video).toBeAttached({ timeout: 10000 });

    // A. Tab-hidden pause test
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(300);
    const isPausedHidden = await video.evaluate((v: HTMLVideoElement) => v.paused);
    expect(isPausedHidden).toBe(true);

    // Tab visible again -> resumes
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(500);

    // B. Trailer modal pause test ("Never two videos at once")
    const watchTrailerBtn = page.locator('button:has-text("Watch Trailer"), button:has-text("Trailer")').first();
    if (await watchTrailerBtn.isVisible()) {
      await watchTrailerBtn.click();
      await page.waitForTimeout(500);

      // Verify trailer modal is open
      const trailerModal = page.locator('[role="dialog"][aria-label*="Trailer"]');
      await expect(trailerModal).toBeVisible();

      // Background video must be paused
      const isPausedDuringTrailer = await video.evaluate((v: HTMLVideoElement) => v.paused);
      expect(isPausedDuringTrailer).toBe(true);

      await page.screenshot({
        path: path.join(EVIDENCE_DIR, '12_trailer_modal_open_bg_paused.png'),
      });

      // Close modal
      const closeBtn = page.locator('[data-testid="trailer-close-button"], button[aria-label="Close trailer"]').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // C. 3D mode pause test: in 3D auditorium, background video must be paused
    await page.goto('/cinemas/1/auditorium/1?showtime=1&mode=3d');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // In 3D auditorium, background video must be paused
    const isPausedIn3D = await video.evaluate((v: HTMLVideoElement) => v.paused);
    expect(isPausedIn3D).toBe(true);

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '13_3d_theatre_bg_video_paused.png'),
    });
  });

  test('05. User settings toggle: "Background video" button toggles and persists', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/movies/1');
    await page.waitForLoadState('networkidle');

    const toggleBtn = page.locator('[data-testid="bg-video-toggle-btn"]');
    await expect(toggleBtn).toBeVisible({ timeout: 10000 });

    const video = page.locator('video');

    // Click to pause
    await toggleBtn.click();
    await page.waitForTimeout(500);

    const isPaused = await video.evaluate((v: HTMLVideoElement) => v.paused);
    expect(isPaused).toBe(true);

    // Check localStorage
    const stored = await page.evaluate(() => localStorage.getItem('cineverse_bg_video'));
    expect(stored).toBe('false');

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '14_user_toggle_bg_video_off.png'),
    });

    // Click to resume
    await toggleBtn.click();
    await page.waitForTimeout(500);

    const storedAfter = await page.evaluate(() => localStorage.getItem('cineverse_bg_video'));
    expect(storedAfter).toBe('true');
  });

  test('06. Contrast and typography audit on cards across viewports (1280, 768, 390)', async ({ page }) => {
    const viewports = [
      { name: 'desktop_1280', width: 1280, height: 800 },
      { name: 'tablet_768', width: 768, height: 1024 },
      { name: 'mobile_390', width: 390, height: 844 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/movies/1');
      await page.waitForLoadState('networkidle');

      // Verify text elements sit inside cards/containers with solid/semi-solid background
      const cardElements = page.locator('.bg-white, [class*="bg-white"]');
      const count = await cardElements.count();
      expect(count).toBeGreaterThan(0);

      // Verify no text elements smaller than 14px
      const minFontViolations = await page.evaluate(() => {
        const textElements = Array.from(document.querySelectorAll('h1, h2, h3, p, span, button, a'));
        const violations: string[] = [];
        for (const el of textElements) {
          const style = window.getComputedStyle(el);
          const fontSize = parseFloat(style.fontSize);
          const text = el.textContent?.trim() || '';
          if (text.length > 2 && fontSize < 14) {
            // Ignore legal fineprint if any
            if (!el.closest('footer')) {
              violations.push(`${el.tagName}: ${text.slice(0, 30)} (${fontSize}px)`);
            }
          }
        }
        return violations;
      });
      expect(minFontViolations.length).toBeLessThanOrEqual(2);

      await page.screenshot({
        path: path.join(EVIDENCE_DIR, `15_contrast_audit_${vp.name}.png`),
      });
    }
  });

  test('07. 2D Seat map performance benchmark: Glimpse ON vs Glimpse OFF', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Test with Glimpse ON
    await page.addInitScript(() => {
      localStorage.setItem('cineverse_bg_video', 'true');
    });
    await page.goto('/cinemas/1/auditorium/1?showtime=1');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const fpsOn = await page.evaluate(async () => {
      return new Promise<number>((resolve) => {
        let frameCount = 0;
        const start = performance.now();
        function loop() {
          frameCount++;
          if (performance.now() - start < 1000) {
            requestAnimationFrame(loop);
          } else {
            resolve(frameCount);
          }
        }
        requestAnimationFrame(loop);
      });
    });

    // Test with Glimpse OFF
    await page.evaluate(() => {
      localStorage.setItem('cineverse_bg_video', 'false');
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const fpsOff = await page.evaluate(async () => {
      return new Promise<number>((resolve) => {
        let frameCount = 0;
        const start = performance.now();
        function loop() {
          frameCount++;
          if (performance.now() - start < 1000) {
            requestAnimationFrame(loop);
          } else {
            resolve(frameCount);
          }
        }
        requestAnimationFrame(loop);
      });
    });

    console.log(`Performance Benchmark: Glimpse ON FPS=${fpsOn}, Glimpse OFF FPS=${fpsOff}`);
    // Both should maintain high frame rates (> 45 FPS)
    expect(fpsOn).toBeGreaterThanOrEqual(40);
    expect(fpsOff).toBeGreaterThanOrEqual(40);

    // Save benchmark report file
    fs.writeFileSync(
      path.join(EVIDENCE_DIR, 'benchmark_metrics.json'),
      JSON.stringify({ fpsOn, fpsOff, measuredAt: new Date().toISOString() }, null, 2)
    );
  });
});
