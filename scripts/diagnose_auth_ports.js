const { chromium } = require('../frontend/node_modules/@playwright/test');
const fs = require('fs');

async function testPort(port) {
  console.log(`\n======================================================`);
  console.log(`RUNNING AUTH TESTS ON PORT ${port}`);
  console.log(`======================================================`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const logs = {
    port,
    requests: [],
    consoleErrors: [],
    cspOrCorsErrors: [],
    cookies: [],
    results: {}
  };

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      logs.consoleErrors.push(text);
      if (text.includes('Content Security Policy') || text.includes('CORS') || text.includes('Access-Control')) {
        logs.cspOrCorsErrors.push(text);
      }
    }
  });

  page.on('requestfailed', req => {
    logs.cspOrCorsErrors.push(`FAILED: ${req.method()} ${req.url()} - ${req.failure()?.errorText}`);
  });

  page.on('response', async res => {
    const url = res.url();
    if (url.includes('/api/v1/auth') || url.includes('/profile') || url.includes('/admin')) {
      let body = '';
      try {
        const json = await res.json();
        // sanitize secrets
        const sanitized = { ...json };
        if (sanitized.access_token) sanitized.access_token = '[REDACTED_ACCESS_TOKEN]';
        if (sanitized.refresh_token) sanitized.refresh_token = '[REDACTED_REFRESH_TOKEN]';
        body = JSON.stringify(sanitized);
      } catch {
        body = `[non-json status ${res.status()}]`;
      }
      logs.requests.push({
        url,
        method: res.request().method(),
        status: res.status(),
        responseBody: body
      });
    }
  });

  try {
    // 1. Visit homepage
    await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // 2. Test Register
    console.log(`Testing register on port ${port}...`);
    const regEmail = `test_${Date.now()}@example.com`;
    const regRes = await page.evaluate(async (email) => {
      try {
        const res = await fetch('/api/v1/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password: 'Password@123',
            full_name: 'Test Patron'
          })
        });
        return { status: res.status, ok: res.ok };
      } catch (e) {
        return { error: e.message };
      }
    }, regEmail);
    logs.results.register = regRes;

    // 3. Test Email/Password Login
    console.log(`Testing email login on port ${port}...`);
    const loginRes = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            email: 'patron@example.com',
            password: 'Patron@123'
          })
        });
        const data = await res.json().catch(() => ({}));
        if (data.access_token) {
          localStorage.setItem('cineverse_token', data.access_token);
          localStorage.setItem('cineverse_user', JSON.stringify(data));
        }
        return { status: res.status, ok: res.ok, hasToken: !!data.access_token };
      } catch (e) {
        return { error: e.message };
      }
    });
    logs.results.emailLogin = loginRes;

    // Check cookies after login
    const cookiesAfterLogin = await context.cookies();
    logs.cookies = cookiesAfterLogin;

    // 4. Test Phone OTP Login
    console.log(`Testing phone OTP login on port ${port}...`);
    const otpRes = await page.evaluate(async () => {
      try {
        const sendRes = await fetch('/api/v1/auth/otp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: '9988776655' })
        });
        const verifyRes = await fetch('/api/v1/auth/otp/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: '9988776655', otp: '123456' })
        });
        return {
          sendOk: sendRes.ok,
          verifyOk: verifyRes.ok,
          verifyStatus: verifyRes.status
        };
      } catch (e) {
        return { error: e.message };
      }
    });
    logs.results.phoneOtpLogin = otpRes;

    // 5. Test Refresh Token Rotation
    console.log(`Testing refresh token rotation on port ${port}...`);
    const refreshRes = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/v1/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({})
        });
        const data = await res.json().catch(() => ({}));
        return { status: res.status, ok: res.ok, rotated: !!data.refresh_token };
      } catch (e) {
        return { error: e.message };
      }
    });
    logs.results.refreshTokenRotation = refreshRes;

    // 6. Test Forgot Password
    console.log(`Testing forgot password on port ${port}...`);
    const forgotRes = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/v1/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'patron@example.com' })
        });
        return { status: res.status, ok: res.ok };
      } catch (e) {
        return { error: e.message };
      }
    });
    logs.results.forgotPassword = forgotRes;

    // 7. Test Protected Pages & API
    console.log(`Testing protected endpoints on port ${port}...`);
    const meRes = await page.evaluate(async () => {
      try {
        const token = localStorage.getItem('cineverse_token');
        const res = await fetch('/api/v1/auth/me', {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        return { status: res.status, ok: res.ok };
      } catch (e) {
        return { error: e.message };
      }
    });
    logs.results.protectedAuthMe = meRes;

    // Test UI modal interactions on port
    await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle' });
    const signInBtn = await page.$('button:has-text("Sign In")');
    if (signInBtn) {
      await signInBtn.click();
      await page.waitForTimeout(500);
      const emailInput = await page.$('input[placeholder*="patron@example.com"]');
      const passInput = await page.$('input[type="password"]');
      const submitBtn = await page.$('button:has-text("Sign In")');
      if (emailInput && passInput && submitBtn) {
        await emailInput.fill('patron@example.com');
        await passInput.fill('WrongPassword!');
        await submitBtn.click();
        await page.waitForTimeout(800);
        const errorText = await page.textContent('.text-red-400');
        logs.results.wrongPasswordErrorDisplay = errorText;
      }
    }

  } catch (err) {
    logs.error = err.message;
  } finally {
    await browser.close();
  }

  return logs;
}

async function main() {
  const log3000 = await testPort(3000);
  const log3001 = await testPort(3001);

  const out = { port3000: log3000, port3001: log3001 };
  fs.writeFileSync('scripts/auth_baseline_results.json', JSON.stringify(out, null, 2));
  console.log('\nResults saved to scripts/auth_baseline_results.json');
}

main().catch(console.error);
