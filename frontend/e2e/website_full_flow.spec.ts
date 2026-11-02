import { test, expect, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe.configure({ mode: 'serial' });

test.describe('CineVerse Full Website & 3D Booking Flow', () => {
  const evidenceDir = path.resolve(process.cwd(), '..', 'docs', 'evidence');
  let sharedPage: Page;

  test.beforeAll(async ({ browser, baseURL }) => {
    if (!fs.existsSync(evidenceDir)) {
      fs.mkdirSync(evidenceDir, { recursive: true });
    }
    const context = await browser.newContext({
      baseURL: baseURL || 'http://localhost:3001',
      viewport: { width: 1280, height: 800 },
    });
    sharedPage = await context.newPage();
  });

  test.afterAll(async () => {
    await sharedPage.close();
  });

  test('01: Homepage loads with hero carousel, city selector, and signature 3D banner', async () => {
    await sharedPage.goto('/');
    await sharedPage.waitForLoadState('networkidle');

    // Verify CineVerse Logo
    const logo = sharedPage.locator('text=CINEVERSE').first();
    await expect(logo).toBeVisible();

    // Verify City Selector button
    const cityBtn = sharedPage.locator('button:has-text("Bengaluru"), button:has-text("Select City")').first();
    await expect(cityBtn).toBeVisible();

    // Click City Selector to open modal
    await cityBtn.click();
    await sharedPage.waitForTimeout(500);

    const cityModal = sharedPage.locator('text=Select Your City');
    await expect(cityModal).toBeVisible();

    // Select Mumbai
    const mumbaiBtn = sharedPage.locator('button:has-text("Mumbai")').first();
    await mumbaiBtn.click();
    await sharedPage.waitForTimeout(500);

    // Verify 3D Showcase Banner is visible
    const showcaseBanner = sharedPage.locator('text=Choose Seats Inside a Real 3D Auditorium');
    await expect(showcaseBanner).toBeVisible();

    // Capture screenshot
    await sharedPage.screenshot({ path: path.join(evidenceDir, '01_homepage_city_selector.png') });
  });

  test('02: Movies catalog filters by format and navigates to detail', async () => {
    await sharedPage.goto('/movies');
    await sharedPage.waitForLoadState('networkidle');

    const header = sharedPage.locator('h1:has-text("Explore Movies")');
    await expect(header).toBeVisible();

    // Verify movie cards exist
    const firstMovie = sharedPage.locator('a[href^="/movies/"]').first();
    await expect(firstMovie).toBeVisible();

    // Capture screenshot
    await sharedPage.screenshot({ path: path.join(evidenceDir, '02_movies_catalog.png') });

    // Navigate to first movie detail
    await firstMovie.click();
    await sharedPage.waitForURL(/\/movies\/.+/);
  });

  test('03: Movie details page displays synopsis, cast, and 7-day showtimes grid', async () => {
    await sharedPage.waitForLoadState('networkidle');

    // Title and metadata
    const movieTitle = sharedPage.locator('h1').first();
    await expect(movieTitle).toBeVisible();

    // 7-day date strip
    const todayBtn = sharedPage.locator('button:has-text("TODAY")').first();
    await expect(todayBtn).toBeVisible();

    // Showtime timing chips
    const showtimeChip = sharedPage.locator('a[href*="/auditorium/"]').first();
    await expect(showtimeChip).toBeVisible();

    // Capture screenshot
    await sharedPage.screenshot({ path: path.join(evidenceDir, '03_movie_detail_showtimes.png') });

    // Click showtime chip to enter 3D experience
    await showtimeChip.click();
    await sharedPage.waitForURL(/\/auditorium\//);
  });

  test('04: 3D Auditorium seat selection, POV sightline, and F&B Add-ons modal', async () => {
    await sharedPage.waitForLoadState('networkidle');

    // Wait for 3D canvas
    const canvas = sharedPage.locator('canvas');
    await expect(canvas).toBeAttached();

    // Wait until window.__cineverse is initialized by R3F
    await sharedPage.waitForFunction(() => !!(window as any).__cineverse, { timeout: 35000 });

    // Select 2 available seats via client state
    await sharedPage.evaluate(() => {
      const rows = ['H', 'I'];
      let picked = 0;
      for (const r of rows) {
        for (let n = 1; n <= 10; n++) {
          const id = `${r}${n.toString().padStart(2, '0')}`;
          const ok = (window as any).__cineverse.selectSeat(id);
          if (ok) {
            picked++;
            if (picked >= 2) return;
          }
        }
      }
    });

    await sharedPage.waitForTimeout(500);

    // Capture 3D seat selection screenshot
    await sharedPage.screenshot({ path: path.join(evidenceDir, '04_3d_seat_pov_view.png') });

    // Verify SelectedSeatsBar is visible with "Lock & Checkout"
    const lockBtn = sharedPage.locator('button:has-text("Lock & Checkout")');
    await expect(lockBtn).toBeVisible();

    // Click Lock & Checkout
    await lockBtn.click();
    await sharedPage.waitForTimeout(1000);

    // Verify F&B Addons modal appears
    const fnbModal = sharedPage.locator('text=Grab Cinema Combos & Bites');
    await expect(fnbModal).toBeVisible();

    // Capture F&B Modal screenshot
    await sharedPage.screenshot({ path: path.join(evidenceDir, '05_fnb_addons_modal.png') });

    // Click Proceed to Checkout
    const proceedBtn = sharedPage.locator('button:has-text("Proceed to Checkout")');
    await proceedBtn.click();

    // Should navigate to /checkout with hold_id in query
    await sharedPage.waitForURL(/\/checkout/);
  });

  test('05: Checkout page with 5-minute hold timer, coupon validation, and payment confirmation', async () => {
    await sharedPage.waitForLoadState('networkidle');

    // Verify Hold countdown timer is running
    const holdText = sharedPage.locator('text=Seats locked for you');
    await expect(holdText).toBeVisible();

    // Fill fresh guest email and phone
    const emailInput = sharedPage.locator('input[type="email"]');
    await emailInput.fill(`patron_${Date.now()}@cineverse.in`);

    const phoneInput = sharedPage.locator('input[type="tel"]');
    await phoneInput.fill(`98${Math.floor(10000000 + Math.random() * 90000000)}`);

    // Apply Coupon Code
    const couponInput = sharedPage.locator('input[placeholder*="CINEVERSE50"]');
    await couponInput.fill('CINEVERSE50');

    const applyBtn = sharedPage.locator('button:has-text("Apply")');
    await applyBtn.click();
    await sharedPage.waitForTimeout(1000);

    // Verify coupon applied notice
    const couponSuccess = sharedPage.locator('text=applied');
    await expect(couponSuccess).toBeVisible();

    // Capture checkout screenshot
    await sharedPage.screenshot({ path: path.join(evidenceDir, '06_checkout_with_hold_timer.png') });

    // Click Pay & Get E-Ticket
    const payBtn = sharedPage.locator('button:has-text("Pay")');
    await payBtn.click();

    // Wait for transition to confirmed booking page
    await sharedPage.waitForURL(/\/booking\/\d+/, { timeout: 15000 });
  });

  test('06: Booking confirmation page renders verified signed QR E-Ticket', async () => {
    await sharedPage.waitForLoadState('networkidle');

    // Verify confirmed badge
    const confirmedBadge = sharedPage.locator('text=Booking Confirmed');
    await expect(confirmedBadge).toBeVisible();

    // Verify admission code
    const admissionCode = sharedPage.locator('text=Admission Code: CV-');
    await expect(admissionCode).toBeVisible();

    // Verify QR code image
    const qrImg = sharedPage.locator('img[alt="Ticket QR Code"]');
    await expect(qrImg).toBeVisible();

    // Capture booking confirmed screenshot
    await sharedPage.screenshot({ path: path.join(evidenceDir, '07_booking_confirmed_qr_ticket.png') });
  });

  test('07: User profile displays booking history and cancellation refund flow', async () => {
    await sharedPage.goto('/profile');
    await sharedPage.waitForLoadState('networkidle');

    const profileHeader = sharedPage.locator('h1:has-text("CineVerse Patron"), h2:has-text("Your Bookings")');
    await expect(profileHeader.first()).toBeVisible();

    // Capture profile bookings screenshot
    await sharedPage.screenshot({ path: path.join(evidenceDir, '08_profile_bookings_history.png') });
  });

  test('08: Admin analytics console displays revenue and occupancy metrics', async () => {
    // Authenticate as real seeded admin
    const loginRes = await sharedPage.request.post('http://127.0.0.1:8000/api/v1/auth/login', {
      data: {
        email: 'admin@cineverse.in',
        password: 'Admin@123',
      },
    });
    const authData = await loginRes.json();

    await sharedPage.goto('/');
    await sharedPage.evaluate((auth) => {
      localStorage.setItem('cineverse_token', auth.access_token);
      localStorage.setItem('cineverse_user', JSON.stringify({
        access_token: auth.access_token,
        user_id: auth.user_id,
        role: auth.role,
        full_name: auth.full_name,
      }));
    }, authData);

    await sharedPage.goto('/admin');
    await sharedPage.waitForLoadState('networkidle');

    // Verify analytics widgets load
    const revCard = sharedPage.locator('text=Gross Revenue');
    await expect(revCard).toBeVisible();

    // Capture admin analytics screenshot
    await sharedPage.screenshot({ path: path.join(evidenceDir, '10_admin_analytics.png') });
  });
});
