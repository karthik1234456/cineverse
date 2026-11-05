import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const EVIDENCE_DIR = path.join(__dirname, '../../docs/evidence/phase-2d');

test.describe('Phase 2d — Parts D, E, F, G Comprehensive Verification', () => {
  test.beforeAll(() => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('cineverse_city', 'bengaluru');
    });
  });

  test('Part E: Immersive Fullscreen, Minimal 3-Way Switch, Settings Menu, & Single Docked Card', async ({ page }) => {
    test.setTimeout(120000);
    await page.goto('/cinemas/1/auditorium/1?showtime=1&mode=3d');
    await page.waitForFunction(() => !!window.__cineverse, { timeout: 35000 });
    await page.waitForTimeout(2000);

    // 1. Verify Immersive Layout: Navbar and Footer are hidden on 3D route
    const navbar = page.locator('nav');
    const footer = page.locator('footer');
    await expect(navbar).toBeHidden();
    await expect(footer).toBeHidden();

    // 2. Verify Slim Top Bar with 2D Seat Map & Fullscreen button
    const backBtn = page.locator('[data-testid="switch-to-2d-button"]');
    const fullscreenBtn = page.locator('[data-testid="fullscreen-toggle-btn"]');
    await expect(backBtn).toBeVisible();
    await expect(fullscreenBtn).toBeVisible();

    // Take screenshot of immersive top bar and clean room
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'part_e_01_immersive_fullscreen.png') });

    // 3. Verify Minimal 3-Way Switch: Look around, Walk Mode, Sit
    await expect(page.locator('button:has-text("Look around")')).toBeVisible();
    await expect(page.locator('button:has-text("Walk Mode")')).toBeVisible();
    await expect(page.locator('button:has-text("Sit")')).toBeVisible();

    // 4. Open Settings Menu
    const settingsToggle = page.locator('[data-testid="settings-menu-toggle"]');
    await expect(settingsToggle).toBeVisible();
    await settingsToggle.click();
    await page.waitForTimeout(400);

    const settingsPopover = page.locator('[data-testid="settings-popover"]');
    await expect(settingsPopover).toBeVisible();
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'part_e_02_settings_popover.png') });

    // Close settings menu
    await settingsToggle.click();
    await page.waitForTimeout(300);

    // 5. Single Docked Card on Seat Click (Finding F6 fixed)
    await page.evaluate(() => {
      window.__cineverse!.selectSeat('D02');
      window.__cineverse!.setHoveredSeat('C06');
    });
    await page.waitForTimeout(600);

    const dockedCard = page.locator('text=Seat D02').first();
    await expect(dockedCard).toBeVisible();
    await expect(page.locator('text=No obstruction found by our estimate').first()).toBeVisible();

    // Part H item 9: Hover tooltip never contains a button or numeric score
    const hoverTooltip = page.locator('[data-testid="seat-tooltip-C06"]');
    await expect(hoverTooltip).toBeVisible();
    const tooltipButtons = await hoverTooltip.locator('button').count();
    expect(tooltipButtons).toBe(0);
    const tooltipText = await hoverTooltip.innerText();
    expect(tooltipText).not.toMatch(/\d+\s*\/\s*100/);

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'part_e_03_single_docked_card.png') });

    // 6. Typography Check: verify no visible text on 3D page is under 14px
    const smallTextViolations = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      const violations: string[] = [];
      for (const el of allElements) {
        if (el.children.length === 0 && el.textContent?.trim()) {
          const style = window.getComputedStyle(el);
          if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
            const fontSize = parseFloat(style.fontSize);
            if (fontSize < 13.5) {
              violations.push(`${el.tagName}.${el.className} [${fontSize}px]: "${el.textContent?.trim()}"`);
            }
          }
        }
      }
      return violations;
    });
    console.log('[Typography Scan Violations Count]', smallTextViolations.length, smallTextViolations);
    expect(smallTextViolations.length).toBe(0);
  });

  test('Part F: Three Selectable Aesthetic Looks (A, B, C) & Lights Up vs Show', async ({ page }) => {
    test.setTimeout(120000);

    // 1. Look A: Royal Burgundy and Gold (Default)
    await page.goto('/cinemas/1/auditorium/1?showtime=1&mode=3d&look=a');
    await page.waitForFunction(() => !!window.__cineverse, { timeout: 35000 });
    await page.waitForTimeout(1500);
    const stateA = await page.evaluate(() => window.__cineverse!.getState());
    expect(stateA.theatreLook).toBe('a');
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'part_f_01_look_a_royal_burgundy.png') });

    // 2. Look B: Warm Walnut and Cream
    await page.goto('/cinemas/1/auditorium/1?showtime=1&mode=3d&look=b');
    await page.waitForFunction(() => !!window.__cineverse, { timeout: 35000 });
    await page.waitForTimeout(1500);
    const stateB = await page.evaluate(() => window.__cineverse!.getState());
    expect(stateB.theatreLook).toBe('b');
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'part_f_02_look_b_warm_walnut.png') });

    // 3. Look C: Midnight Indigo and Teal
    await page.goto('/cinemas/1/auditorium/1?showtime=1&mode=3d&look=c');
    await page.waitForFunction(() => !!window.__cineverse, { timeout: 35000 });
    await page.waitForTimeout(1500);
    const stateC = await page.evaluate(() => window.__cineverse!.getState());
    expect(stateC.theatreLook).toBe('c');
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'part_f_03_look_c_midnight_indigo.png') });

    // 4. Lights Up vs Show Mode Transition
    await page.evaluate(() => window.__cineverse!.setHouseLights('show'));
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'part_f_04_show_mode_cinematic.png') });

    await page.evaluate(() => window.__cineverse!.setHouseLights('full'));
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'part_f_04_lights_up_bright.png') });
  });

  test('Part G: Realistic Luxury Seating & Integrated In-Seat States (No Dot Badges)', async ({ page }) => {
    test.setTimeout(120000);
    await page.goto('/cinemas/1/auditorium/1?showtime=1&mode=3d');
    await page.waitForFunction(() => !!window.__cineverse, { timeout: 35000 });
    await page.waitForTimeout(1500);

    // Verify zero orange dot markers or small "x" badges in DOM
    const dotBadges = page.locator('text=●');
    const crossBadges = page.locator('text=✕');
    await expect(dotBadges).toHaveCount(0);
    await expect(crossBadges).toHaveCount(0);

    // Camera viewpoint close to seats
    await page.evaluate(() => window.__cineverse!.setCameraPreset('front'));
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'part_g_01_seat_close_up_front.png') });

    // Seated POV close-up
    await page.evaluate(() => window.__cineverse!.sitAt('D04'));
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'part_g_02_seated_pov_d04.png') });
  });
});

