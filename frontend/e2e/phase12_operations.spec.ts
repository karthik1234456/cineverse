import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Phase 12 — Venue Operations and Scale', () => {
  test.beforeEach(async ({ context, request }) => {
    // Obtain valid admin token for staff/admin views
    const loginResp = await request.post('http://127.0.0.1:8000/api/v1/auth/login', {
      data: {
        email: 'admin@cineverse.in',
        password: 'Admin@123'
      }
    });
    const authData = loginResp.ok() ? await loginResp.json() : null;
    const token = authData?.access_token || 'fallback_admin_token';

    await context.addInitScript(({ token, authData }) => {
      window.localStorage.setItem('cineverse_city', 'bengaluru');
      window.localStorage.setItem('cineverse_token', token);
      if (authData) {
        window.localStorage.setItem('cineverse_user', JSON.stringify(authData));
      }
    }, { token, authData });
  });

  test('01. Staff Entry Scanning PWA on mobile viewport (390x844)', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/staff/scan');
    await page.waitForLoadState('networkidle');

    // Verify turnstile scanner header
    await expect(page.getByRole('heading', { name: 'Turnstile Scanner' })).toBeVisible();
    await expect(page.getByText('ONLINE')).toBeVisible();
    await expect(page.getByText('Gate 1 - Main Turnstile')).toBeVisible();

    // Verify scan input and button
    const qrInput = page.locator('#qr-input');
    await expect(qrInput).toBeVisible();
    const scanBtn = page.locator('#btn-scan');
    await expect(scanBtn).toBeVisible();

    // Test inputting dummy/test QR code payload
    await qrInput.fill('TKT-TEST123456|1|D01,D02|sig_hash');
    await scanBtn.click();

    // Status feedback (error or duplicate handling)
    await expect(page.locator('#scan-error-card')).toBeVisible();

    // Test manual lookup box
    const lookupInput = page.locator('#lookup-input');
    await lookupInput.fill('CV-NONEXISTENT');
    await page.locator('#btn-lookup').click();

    // Save mobile screenshot
    await page.screenshot({ path: path.resolve('../docs/evidence/phase-12/01_staff_scan_mobile.png') });
  });

  test('02. Admin Auditorium Onboarding & Asset Pipeline Tool', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/admin/onboarding');
    await page.waitForLoadState('networkidle');

    // Verify dashboard header
    await expect(page.getByRole('heading', { name: 'Auditorium Onboarding & Asset Pipeline' })).toBeVisible();

    // Upload production GLB directly via input
    let glbPath = path.resolve('public/models/cineverse_auditorium_v2.glb');
    if (!require('fs').existsSync(glbPath)) {
      glbPath = path.resolve('frontend/public/models/cineverse_auditorium_v2.glb');
    }
    await page.locator('#glb-upload').setInputFiles(glbPath);

    // Verify validation report appears
    await expect(page.locator('#validation-report-content')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Blender_Z_UP_WITH_MATRIX').first()).toBeVisible();
    await expect(page.getByText('100 seats').first()).toBeVisible();

    // Trigger asset web optimization
    const optimizeBtn = page.locator('#btn-optimize');
    await expect(optimizeBtn).toBeVisible();
    await optimizeBtn.click();

    await expect(page.locator('#optimization-metrics')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Triangle Reduction')).toBeVisible();

    // Save desktop screenshot
    await page.screenshot({ path: path.resolve('../docs/evidence/phase-12/02_admin_onboarding_dashboard.png') });
  });

  test('03. Kitchen Display System (KDS) Concessions Dispatch', async ({ page }) => {
    await page.goto('/staff/kds');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Kitchen Display & Concessions Dispatch' })).toBeVisible();
    await expect(page.getByText('Zero-PII food dispatch terminal')).toBeVisible();

    // Save KDS screenshot
    await page.screenshot({ path: path.resolve('../docs/evidence/phase-12/03_staff_kds_screen.png') });
  });

  test('04. Patron Profile Loyalty Points & CinePass Subscription', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('LOYALTY BALANCE')).toBeVisible();
    await expect(page.getByText('CINEPASS PASS')).toBeVisible();
    await expect(page.getByText('INVITE FRIENDS')).toBeVisible();

    // Save profile loyalty screenshot
    await page.screenshot({ path: path.resolve('../docs/evidence/phase-12/04_loyalty_cinepass_profile.png') });
  });
});
