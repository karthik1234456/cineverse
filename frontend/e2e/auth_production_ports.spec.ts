import { test, expect } from '@playwright/test';

const PORTS = [3000, 3001];

test.describe('Authentication on Production Ports (3000 & 3001)', () => {
  for (const port of PORTS) {
    const origin = `http://localhost:${port}`;

    test(`Customer (patron@example.com) sign-in, session persistence, profile page, and logout on port ${port}`, async ({ page }) => {
      // Seed city storage keys
      await page.addInitScript(() => {
        try {
          localStorage.setItem('cineverse_city', 'bengaluru');
          localStorage.setItem('cineverse_city_id', '1');
          localStorage.setItem('cineverse_city_name', 'Bengaluru');
          localStorage.setItem('cineverse_city_modal_dismissed', 'true');
        } catch (e) {}
      });

      // 1. Visit homepage on target port
      await page.goto(`${origin}/`);
      await page.waitForLoadState('domcontentloaded');

      // 2. Open Auth modal
      const signInBtn = page.getByRole('button', { name: 'Sign In' });
      await expect(signInBtn).toBeVisible();
      await signInBtn.click();

      // 3. Fill customer credentials
      const modal = page.locator('.fixed.inset-0');
      await expect(modal).toBeVisible();
      await modal.locator('input[placeholder*="patron@example.com"]').fill('patron@example.com');
      await modal.locator('input[type="password"]').fill('Patron@123');

      // 4. Submit login
      const submitBtn = modal.locator('button[type="submit"]:has-text("Sign In")');
      await submitBtn.click();

      // 5. Verify modal closes and navbar displays user's name
      await expect(modal).not.toBeVisible();
      const userProfileBtn = page.locator('header a[href="/profile"]').filter({ hasText: 'Aditya' });
      await expect(userProfileBtn).toBeVisible();

      // 6. Test My Tickets / Profile protected page
      await userProfileBtn.click();
      await expect(page).toHaveURL(`${origin}/profile`);
      await expect(page.locator('h1, h2, span').filter({ hasText: 'Aditya' }).first()).toBeVisible();

      // 7. Test protected API fetch with cookies and credentials
      const meCheck = await page.evaluate(async () => {
        const res = await fetch('/api/v1/auth/me', { credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        return { status: res.status, ok: res.ok, role: data.role, email: data.email };
      });
      expect(meCheck.ok).toBe(true);
      expect(meCheck.email).toBe('patron@example.com');
      expect(meCheck.role).toBe('customer');

      // 8. Test Logout
      const logoutBtn = page.locator('header button[aria-label="Sign Out"], header button[title="Sign Out"]');
      await expect(logoutBtn).toBeVisible();
      await logoutBtn.click();

      // 9. Verify state returns to logged out
      await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
      await expect(page.locator('header a[href="/profile"]').filter({ hasText: 'Aditya' })).not.toBeVisible();
    });

    test(`Admin (admin@cineverse.com) sign-in and admin navigation on port ${port}`, async ({ page }) => {
      await page.addInitScript(() => {
        try {
          localStorage.setItem('cineverse_city', 'bengaluru');
          localStorage.setItem('cineverse_city_id', '1');
          localStorage.setItem('cineverse_city_name', 'Bengaluru');
          localStorage.setItem('cineverse_city_modal_dismissed', 'true');
        } catch (e) {}
      });

      await page.goto(`${origin}/`);
      await page.waitForLoadState('domcontentloaded');

      // Open Auth modal
      const signInBtn = page.getByRole('button', { name: 'Sign In' });
      await expect(signInBtn).toBeVisible();
      await signInBtn.click();

      // Fill admin credentials
      const modal = page.locator('.fixed.inset-0');
      await expect(modal).toBeVisible();
      await modal.locator('input[placeholder*="patron@example.com"]').fill('admin@cineverse.com');
      await modal.locator('input[type="password"]').fill('Admin@123');

      // Submit
      await modal.locator('button[type="submit"]:has-text("Sign In")').click();
      await expect(modal).not.toBeVisible();

      // Verify Admin Portal icon/link is visible in header
      const adminLink = page.locator('header a[href="/admin"]');
      await expect(adminLink).toBeVisible();

      // Verify role from protected API
      const roleCheck = await page.evaluate(async () => {
        const res = await fetch('/api/v1/auth/me', { credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        return { status: res.status, ok: res.ok, role: data.role };
      });
      expect(roleCheck.ok).toBe(true);
      expect(roleCheck.role).toBe('admin');

      // Logout
      const logoutBtn = page.locator('header button[aria-label="Sign Out"], header button[title="Sign Out"]');
      await logoutBtn.click();
      await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
    });

    test(`Error handling: wrong password shows clear error and never spins indefinitely on port ${port}`, async ({ page }) => {
      await page.addInitScript(() => {
        try {
          localStorage.setItem('cineverse_city', 'bengaluru');
          localStorage.setItem('cineverse_city_id', '1');
          localStorage.setItem('cineverse_city_name', 'Bengaluru');
          localStorage.setItem('cineverse_city_modal_dismissed', 'true');
        } catch (e) {}
      });

      await page.goto(`${origin}/`);
      await page.waitForLoadState('domcontentloaded');

      const signInBtn = page.getByRole('button', { name: 'Sign In' });
      await signInBtn.click();

      const modal = page.locator('.fixed.inset-0');
      await expect(modal).toBeVisible();
      await modal.locator('input[placeholder*="patron@example.com"]').fill('patron@example.com');
      await modal.locator('input[type="password"]').fill('WrongPassword999!');

      const submitBtn = modal.locator('button[type="submit"]:has-text("Sign In")');
      await submitBtn.click();

      // Verify explicit error message is displayed
      const errorNotice = modal.locator('.text-red-400');
      await expect(errorNotice).toBeVisible();
      await expect(errorNotice).toContainText('Invalid email/phone or password');

      // Verify button is re-enabled and not stuck in a spinner
      await expect(submitBtn).toBeEnabled();
      await expect(submitBtn).toHaveText('Sign In');
    });

    test(`Forgot password flow works smoothly on port ${port}`, async ({ page }) => {
      await page.addInitScript(() => {
        try {
          localStorage.setItem('cineverse_city', 'bengaluru');
          localStorage.setItem('cineverse_city_id', '1');
          localStorage.setItem('cineverse_city_name', 'Bengaluru');
          localStorage.setItem('cineverse_city_modal_dismissed', 'true');
        } catch (e) {}
      });

      await page.goto(`${origin}/`);
      await page.waitForLoadState('domcontentloaded');

      const signInBtn = page.getByRole('button', { name: 'Sign In' });
      await signInBtn.click();

      const modal = page.locator('.fixed.inset-0');
      await expect(modal).toBeVisible();

      // Click Forgot password?
      const forgotBtn = modal.locator('button:has-text("Forgot password?")');
      await expect(forgotBtn).toBeVisible();
      await forgotBtn.click();

      // Step 1: Request reset code
      await modal.locator('input[placeholder*="patron@example.com"]').fill('patron@example.com');
      await modal.locator('button[type="submit"]:has-text("Send Reset Code")').click();

      // Step 2: Code and new password inputs appear
      const codeInput = modal.locator('input[placeholder="123456"]');
      await expect(codeInput).toBeVisible();
      await codeInput.fill('123456');

      const pwdInput = modal.locator('input[placeholder="At least 6 characters"]');
      await pwdInput.fill('Patron@123');

      await modal.locator('button[type="submit"]:has-text("Save New Password")').click();

      // Verify success notification and return to sign in view
      const successNotice = modal.locator('.text-emerald-400');
      await expect(successNotice).toBeVisible();
    });

    test(`Developer readiness auth gateway testing from origin ${origin}`, async ({ page }) => {
      await page.addInitScript(() => {
        try {
          localStorage.setItem('cineverse_city', 'bengaluru');
          localStorage.setItem('cineverse_city_id', '1');
          localStorage.setItem('cineverse_city_name', 'Bengaluru');
          localStorage.setItem('cineverse_city_modal_dismissed', 'true');
        } catch (e) {}
      });

      await page.goto(`${origin}/dev/readiness`);
      await page.waitForLoadState('domcontentloaded');

      // Verify Auth & Origin Gateway card is rendered
      const authCard = page.locator('[data-testid="auth-readiness-card"]');
      await expect(authCard).toBeVisible();
      await expect(authCard).toContainText('Auth, Session & Origin Gateways');
      await expect(authCard).toContainText('All Origins Ready');

      // Run live origin login test
      const testLoginBtn = page.locator('[data-testid="btn-test-auth-login"]');
      await expect(testLoginBtn).toBeVisible();
      await testLoginBtn.click();

      // Verify result box appears with success
      const resultBox = page.locator('[data-testid="auth-test-result-box"]');
      await expect(resultBox).toBeVisible();
      await expect(resultBox).toContainText('AUTHENTICATION SUCCESSFUL');
      await expect(resultBox).toContainText(origin);
    });
  }
});
