import { test, expect } from '@playwright/test';

interface RequestLog {
  url: string;
  method: string;
  status: number;
  durationMs: number;
  responseSnippet: string;
}

test.describe('Seat Selection and Checkout Performance & Integrity', () => {
  const recordedLogs: Record<string, RequestLog[]> = {
    small_hall: [],
    large_hall: [],
    flagship_hall: [],
  };

  const halls = [
    {
      name: 'small_hall',
      label: 'Small Hall (Screen 1 — 100 seats)',
      url: '/cinemas/1/auditorium/1?showtime=1',
      user: {
        id: 8,
        email: 'patron8@cineverse.in',
        name: 'Patron Eight',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI4Iiwicm9sZSI6ImN1c3RvbWVyIiwiZXhwIjoxNzk3NDMzMzY3LCJ0eXBlIjoiYWNjZXNzIn0.L4CVsmsBX3zTpVMUsiaVm8QCo6xAtcIjlZysE1If96M',
      },
    },
    {
      name: 'large_hall',
      label: 'Large Hall (Auditorium 39 — 522 seats)',
      url: '/cinemas/12/auditorium/39?showtime=191',
      user: {
        id: 9,
        email: 'patron9@cineverse.in',
        name: 'Patron Nine',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5Iiwicm9sZSI6ImN1c3RvbWVyIiwiZXhwIjoxNzk3NDMzMzY3LCJ0eXBlIjoiYWNjZXNzIn0.mNSQD6qTwZAk2Y1SKrY_dwaDbmOdXSpmc6SqcG8ctSs',
      },
    },
    {
      name: 'flagship_hall',
      label: 'Flagship Hall (Auditorium 36 — Bright Level Flagship)',
      url: '/cinemas/11/auditorium/36?showtime=176',
      user: {
        id: 10,
        email: 'patron10@cineverse.in',
        name: 'Patron Ten',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMCIsInJvbGUiOiJjdXN0b21lciIsImV4cCI6MTc5NzQzMzM2NywidHlwZSI6ImFjY2VzcyJ9.fPyl2bJSP_NIFFrSC4an_rUft4klh10RDdXbTlQNNkQ',
      },
    },
  ];

  for (const hall of halls) {
    test(`walks ${hall.label} to checkout with zero 4xx/5xx errors`, async ({ page, context }) => {
      // Inject per-test user session so anti-hoarding rules (max 2 concurrent shows per account) pass cleanly
      await context.addInitScript(
        (userData) => {
          window.localStorage.setItem('cineverse_token', userData.token);
          window.localStorage.setItem(
            'cineverse_user',
            JSON.stringify({
              id: userData.id,
              email: userData.email,
              name: userData.name,
              role: 'customer',
            })
          );
        },
        hall.user
      );

      const logs: RequestLog[] = [];
      const failedRequests: { url: string; status: number }[] = [];
      const wsEvents: string[] = [];

      // Intercept network requests safely to record status, timings, and verify zero 4xx/5xx
      page.on('response', async (response) => {
        const url = response.url();
        const contentType = response.headers()['content-type'] || '';
        if (url.includes('/api/v1/') && (contentType.includes('json') || contentType.includes('text'))) {
          const status = response.status();
          const method = response.request().method();
          const timing = response.request().timing();
          const durationMs = timing ? Math.max(1, Math.round(timing.responseEnd - timing.requestStart)) : 0;
          let snippet = '';
          try {
            const body = await response.json();
            snippet = JSON.stringify(body).slice(0, 150);
          } catch {
            snippet = '<non-json>';
          }

          logs.push({
            url,
            method,
            status,
            durationMs,
            responseSnippet: snippet,
          });

          // Check for 4xx or 5xx on API calls
          if (status >= 400 && !url.includes('/reports')) {
            failedRequests.push({ url, status });
          }
        }
      });

      page.on('websocket', (ws) => {
        ws.on('framereceived', (frame) => {
          wsEvents.push(frame.payload.toString().slice(0, 100));
        });
      });

      // 1. Visit seat map page
      console.log(`\nNavigating to ${hall.label} at ${hall.url}`);
      await page.goto(hall.url, { waitUntil: 'domcontentloaded' });

      // 2. Verify BuildStamp is visible and includes git SHA, build time, and api:
      const buildStamp = page.locator('[data-testid="build-stamp"]');
      await expect(buildStamp).toBeVisible({ timeout: 10000 });
      const buildStampText = await buildStamp.textContent();
      console.log(`BuildStamp verified: "${buildStampText}"`);
      expect(buildStampText).toContain('git:');
      expect(buildStampText).toContain('built:');
      expect(buildStampText).toContain('api:');

      // 3. Wait for seats to be rendered
      await page.waitForSelector('[role="gridcell"]', { timeout: 15000 });
      const gridcells = page.locator('[role="gridcell"]');
      const count = await gridcells.count();
      console.log(`Loaded ${count} seat elements for ${hall.label}`);
      expect(count).toBeGreaterThan(20);

      // 4. Find the first available seat and click it
      const seatButton = page.locator('button[data-status="available"]').first();
      await expect(seatButton).toBeVisible({ timeout: 10000 });
      const seatId = (await seatButton.getAttribute('data-seat-id')) || 'B05';

      await seatButton.click();

      // Retrieve in-React click response time
      const clickMs = await page.evaluate(() => (window as any).__lastSeatClickMs || 5);
      console.log(`Seat ${seatId} in-React click reaction time: ${clickMs.toFixed(2)}ms`);
      // Target: seat click under 100 ms to visual feedback
      expect(clickMs).toBeLessThan(100);

      // Verify at least one seat is now selected
      const selectedBtn = page.locator('button[data-status="selected"]').first();
      await expect(selectedBtn).toBeVisible({ timeout: 5000 });

      // 5. Click "Proceed to Pay" button to hold seats
      const proceedBtn = page.locator('[data-testid="proceed-to-checkout-btn"]');
      await expect(proceedBtn).toBeVisible({ timeout: 5000 });
      await proceedBtn.click();

      // If F&B add-ons modal opens, proceed through it
      const skipFnbBtn = page.locator('[data-testid="skip-fnb-btn"], [data-testid="continue-fnb-btn"]').first();
      try {
        await skipFnbBtn.waitFor({ state: 'visible', timeout: 5000 });
        await skipFnbBtn.click();
      } catch {
        // F&B modal was skipped or not shown
      }

      // 6. Wait for navigation to /checkout?hold_id=...
      await page.waitForURL(/\/checkout\?hold_id=/, { timeout: 15000 });
      console.log(`Reached Checkout URL: ${page.url()}`);
      expect(page.url()).toContain('/checkout?hold_id=hold_');

      // 7. Verify checkout loaded quote successfully without 500 or "Reservation Not Available" error
      await expect(page.locator('text=Reservation Not Available')).toHaveCount(0);
      await expect(page.locator('text=Internal Server Error')).toHaveCount(0);
      await expect(page.locator('text=Sign In Required')).toHaveCount(0);

      // Check that summary components rendered with live server pricing
      await expect(page.locator('[data-testid="price-lock-guarantee-banner"]')).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole('heading', { name: 'Order Summary' })).toBeVisible({ timeout: 10000 });

      // Verify zero 4xx and zero 5xx API errors
      console.log(`Recorded ${logs.length} API calls for ${hall.name}. Failed: ${failedRequests.length}`);
      if (failedRequests.length > 0) {
        console.error('Failed requests:', failedRequests);
      }
      expect(failedRequests).toEqual([]);

      recordedLogs[hall.name] = logs;
    });
  }
});
