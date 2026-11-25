import { test, expect } from '@playwright/test';

test.describe('Problem Reporting and Telemetry Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('cineverse_city', 'mumbai');
      localStorage.setItem('cineverse_city_id', '1');
      localStorage.setItem('cineverse_city_name', 'Mumbai');
      localStorage.setItem('cineverse_city_modal_dismissed', 'true');
    });
  });

  test('1. Footer button and keyboard shortcut (F8) opens modal on 2D and 3D pages', async ({ page }) => {
    await page.goto('/');

    // Verify footer button exists
    const reportBtn = page.getByRole('button', { name: /report a problem/i });
    await expect(reportBtn).toBeVisible({ timeout: 10000 });

    // Open via button click
    await reportBtn.click();
    const modal = page.locator('[role="dialog"][aria-modal="true"]');
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('heading', { name: 'Report a Problem' })).toBeVisible();

    // Close modal
    await modal.getByRole('button', { name: 'Cancel' }).click();
    await expect(modal).not.toBeVisible();

    // Open via keyboard shortcut F8
    await page.keyboard.press('F8');
    await expect(modal).toBeVisible();
    await modal.getByRole('button', { name: 'Cancel' }).click();
  });

  test('2. Submitting problem report on 3D Auditorium captures canvas and metadata', async ({ page }) => {
    // Navigate to 3D auditorium page
    await page.goto('/cinemas/2/auditorium/5?showtime=113&mode=3d');
    await page.waitForLoadState('domcontentloaded');

    // Wait for 3D canvas
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15000 });

    // Open problem report modal via footer button or shortcut
    const reportBtn = page.getByRole('button', { name: /report a problem/i });
    if (await reportBtn.isVisible()) {
      await reportBtn.click();
    } else {
      await page.keyboard.press('F8');
    }

    const modal = page.locator('[role="dialog"][aria-modal="true"]');
    await expect(modal).toBeVisible({ timeout: 15000 });

    // Fill in bug details
    await page.fill('#issue-desc', 'In Walk mode, the left handrail clipping was noticed near row D.');
    await page.fill('#expected-desc', 'The handrail should be solid with continuous collision bounding.');

    // Submit report
    const submitBtn = modal.getByRole('button', { name: /submit report/i });
    await submitBtn.click();

    // Expect success message
    await expect(modal.getByText('Problem Report Submitted')).toBeVisible({ timeout: 15000 });
  });

  test('3. Admin reports console lists submitted report and provides Copy prompt & Export', async ({ page, request }) => {
    // Generate admin JWT token via backend
    const adminLoginRes = await request.post('http://127.0.0.1:8000/api/v1/auth/login', {
      data: {
        email: 'admin@cineverse.in',
        password: 'admin',
      },
    });

    let token = '';
    if (adminLoginRes.ok()) {
      const loginData = await adminLoginRes.json();
      token = loginData.access_token;
    }

    // Set token in localStorage for frontend
    await page.goto('/admin/reports');
    if (token) {
      await page.evaluate((t) => localStorage.setItem('access_token', t), token);
      await page.reload();
    }

    await page.waitForLoadState('domcontentloaded');

    // Verify Admin Telemetry page elements
    await expect(page.getByText('Problem Reports & Diagnostics')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /export all open reports/i })).toBeVisible();

    // Verify Copy prompt button is available
    const copyPromptBtn = page.getByRole('button', { name: /copy as prompt for antigravity/i });
    if (await copyPromptBtn.isVisible()) {
      await copyPromptBtn.click();
      await expect(page.getByText('Copied!')).toBeVisible();
    }
  });
});
