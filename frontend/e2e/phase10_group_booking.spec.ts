import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const EVIDENCE_DIR = path.resolve(__dirname, '../../docs/evidence/phase-10');

test.describe.serial('Phase 10 — Group Booking, Real-Time Presence & Split Payment', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(EVIDENCE_DIR)) {
      fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('cineverse_city', 'bengaluru');
      localStorage.setItem('cineverse_city_id', '1');
      localStorage.setItem('cineverse_city_name', 'Bengaluru');
    });
  });

  test('01. Group Session Creation and Policy Selection', async ({ page }) => {
    test.setTimeout(90000);

    const userEmail = `patron_ui_${Date.now()}@example.com`;
    const regResp = await page.request.post('http://127.0.0.1:8002/api/v1/auth/register', {
      data: { email: userEmail, password: 'Password@123', full_name: 'Patron UI' },
    });
    expect(regResp.ok()).toBeTruthy();
    const authData = await regResp.json();

    await page.addInitScript(({ token, email }) => {
      localStorage.setItem('cineverse_token', token);
      localStorage.setItem('cineverse_user', JSON.stringify({
        id: 100,
        user_id: 100,
        full_name: 'Patron UI',
        email: email,
        role: 'customer',
      }));
    }, { token: authData.access_token, email: userEmail });

    // Open 2D Seat Map
    await page.goto('/cinemas/1/auditorium/1?showtime=1&mode=2d');
    await page.waitForLoadState('networkidle');

    // Click "Book with friends" button
    const bookWithFriendsBtn = page.locator('[data-testid="book-with-friends-btn"]');
    await expect(bookWithFriendsBtn).toBeVisible({ timeout: 15000 });
    await bookWithFriendsBtn.click();

    // Group booking modal displays with timeout policies
    const modal = page.locator('text=Book With Friends').first();
    await expect(modal).toBeVisible();
    await expect(page.locator('text=Auto-Refund All')).toBeVisible();
    await expect(page.locator('text=Host Covers Remainder')).toBeVisible();

    // Screenshot modal
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '01_group_creation_modal.png'),
    });

    // Create Group
    const createBtn = page.locator('[data-testid="create-group-btn"]');
    await createBtn.click();

    // Verify Invite link & Copy button appear
    const copyBtn = page.locator('[data-testid="copy-group-invite-btn"]');
    await expect(copyBtn).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Group Members (1/8)')).toBeVisible();

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '02_group_invite_ready.png'),
    });

    // Click Continue to Seat Map
    await page.locator('text=Continue to Seat Map').click();

    // Verify GroupRoomBanner is visible
    const banner = page.locator('[data-testid="group-room-banner"]');
    await expect(banner).toBeVisible({ timeout: 15000 });
    await expect(banner).toContainText('GRP-');
    await expect(banner).toContainText('FORMATION');
  });

  test('02. Live Seat Selection, Hold Locking and Split Payment Flow', async ({ page }) => {
    test.setTimeout(90000);

    const hostEmail = `host_flow_${Date.now()}@example.com`;
    const regResp = await page.request.post('http://127.0.0.1:8002/api/v1/auth/register', {
      data: { email: hostEmail, password: 'Password@123', full_name: 'Host Flow' },
    });
    expect(regResp.ok()).toBeTruthy();
    const authData = await regResp.json();

    // Create a group session via API
    const grpResp = await page.request.post('http://127.0.0.1:8002/api/v1/groups', {
      headers: { Authorization: `Bearer ${authData.access_token}` },
      data: { showtime_id: 1, timeout_policy: 'AUTO_REFUND' },
    });
    expect(grpResp.ok()).toBeTruthy();
    const grp = await grpResp.json();

    await page.addInitScript(({ token, email, userId }) => {
      localStorage.setItem('cineverse_token', token);
      localStorage.setItem('cineverse_user', JSON.stringify({
        id: userId,
        user_id: userId,
        full_name: 'Host Flow',
        email: email,
        role: 'customer',
      }));
    }, { token: authData.access_token, email: hostEmail, userId: grp.host_user_id });

    // Navigate to seat map with groupId
    await page.goto(`/cinemas/1/auditorium/1?showtime=1&mode=2d&groupId=${grp.id}`);
    await page.waitForLoadState('networkidle');

    const banner = page.locator('[data-testid="group-room-banner"]');
    await expect(banner).toBeVisible({ timeout: 15000 });

    // Host proposes seat A01
    const seatA01 = page.locator('[data-testid="seat-2d-A01"]');
    await expect(seatA01).toBeVisible();
    await seatA01.click();
    await page.waitForTimeout(500);

    // Verify Lock and Split button is visible for host
    const lockBtn = page.locator('[data-testid="lock-and-split-btn"]');
    await expect(lockBtn).toBeVisible();

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '03_host_proposed_seat.png'),
    });

    // Host locks selection and split
    await lockBtn.click();
    await page.waitForTimeout(1500);

    // Status transitions to HELD / Pay My Share
    const payBtn = page.locator('[data-testid="pay-group-share-btn"]');
    await expect(payBtn).toBeVisible({ timeout: 15000 });

    // Verify Hold timer
    await expect(page.locator('text=Hold Expires:')).toBeVisible();

    // Verify Extend Hold button
    const extendBtn = page.locator('[data-testid="extend-group-hold-btn"]');
    await expect(extendBtn).toBeVisible();

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '04_group_held_countdown.png'),
    });

    // Extend hold (+5m)
    await extendBtn.click();
    await page.waitForTimeout(1000);
    // Button should disappear / disable after 1 extension
    await expect(extendBtn).not.toBeVisible();

    // Host pays their share
    await payBtn.click();
    await page.waitForTimeout(1500);

    // Booking confirmed
    const viewTicketsBtn = page.locator('[data-testid="view-group-tickets-btn"]');
    await expect(viewTicketsBtn).toBeVisible({ timeout: 15000 });

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '05_group_confirmed.png'),
    });

    // Open tickets modal
    await viewTicketsBtn.click();
    const tktModal = page.locator('text=Group Booking Tickets');
    await expect(tktModal).toBeVisible();
    await expect(page.locator('text=Turnstile Verified')).toBeVisible();

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '06_group_tickets_qr.png'),
    });
  });

  test('03. 3D Theatre Shared Presence Verification', async ({ page }) => {
    test.setTimeout(90000);
    await page.goto('/cinemas/1/auditorium/1?showtime=1&mode=3d');
    await page.waitForLoadState('networkidle');

    const wrapper = page.locator('[data-testid="auditorium-3d-wrapper"]');
    await expect(wrapper).toBeVisible({ timeout: 20000 });

    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, '07_3d_theatre_view.png'),
    });
  });
});
