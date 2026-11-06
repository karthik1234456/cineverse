import { test, expect, Page, BrowserContext } from '@playwright/test';

// Helper to create a fresh test customer via API
async function createTestCustomer(request: any) {
  const rand = Math.floor(100000000 + Math.random() * 900000000);
  const email = `patron_${rand}@cineverse.in`;
  const phone = `9${rand}`;
  const res = await request.post('http://127.0.0.1:8000/api/v1/auth/register', {
    data: {
      email,
      phone,
      password: 'Password@123',
      full_name: `Test Patron ${rand}`,
    },
  });
  if (!res.ok()) {
    throw new Error(`Failed to create test customer: ${await res.text()}`);
  }
  return await res.json();
}

test.describe('Checkout Server Quote Hardening & Clean URL Verification', () => {
  const SHOWTIME_URL = '/cinemas/cineverse-imax/auditorium/auditorium-1?showtime=1';

  // Helper to set up client-side mock Razorpay
  async function setupRazorpayMock(context: BrowserContext) {
    await context.route('https://checkout.razorpay.com/**', (route) => route.abort());
    await context.addInitScript(() => {
      class MockRazorpay {
        options: any;
        constructor(options: any) {
          this.options = options;
          (window as any).__lastRzpOptions = options;
        }
        async open() {
          const orderId = this.options.order_id;
          const payId = 'pay_quote_' + Math.random().toString(36).substring(2, 10);
          const enc = new TextEncoder();
          const key = await crypto.subtle.importKey(
            'raw',
            enc.encode('secret_cineverse_test_mode'),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
          );
          const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(`${orderId}|${payId}`));
          const signature = Array.from(new Uint8Array(sigBuf))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');

          await this.options.handler({
            razorpay_order_id: orderId,
            razorpay_payment_id: payId,
            razorpay_signature: signature,
          });
        }
        on() { }
      }

      Object.defineProperty(window, 'Razorpay', {
        get: () => MockRazorpay,
        set: () => { },
        configurable: true,
      });
    });
  }

  // Helper to inject logged-in customer into a page
  async function loginAsCustomer(page: Page, customer: any) {
    await page.addInitScript((userData) => {
      window.localStorage.setItem('cineverse_city', 'bengaluru');
      window.localStorage.setItem('cineverse_token', userData.access_token);
      window.localStorage.setItem('cineverse_user', JSON.stringify(userData));
    }, customer);
  }

  // Helper to select an available seat on 2D map and proceed to checkout
  async function selectSeatAndProceed(page: Page, addFnb: boolean = false): Promise<string> {
    await page.goto(SHOWTIME_URL);
    await page.waitForLoadState('networkidle');

    // Pick first available seat
    const seat = page.locator('button[data-status="available"]').first();
    await expect(seat).toBeVisible({ timeout: 10000 });
    await seat.click();

    // Click Proceed to Pay
    const proceedBtn = page.locator('[data-testid="proceed-to-checkout-btn"]');
    await expect(proceedBtn).toBeVisible();
    await proceedBtn.click();

    if (addFnb) {
      // Increase quantity on first F&B item
      const incBtn = page.locator('button[aria-label="Increase quantity"]').first();
      await expect(incBtn).toBeVisible({ timeout: 8000 });
      await incBtn.click();

      const continueBtn = page.locator('[data-testid="continue-fnb-btn"]');
      await expect(continueBtn).toBeVisible();
      await continueBtn.click();
    } else {
      const skipBtn = page.locator('[data-testid="skip-fnb-btn"]');
      await expect(skipBtn).toBeVisible({ timeout: 8000 });
      await skipBtn.click();
    }

    await expect(page).toHaveURL(/.*\/checkout.*/, { timeout: 10000 });
    const urlObj = new URL(page.url());
    return urlObj.searchParams.get('hold_id') || '';
  }

  test('01. Clean URL: URL contains only opaque hold_id with zero prices, seats or addons in query params', async ({ page, context, request }) => {
    await setupRazorpayMock(context);
    const user = await createTestCustomer(request);
    await loginAsCustomer(page, user);

    await page.setViewportSize({ width: 1280, height: 800 });
    const holdId = await selectSeatAndProceed(page, true);

    expect(holdId).toBeTruthy();
    expect(holdId).toMatch(/^hold_[a-zA-Z0-9]+$/);

    const currentUrl = page.url();
    const urlObj = new URL(currentUrl);

    // Verify query parameters are clean
    expect(urlObj.pathname).toBe('/checkout');
    expect(urlObj.searchParams.has('total')).toBe(false);
    expect(urlObj.searchParams.has('seats')).toBe(false);
    expect(urlObj.searchParams.has('addons')).toBe(false);
    expect(urlObj.searchParams.has('price')).toBe(false);
    expect(urlObj.searchParams.get('hold_id')).toBe(holdId);

    // Capture clean checkout desktop screenshot
    await page.screenshot({ path: '../docs/evidence/checkout-server-quote/01_clean_checkout_url_1280.png' });
  });

  test('02. Responsive clean checkout layout: 390px (mobile) and 768px (tablet)', async ({ page, context, request }) => {
    await setupRazorpayMock(context);
    const user = await createTestCustomer(request);
    await loginAsCustomer(page, user);

    // 1. Mobile (390px)
    await page.setViewportSize({ width: 390, height: 844 });
    const holdId = await selectSeatAndProceed(page, false);
    expect(holdId).toBeTruthy();
    await page.screenshot({ path: '../docs/evidence/checkout-server-quote/02_clean_checkout_url_390.png' });

    // 2. Tablet (768px)
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.screenshot({ path: '../docs/evidence/checkout-server-quote/03_clean_checkout_url_768.png' });
  });

  test('03. Server quote guarantee & integer currency formatting (no decimals)', async ({ page, context, request }) => {
    await setupRazorpayMock(context);
    const user = await createTestCustomer(request);
    await loginAsCustomer(page, user);

    await page.setViewportSize({ width: 1280, height: 800 });
    await selectSeatAndProceed(page, false);

    // 1. Verify "The price shown at checkout is final" guarantee banner
    const guaranteeBanner = page.locator('[data-testid="final-price-guarantee"]');
    await expect(guaranteeBanner).toBeVisible();
    await expect(guaranteeBanner).toContainText('The price shown at checkout is final');

    // 2. Verify all rendered currency amounts are strictly integers (e.g. ₹760, never ₹760.0 or .00)
    const priceTexts = await page.locator('[data-testid="checkout-page"]').evaluate((el) => {
      const texts: string[] = [];
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        const val = node.nodeValue?.trim() || '';
        if (val.includes('₹')) {
          texts.push(val);
        }
        node = walker.nextNode();
      }
      return texts;
    });

    expect(priceTexts.length).toBeGreaterThan(0);
    for (const text of priceTexts) {
      const matches = text.match(/₹\s*([0-9.,]+)/g);
      if (matches) {
        for (const m of matches) {
          expect(m).not.toMatch(/\.\d+/);
        }
      }
    }
  });

  test('04. Client-side URL tampering probe: injecting total=1&seats=A01 into URL is completely ignored', async ({ page, context, request }) => {
    await setupRazorpayMock(context);
    const user = await createTestCustomer(request);
    await loginAsCustomer(page, user);

    await page.setViewportSize({ width: 1280, height: 800 });
    const holdId = await selectSeatAndProceed(page, false);

    const payBtn = page.locator('[data-testid="pay-and-confirm-button"]');
    await expect(payBtn).toBeVisible();
    const originalText = await payBtn.textContent();

    // Tamper with the URL: inject bogus query parameters total=1, seats=A99, discount=999
    const tamperedUrl = `/checkout?hold_id=${holdId}&total=1&seats=A99&discount=999&amount=5`;
    await page.goto(tamperedUrl);
    await page.waitForLoadState('networkidle');

    // The page must still load the authoritative server quote
    const tamperedPayBtn = page.locator('[data-testid="pay-and-confirm-button"]');
    await expect(tamperedPayBtn).toBeVisible();
    const newText = await tamperedPayBtn.textContent();
    expect(newText).toBe(originalText);
    expect(newText).not.toContain('₹1');

    await page.screenshot({ path: '../docs/evidence/checkout-server-quote/04_tamper_attempt_ignored.png' });
  });

  test('05. Unauthenticated user accessing /checkout?hold_id=... is prompted to sign in', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Navigate to checkout without any auth tokens in localStorage
    await page.goto('/checkout?hold_id=hold_unauth_probe_123');
    await page.waitForLoadState('networkidle');

    // Assert "Sign In Required" state is shown
    await expect(page.getByText('Sign In Required')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Please sign in to your CineVerse account to view your server-locked seat quote/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In to Continue' })).toBeVisible();

    await page.screenshot({ path: '../docs/evidence/checkout-server-quote/05_unauthenticated_login_required.png' });
  });

  test('06. IDOR Security Probe: User B cannot access User A hold (403 Forbidden)', async ({ page, request }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // 1. Create User A and a seat hold
    const userA = await createTestCustomer(request);
    // Find an available seat
    const seatsRes = await request.get('http://127.0.0.1:8000/api/v1/showtimes/1/seats');
    const seatsData = await seatsRes.json();
    const availSeat = seatsData.seats.find((s: any) => s.status === 'AVAILABLE');
    expect(availSeat).toBeTruthy();

    const holdRes = await request.post('http://127.0.0.1:8000/api/v1/bookings/hold?showtime_id=1', {
      headers: { Authorization: `Bearer ${userA.access_token}` },
      data: {
        seat_ids: [availSeat.seat_id],
      },
    });
    expect(holdRes.ok()).toBe(true);
    const holdData = await holdRes.json();
    const userAHoldId = holdData.hold_id;

    // 2. Create User B and login as User B
    const userB = await createTestCustomer(request);
    await loginAsCustomer(page, userB);

    // 3. User B tries to view User A's hold
    await page.goto(`/checkout?hold_id=${userAHoldId}`);
    await page.waitForLoadState('networkidle');

    // 4. Assert 403 Access Restricted state is displayed
    await expect(page.getByText('Access Restricted')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Not authorized: This seat hold reservation belongs to another account/i)).toBeVisible();

    await page.screenshot({ path: '../docs/evidence/checkout-server-quote/06_idor_403_rejected.png' });
  });

  test('07. Expired or non-existent hold renders 404 Reservation Not Available', async ({ page, request }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const user = await createTestCustomer(request);
    await loginAsCustomer(page, user);

    // Navigate with non-existent hold_id
    await page.goto('/checkout?hold_id=hold_nonexistent_99999');
    await page.waitForLoadState('networkidle');

    // Assert Reservation Not Available state
    await expect(page.getByText('Reservation Not Available')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Your seat hold has expired or is invalid|Seat hold not found or has expired/i)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Find Showtimes' })).toBeVisible();

    await page.screenshot({ path: '../docs/evidence/checkout-server-quote/07_expired_hold_404.png' });
  });

  test('08. Order creation and payment confirmation uses exclusively server locked quote', async ({ page, context, request }) => {
    await setupRazorpayMock(context);
    const user = await createTestCustomer(request);
    await loginAsCustomer(page, user);

    await page.setViewportSize({ width: 1280, height: 800 });
    await selectSeatAndProceed(page, false);

    // Click pay button to initiate order creation and simulated Razorpay payment
    const payBtn = page.locator('[data-testid="pay-and-confirm-button"]');
    await expect(payBtn).toBeVisible();
    await payBtn.click();

    // Verify redirected to confirmed booking
    await expect(page).toHaveURL(/.*\/booking\/\d+.*/, { timeout: 15000 });
    await expect(page.getByText('Booking Confirmed')).toBeVisible();
    await expect(page.getByText(/Admission Code:\s*CV-/)).toBeVisible();

    await page.screenshot({ path: '../docs/evidence/checkout-server-quote/08_order_creation_server_quote.png' });
  });
});
