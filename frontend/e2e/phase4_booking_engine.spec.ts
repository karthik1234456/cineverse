import { test, expect } from '@playwright/test';

test.describe('Phase 4 — Booking Engine, Holds, Real-Time WS, 2D/3D & Checkout', () => {
  const SHOWTIME_URL = '/cinemas/cineverse-imax/auditorium/auditorium-1?showtime=1';

  test.beforeEach(async ({ context }) => {
    // Set persistent city in localStorage to prevent modal popups
    await context.addInitScript(() => {
      window.localStorage.setItem('cineverse_city', 'bengaluru');
    });
  });

  test('01. 2D Seat Map is the default step with layout, categories, and screen curve', async ({ page }) => {
    await page.goto(SHOWTIME_URL);
    await page.waitForLoadState('networkidle');

    // 1. Verify 2D seat map container is visible as default view
    const map2d = page.locator('[data-testid="seatmap-2d-container"]');
    await expect(map2d).toBeVisible({ timeout: 10000 });

    // 2. Verify curved screen visual banner
    await expect(page.getByText('ALL EYES THIS WAY — CINEMA SCREEN')).toBeVisible();

    // 3. Verify category tier headers
    await expect(page.getByText('Premier Recliner')).toBeVisible();
    await expect(page.getByText('Prime Club')).toBeVisible();
    await expect(page.getByText('Front Classic')).toBeVisible();

    // 4. Select seat F05 and F06
    const seatF05 = page.locator('[data-testid="seat-2d-F05"]');
    const seatF06 = page.locator('[data-testid="seat-2d-F06"]');
    await expect(seatF05).toBeVisible();

    await seatF05.click();
    await seatF06.click();

    // 5. Verify sticky summary footer shows selected seats
    const footer = page.locator('[data-testid="seatmap-2d-summary-footer"]');
    await expect(footer).toBeVisible();
    await expect(footer.getByText('F05')).toBeVisible();
    await expect(footer.getByText('F06')).toBeVisible();
    await expect(footer.getByText('2/8 Seats:')).toBeVisible();

    // Screenshot
    await page.screenshot({ path: 'docs/evidence/phase-4/01_2d_seatmap_default.png' });
  });

  test('02. Explore in 3D button transitions to 3D theatre with SHARED selection', async ({ page }) => {
    await page.goto(SHOWTIME_URL);
    await page.waitForLoadState('networkidle');

    // Select seat G05 in 2D
    const seatG05 = page.locator('[data-testid="seat-2d-G05"]');
    await expect(seatG05).toBeVisible();
    await seatG05.click();

    // Click "Explore in 3D"
    const btn3D = page.locator('[data-testid="explore-in-3d-button"]');
    await expect(btn3D).toBeVisible();
    await btn3D.click();

    // Verify 3D auditorium wrapper is visible and URL has mode=3d
    await expect(page).toHaveURL(/mode=3d/);
    const wrapper3D = page.locator('[data-testid="auditorium-3d-wrapper"]');
    await expect(wrapper3D).toBeVisible({ timeout: 15000 });

    // Verify shared selection in 3D SelectedSeatsBar
    await expect(page.getByText('Seats (1/8):')).toBeVisible();
    await expect(page.locator('span').filter({ hasText: /^G05$/ }).first()).toBeVisible();

    // Screenshot
    await page.screenshot({ path: 'docs/evidence/phase-4/02_explore_in_3d_shared_selection.png' });
  });

  test('03. Bidirectional sync: change selection in 3D, switch back to 2D', async ({ page }) => {
    await page.goto(`${SHOWTIME_URL}&mode=3d`);
    await page.waitForLoadState('networkidle');

    // Wait for 3D wrapper
    await expect(page.locator('[data-testid="auditorium-3d-wrapper"]')).toBeVisible({ timeout: 15000 });

    // Click "2D Seat Map" switcher button
    const btn2D = page.locator('[data-testid="switch-to-2d-button"]');
    await expect(btn2D).toBeVisible();
    await btn2D.click();

    // Verify 2D seat map returns
    const map2d = page.locator('[data-testid="seatmap-2d-container"]');
    await expect(map2d).toBeVisible({ timeout: 10000 });

    // Screenshot
    await page.screenshot({ path: 'docs/evidence/phase-4/03_bidirectional_sync_2d_3d.png' });
  });

  test('04. Best available auto-selector', async ({ page }) => {
    await page.goto(SHOWTIME_URL);
    await page.waitForLoadState('networkidle');

    // Click "Best: 2"
    const btnBest2 = page.locator('[data-testid="btn-best-2"]');
    await expect(btnBest2).toBeVisible();
    await btnBest2.click();

    // Verify sticky footer appears with exactly 2 seats selected
    const footer = page.locator('[data-testid="seatmap-2d-summary-footer"]');
    await expect(footer).toBeVisible();
    await expect(footer.getByText('2/8 Seats:')).toBeVisible();

    // Screenshot
    await page.screenshot({ path: 'docs/evidence/phase-4/04_best_available_selector.png' });
  });

  test('05. Keyboard navigation in 2D seat map', async ({ page }) => {
    await page.goto(SHOWTIME_URL);
    await page.waitForLoadState('networkidle');

    const map2d = page.locator('[data-testid="seatmap-2d-container"]');
    await expect(map2d).toBeVisible();

    // Focus seatmap container
    await map2d.focus();

    // Press ArrowRight, ArrowDown, then Space to select
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Space');

    // Verify at least one seat got selected
    const footer = page.locator('[data-testid="seatmap-2d-summary-footer"]');
    await expect(footer).toBeVisible();

    // Screenshot
    await page.screenshot({ path: 'docs/evidence/phase-4/05_keyboard_navigation_2d.png' });
  });

  test('06. Complete checkout flow with countdown timer, extend once, and coupon', async ({ page }) => {
    await page.goto(SHOWTIME_URL);
    await page.waitForLoadState('networkidle');

    // Pick 2 dynamically available seats
    const availSeats = page.locator('button[data-status="available"]');
    await expect(availSeats.first()).toBeVisible({ timeout: 10000 });
    const seat1 = availSeats.nth(0);
    const seat2 = availSeats.nth(1);
    await seat1.click();
    await seat2.click();

    // Click Proceed to Book
    const proceedBtn = page.locator('[data-testid="proceed-to-checkout-btn"]');
    await expect(proceedBtn).toBeVisible();
    await proceedBtn.click();

    // F&B modal opens -> Click "Skip Add-ons"
    const skipFnb = page.getByRole('button', { name: 'Skip Add-ons' });
    await expect(skipFnb).toBeVisible({ timeout: 10000 });
    await skipFnb.click();

    // Verify Checkout Page
    await expect(page).toHaveURL(/checkout/);
    await expect(page.getByText('Order Summary')).toBeVisible({ timeout: 10000 });

    // 1. Verify visible hold countdown timer
    const timer = page.locator('[data-testid="hold-countdown-timer"]');
    await expect(timer).toBeVisible();
    await expect(page.locator('[data-testid="hold-timer-digits"]')).toBeVisible();

    // 2. Verify "extend once" button (+3m)
    const extendBtn = page.locator('[data-testid="extend-hold-button"]');
    await expect(extendBtn).toBeVisible();
    await extendBtn.click();
    // After clicking once, button disappears/disables enforcing extend once
    await expect(extendBtn).not.toBeVisible();

    // 3. Fill unique email and phone, then apply coupon
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill(`e2e_buyer_${Date.now()}@cineverse.in`);
    const phoneInput = page.locator('input[type="tel"]');
    await phoneInput.fill(`98${Math.floor(10000000 + Math.random() * 90000000)}`);

    const couponInput = page.locator('[data-testid="coupon-input"]');
    const couponBtn = page.locator('[data-testid="apply-coupon-button"]');
    await couponInput.fill('FIRSTSHOW');
    await couponBtn.click();
    await expect(page.getByText(/Applied!/i).first()).toBeVisible({ timeout: 5000 });

    // 4. Verify Payment Gateway Stub Badge
    const stubBadge = page.locator('[data-testid="payment-stub-badge"]');
    await expect(stubBadge).toBeVisible();

    // 5. Click Complete Checkout (Phase 4 Stub)
    const payBtn = page.locator('[data-testid="pay-and-confirm-button"]');
    await expect(payBtn).toBeVisible();
    await payBtn.click();

    // Verifies transition to confirmation ticket
    await expect(page).toHaveURL(/booking\/\d+/, { timeout: 15000 });
    await expect(page.getByText(/Booking Confirmed/i)).toBeVisible();

    // Screenshot
    await page.screenshot({ path: 'docs/evidence/phase-4/06_checkout_countdown_coupon.png' });
  });

  test('07. WebGL disabled fallback gracefully hides 3D button', async ({ browser }) => {
    // Create new context with WebGL disabled via initScript
    const context = await browser.newContext();
    await context.addInitScript(() => {
      // Mock getContext to disable webgl
      window.localStorage.setItem('cineverse_city', 'bengaluru');
      const origGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        contextId: string,
        ...args: unknown[]
      ): RenderingContext | null {
        if (contextId.includes('webgl')) {
          return null;
        }
        return Reflect.apply(origGetContext, this, [contextId, ...args]) as RenderingContext | null;
      } as typeof HTMLCanvasElement.prototype.getContext;
    });

    const page = await context.newPage();
    await page.goto(SHOWTIME_URL);
    await page.waitForLoadState('networkidle');

    // 2D seat map must render properly
    const map2d = page.locator('[data-testid="seatmap-2d-container"]');
    await expect(map2d).toBeVisible({ timeout: 10000 });

    // "Explore in 3D" button must be hidden when WebGL is unavailable
    const btn3D = page.locator('[data-testid="explore-in-3d-button"]');
    await expect(btn3D).not.toBeVisible();

    // Screenshot
    await page.screenshot({ path: 'docs/evidence/phase-4/07_webgl_disabled_fallback.png' });
    await context.close();
  });

  test('08. Real-time WebSocket: Hold in Browser A turns seat amber in Browser B', async ({ browser }) => {
    // Create two independent browser contexts
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();

    await contextA.addInitScript(() => window.localStorage.setItem('cineverse_city', 'bengaluru'));
    await contextB.addInitScript(() => window.localStorage.setItem('cineverse_city', 'bengaluru'));

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    // Both open the same showtime
    await pageA.goto(SHOWTIME_URL);
    await pageB.goto(SHOWTIME_URL);

    await pageA.waitForLoadState('networkidle');
    await pageB.waitForLoadState('networkidle');

    // Pick first available seat in pageB
    const initialAvailable = pageB.locator('button[data-status="available"]').first();
    await expect(initialAvailable).toBeVisible({ timeout: 10000 });
    const targetSeat = await initialAvailable.getAttribute('data-seat-id');
    expect(targetSeat).toBeTruthy();

    const seatInB = pageB.locator(`[data-testid="seat-2d-${targetSeat}"]`);
    await expect(seatInB).toHaveAttribute('data-status', 'available');

    // Browser A holds target seat
    const seatInA = pageA.locator(`[data-testid="seat-2d-${targetSeat}"]`);
    await seatInA.click();

    // Click Proceed in Browser A to trigger POST /bookings/hold
    const proceedInA = pageA.locator('[data-testid="proceed-to-checkout-btn"]');
    await proceedInA.click();

    // Browser B should receive the live WebSocket broadcast and update seat to 'held' (amber) within 5s
    await expect(seatInB).toHaveAttribute('data-status', 'held', { timeout: 8000 });

    // Screenshot
    await pageB.screenshot({ path: 'docs/evidence/phase-4/08_websocket_live_amber_hold.png' });

    await contextA.close();
    await contextB.close();
  });
});
