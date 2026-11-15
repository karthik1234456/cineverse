const { chromium } = require('../frontend/node_modules/@playwright/test');
const fs = require('fs');
const path = require('path');

async function getToken(email, password) {
  const resp = await fetch('http://127.0.0.1:8000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!resp.ok) {
    throw new Error(`Login failed for ${email}: ${resp.status} ${await resp.text()}`);
  }
  const data = await resp.json();
  const user = {
    id: data.user_id,
    role: data.role,
    name: data.full_name || email.split('@')[0],
    email: email
  };
  return { token: data.access_token, user };
}

async function capture() {
  const patronAuth = await getToken('patron@example.com', 'Patron@123');
  const adminAuth = await getToken('admin@cineverse.com', 'Admin@123');

  console.log('Patron logged in:', patronAuth.user.email, patronAuth.user.role);
  console.log('Admin logged in:', adminAuth.user.email, adminAuth.user.role);

  const browser = await chromium.launch({ headless: true });

  const viewports = [
    { name: '390px', width: 390, height: 844 },
    { name: '768px', width: 768, height: 1024 },
    { name: '1280px', width: 1280, height: 800 }
  ];

  const outDir = path.resolve(__dirname, '../docs/evidence/cancellation');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  for (const vp of viewports) {
    console.log(`\n=== Capturing for ${vp.name} (${vp.width}x${vp.height}) ===`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2
    });

    // Setup Patron session with city pre-selected to prevent City modal overlay
    const page = await context.newPage();
    await page.goto('http://localhost:3001/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(({ token, user }) => {
      localStorage.setItem('cineverse_city', 'hyderabad');
      localStorage.setItem('cineverse_city_id', '1');
      localStorage.setItem('cineverse_token', token);
      localStorage.setItem('cineverse_user', JSON.stringify(user));
    }, patronAuth);

    // 1. Navigate to Profile / My Tickets
    console.log(`Navigating to /profile on ${vp.name}...`);
    await page.goto('http://localhost:3001/profile', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Dismiss any modal if open
    const cityBackdrop = page.locator('button[data-testid="city-option-hyderabad"]');
    if (await cityBackdrop.isVisible()) {
      await cityBackdrop.click();
      await page.waitForTimeout(500);
    }

    // Capture booking card with Cancel button
    const cardPath = path.join(outDir, `profile_booking_card_${vp.name}.png`);
    await page.screenshot({ path: cardPath, fullPage: false });
    console.log(`Saved: ${cardPath}`);

    // Click "Cancel booking" button to open modal
    const cancelBtn = page.locator('button:has-text("Cancel booking")').first();
    if (await cancelBtn.isVisible()) {
      console.log(`Clicking "Cancel booking" button on ${vp.name}...`);
      await cancelBtn.click();
      await page.waitForTimeout(1000);

      // Verify modal is visible
      const modal = page.locator('text=Cancel Booking & Refund Policy');
      if (await modal.isVisible()) {
        const modalPath = path.join(outDir, `cancellation_modal_${vp.name}.png`);
        await page.screenshot({ path: modalPath, fullPage: false });
        console.log(`Saved: ${modalPath}`);
      } else {
        console.warn(`Modal title not found on ${vp.name}`);
        const modalPath = path.join(outDir, `cancellation_modal_${vp.name}.png`);
        await page.screenshot({ path: modalPath, fullPage: false });
      }
    } else {
      console.warn(`Cancel booking button not found on ${vp.name}`);
    }

    // 2. Navigate to Ticket 88002 (Cancelled booking with 3-step refund timeline)
    console.log(`Navigating to /booking/88002 on ${vp.name}...`);
    await page.goto('http://localhost:3001/booking/88002', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const ticketPath = path.join(outDir, `ticket_refund_timeline_${vp.name}.png`);
    await page.screenshot({ path: ticketPath, fullPage: true });
    console.log(`Saved: ${ticketPath}`);

    // 3. For Desktop 1280px, also capture Admin Stuck Refunds
    if (vp.width >= 1280) {
      console.log('Capturing Admin Stuck Refunds on 1280px...');
      const adminContext = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        deviceScaleFactor: 2
      });
      const adminPage = await adminContext.newPage();
      await adminPage.goto('http://localhost:3001/', { waitUntil: 'domcontentloaded' });
      await adminPage.evaluate(({ token, user }) => {
        localStorage.setItem('cineverse_city', 'hyderabad');
        localStorage.setItem('cineverse_city_id', '1');
        localStorage.setItem('cineverse_token', token);
        localStorage.setItem('cineverse_user', JSON.stringify(user));
      }, adminAuth);

      await adminPage.goto('http://localhost:3001/admin', { waitUntil: 'networkidle' });
      await adminPage.waitForTimeout(1500);

      // Scroll to Stuck & Delayed Refunds section
      const stuckSection = adminPage.locator('text=Stuck & Delayed Refunds');
      if (await stuckSection.isVisible()) {
        await stuckSection.scrollIntoViewIfNeeded();
        await adminPage.waitForTimeout(500);
      }

      const adminPath = path.join(outDir, `admin_stuck_refunds_${vp.name}.png`);
      await adminPage.screenshot({ path: adminPath, fullPage: false });
      console.log(`Saved: ${adminPath}`);
      await adminContext.close();
    }

    await context.close();
  }

  await browser.close();
  console.log('\nAll cancellation screenshots captured successfully!');
}

capture().catch(err => {
  console.error('Error during capture:', err);
  process.exit(1);
});
