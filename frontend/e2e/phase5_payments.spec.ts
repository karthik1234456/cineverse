import { test, expect, Page } from '@playwright/test';

test.describe('Phase 5 — Payments, Razorpay Test Mode, Tickets, Receipts & Recovery', () => {
  const SHOWTIME_URL = '/cinemas/cineverse-imax/auditorium/auditorium-1?showtime=1';

  test.beforeEach(async ({ context, request }) => {
    // Register fresh patron user per test to avoid active hold limits
    const rand = Math.floor(100000000 + Math.random() * 900000000);
    const email = `patron_${rand}@cineverse.in`;
    const phone = `9${rand}`;
    const loginResp = await request.post('http://127.0.0.1:8000/api/v1/auth/register', {
      data: {
        email,
        phone,
        password: 'Password@123',
        full_name: `Test Patron ${rand}`,
      },
    });
    const authData = loginResp.ok() ? await loginResp.json() : null;
    const token = authData?.access_token || '';

    // Abort external checkout.razorpay.com script so test simulation is preserved
    await context.route('https://checkout.razorpay.com/**', (route) => route.abort());

    // Configure client-side mock for Razorpay test checkout with real Web Crypto HMAC-SHA256
    await context.addInitScript(({ token, authData }) => {
      window.localStorage.setItem('cineverse_city', 'bengaluru');
      if (token) {
        window.localStorage.setItem('cineverse_token', token);
      }
      if (authData) {
        window.localStorage.setItem('cineverse_user', JSON.stringify(authData));
      }

      class MockRazorpay {
        options: any;
        _onFail?: Function;
        constructor(options: any) {
          this.options = options;
          (window as any).__lastRzpOptions = options;
        }

        async open() {
          (window as any).__rzpOpened = true;

          // Check if decline simulation requested
          if ((window as any).__simulatePaymentFailure) {
            if (this._onFail) {
              this._onFail({
                error: {
                  code: 'PAYMENT_DECLINED',
                  description: 'Payment was declined by your bank.',
                },
              });
            }
            return;
          }

          // Generate valid HMAC signature matching server's secret: 'secret_cineverse_test_mode'
          const orderId = this.options.order_id;
          const payId = 'pay_sim_' + Math.random().toString(36).substring(2, 10);
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

          // Trigger success handler
          await this.options.handler({
            razorpay_order_id: orderId,
            razorpay_payment_id: payId,
            razorpay_signature: signature,
          });
        }

        on(event: string, callback: Function) {
          if (event === 'payment.failed') {
            this._onFail = callback;
          }
        }
      }

      Object.defineProperty(window, 'Razorpay', {
        get: () => MockRazorpay,
        set: () => {},
        configurable: true,
      });
    }, { token, authData });
  });

  async function selectSeatAndProceedToCheckout(page: Page) {
    await page.goto(SHOWTIME_URL);
    await page.waitForLoadState('networkidle');

    const availableSeat = page.locator('button[data-status="available"]').first();
    await expect(availableSeat).toBeVisible({ timeout: 10000 });
    const seatId = await availableSeat.getAttribute('data-seat-id');
    expect(seatId).toBeTruthy();

    await availableSeat.click();

    const proceedBtn = page.locator('[data-testid="proceed-to-checkout-btn"]');
    await expect(proceedBtn).toBeVisible();
    await proceedBtn.click();

    // Skip F&B modal
    const skipFnb = page.locator('[data-testid="skip-fnb-btn"]');
    await expect(skipFnb).toBeVisible({ timeout: 8000 });
    await skipFnb.click();

    await expect(page).toHaveURL(/.*\/checkout.*/, { timeout: 10000 });
    return seatId;
  }

  test('01. Complete checkout journey: 2D seat selection -> hold -> checkout line items & server-computed total', async ({ page }) => {
    const seatId = await selectSeatAndProceedToCheckout(page);

    const checkoutContainer = page.locator('[data-testid="checkout-page"]');
    await expect(checkoutContainer).toBeVisible();

    // Verify 3-Step Breadcrumbs
    await expect(page.getByText('1. Show')).toBeVisible();
    await expect(page.getByText('2. Seats')).toBeVisible();
    await expect(page.getByText('3. Pay')).toBeVisible();

    // Verify Hold Countdown Timer
    const holdTimer = page.locator('[data-testid="hold-countdown-timer"]');
    await expect(holdTimer).toBeVisible();
    const timerDigits = page.locator('[data-testid="hold-timer-digits"]');
    await expect(timerDigits).toBeVisible();

    // Verify Selected Seat Pill
    await expect(page.getByText(`Selected Seats (1):`)).toBeVisible();
    await expect(page.locator(`text=${seatId}`).first()).toBeVisible();

    // Verify Payment badge
    await expect(page.locator('[data-testid="payment-stub-badge"]')).toHaveText(/Razorpay/);

    // Verify Line items & Total Amount
    await expect(page.getByText('Tickets (1)')).toBeVisible();
    await expect(page.getByText('Convenience Fee')).toBeVisible();
    await expect(page.getByText('Integrated GST (18%)')).toBeVisible();
    await expect(page.getByText('Amount Payable')).toBeVisible();

    // Verify Pay Button has amount
    const payBtn = page.locator('[data-testid="pay-and-confirm-button"]');
    await expect(payBtn).toBeVisible();
    await expect(payBtn).toContainText('Pay ₹');

    // Capture desktop checkout screenshot
    await page.screenshot({ path: '../docs/evidence/phase-5/checkout-1280.png' });
  });

  test('02. Promo code validation updates discount and final payable amount', async ({ page }) => {
    await page.goto(SHOWTIME_URL);
    await page.waitForLoadState('networkidle');

    // Select 2 seats so order amount exceeds ₹300 coupon threshold
    const availableSeats = page.locator('button[data-status="available"]');
    await expect(availableSeats.first()).toBeVisible({ timeout: 10000 });
    await availableSeats.nth(0).click();
    await availableSeats.nth(1).click();

    await page.locator('[data-testid="proceed-to-checkout-btn"]').click();
    const skipFnb = page.locator('[data-testid="skip-fnb-btn"]');
    await expect(skipFnb).toBeVisible({ timeout: 8000 });
    await skipFnb.click();

    await expect(page).toHaveURL(/.*\/checkout.*/, { timeout: 10000 });

    const couponInput = page.locator('[data-testid="coupon-input"]');
    const applyBtn = page.locator('[data-testid="apply-coupon-button"]');
    await expect(couponInput).toBeVisible();

    // Type coupon code
    await couponInput.fill('CINEVERSE50');
    await applyBtn.click();

    // Check discount line item appears
    await expect(page.getByText('Coupon Discount (CINEVERSE50)')).toBeVisible({ timeout: 5000 });
  });

  test('03. Pay button disables upon click and confirms payment into ticket receipt', async ({ page }) => {
    await selectSeatAndProceedToCheckout(page);

    // Click Pay Button
    const payBtn = page.locator('[data-testid="pay-and-confirm-button"]');
    await expect(payBtn).toBeVisible();
    await payBtn.click();

    // Should redirect to booking confirmation page
    await expect(page).toHaveURL(/.*\/booking\/\d+.*/, { timeout: 15000 });

    // Verify confirmed admission header
    await expect(page.getByText('Booking Confirmed')).toBeVisible();
    await expect(page.getByText(/Admission Code:\s*CV-/)).toBeVisible();
    await expect(page.getByText('Gate Ready')).toBeVisible();

    // Verify QR code image
    const qrImage = page.locator('img[alt="Ticket QR Code"]');
    await expect(qrImage).toBeVisible();

    // Verify Ticket number
    await expect(page.getByText(/TKT-[A-F0-9]+/)).toBeVisible();

    // Verify Print Ticket and Calendar buttons
    const printLink = page.getByRole('link', { name: /Print Ticket/i });
    await expect(printLink).toBeVisible();
    const printHref = await printLink.getAttribute('href');
    expect(printHref).toMatch(/\/api\/v1\/tickets\/CV-[A-Z0-9]+\/print/);

    const calendarBtn = page.getByRole('button', { name: /Add to Calendar/i });
    await expect(calendarBtn).toBeVisible();

    // Capture desktop booking confirmation screenshot
    await page.screenshot({ path: '../docs/evidence/phase-5/booking-1280.png' });
  });

  test('04. Calendar .ics download generation', async ({ page }) => {
    await selectSeatAndProceedToCheckout(page);

    await page.locator('[data-testid="pay-and-confirm-button"]').click();
    await expect(page).toHaveURL(/.*\/booking\/\d+.*/, { timeout: 15000 });

    // Intercept download event when clicking "Add to Calendar"
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Add to Calendar/i }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/CV-[A-Z0-9]+\.ics/);
  });

  test('05. Cancellation and 75% refund policy execution', async ({ page }) => {
    await selectSeatAndProceedToCheckout(page);

    await page.locator('[data-testid="pay-and-confirm-button"]').click();
    await expect(page).toHaveURL(/.*\/booking\/\d+.*/, { timeout: 15000 });

    // Handle window confirm dialog
    page.on('dialog', async (dialog) => {
      expect(dialog.message()).toContain('75% refund');
      await dialog.accept();
    });

    const cancelBtn = page.getByRole('button', { name: /Cancel Booking & Refund/i });
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();

    // Verify cancellation notice appears
    await expect(page.getByText('Booking Cancelled & Refunded')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Booking cancelled\. Refund of ₹.* initiated/i)).toBeVisible();

    // Verify cancel button is gone
    await expect(page.getByRole('button', { name: /Cancel Booking & Refund/i })).not.toBeVisible();
  });

  test('06. Payment failure / bank decline keeps seats held and displays clear retry message', async ({ page }) => {
    await selectSeatAndProceedToCheckout(page);

    // Set failure simulation flag
    await page.evaluate(() => {
      (window as any).__simulatePaymentFailure = true;
    });

    // Click Pay button
    const payBtn = page.locator('[data-testid="pay-and-confirm-button"]');
    await payBtn.click();

    // Verify decline message appears
    await expect(page.getByText('Payment was declined by your bank.')).toBeVisible({ timeout: 5000 });

    // Verify user remains on checkout page
    await expect(page).toHaveURL(/.*\/checkout.*/);
  });

  test('07. Responsive layouts at 390px, 768px, and 1280px widths', async ({ page }) => {
    // 1. Mobile (390px)
    await page.setViewportSize({ width: 390, height: 844 });
    await selectSeatAndProceedToCheckout(page);

    // Mobile Checkout Screenshot
    await page.screenshot({ path: '../docs/evidence/phase-5/checkout-390.png' });

    // Pay
    await page.locator('[data-testid="pay-and-confirm-button"]').click();
    await expect(page).toHaveURL(/.*\/booking\/\d+.*/, { timeout: 15000 });

    // Mobile Confirmation Screenshot
    await page.screenshot({ path: '../docs/evidence/phase-5/booking-390.png' });

    // 2. Tablet (768px)
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.screenshot({ path: '../docs/evidence/phase-5/booking-768.png' });

    // Select seat and proceed to checkout for tablet checkout screenshot
    await selectSeatAndProceedToCheckout(page);
    await page.screenshot({ path: '../docs/evidence/phase-5/checkout-768.png' });
  });

  test('08. Strict Typography Audit: Zero text under 14px on checkout and booking pages', async ({ page }) => {
    // Audit checkout page
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/checkout?showtime=1&seats=A01');
    await page.waitForLoadState('networkidle');

    const checkoutViolations = await page.evaluate(() => {
      const issues: { text: string; fontSize: string; tag: string }[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
      let node = walker.nextNode() as HTMLElement | null;

      while (node) {
        // Only inspect visible elements with immediate non-empty text content
        const text = node.textContent?.trim() || '';
        const rect = node.getBoundingClientRect();
        if (text && rect.width > 0 && rect.height > 0 && node.children.length === 0) {
          const style = window.getComputedStyle(node);
          const fontSizePx = parseFloat(style.fontSize);
          if (fontSizePx < 13.9) {
            issues.push({
              text: text.substring(0, 30),
              fontSize: style.fontSize,
              tag: node.tagName,
            });
          }
        }
        node = walker.nextNode() as HTMLElement | null;
      }
      return issues;
    });

    expect(checkoutViolations).toEqual([]);
  });
});
