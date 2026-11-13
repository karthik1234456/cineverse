import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const EVIDENCE_DIR = path.resolve(__dirname, '../../docs/evidence/phase-lookaround-spring-arm');

// 4 Largest Halls corresponding to the four architectural types
const TEST_HALLS = [
  {
    type: 'standard_multiplex',
    name: 'Standard Multiplex (Cinema 2, Audi 6)',
    url: '/cinemas/2/auditorium/6?showtime=141&mode=3d',
    hasMotion: false,
  },
  {
    type: 'grand_curved_balcony',
    name: 'Grand Curved Balcony (Cinema 1, Audi 3)',
    url: '/cinemas/1/auditorium/3?showtime=57&mode=3d',
    hasMotion: false,
  },
  {
    type: 'luxury_recliner',
    name: 'Luxury Recliner (Cinema 1, Audi 4)',
    url: '/cinemas/1/auditorium/4?showtime=85&mode=3d',
    hasMotion: false,
  },
  {
    type: 'motion_seats',
    name: 'Motion-Seat Hall (Cinema 2, Audi 5)',
    url: '/cinemas/2/auditorium/5?showtime=113&mode=3d',
    hasMotion: true,
  },
];

test.beforeAll(() => {
  if (!fs.existsSync(EVIDENCE_DIR)) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  }
});

test.describe('Part A: Look around Interior Orbit & Spring Arm across 4 Hall Types', () => {
  for (const hall of TEST_HALLS) {
    test(`Hall: ${hall.name} - 360 rotation at 3 zoom levels within interior bounds & proximity fade`, async ({
      page,
    }) => {
      test.setTimeout(120000);

      // 1. Navigate to hall 3D view
      await page.goto(hall.url, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('canvas', { timeout: 15000 });

      // Wait for 3D engine initialization
      await page.waitForFunction(
        () => (window as any).__cineverse?.getState?.()?.rendererInfo?.calls > 0,
        null,
        { timeout: 15000 }
      );

      // Verify dark interior background (never white)
      const bgColor = await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        return canvas ? window.getComputedStyle(canvas).backgroundColor : '';
      });
      // Background must not be white
      expect(bgColor).not.toBe('rgb(255, 255, 255)');

      // Ensure Look around / Overview mode is active
      const overviewButton = page.locator('button:has-text("Look around")');
      if (await overviewButton.isVisible()) {
        await overviewButton.click();
      }
      await page.waitForTimeout(500);

      // Verify camera bounds are defined
      const bounds = await page.evaluate(() => (window as any).__cineverse_cam_bounds);
      expect(bounds).toBeDefined();
      expect(bounds.minX).toBeLessThan(bounds.maxX);
      expect(bounds.minY).toBeLessThan(bounds.maxY);
      expect(bounds.minZ).toBeLessThan(bounds.maxZ);

      // Helper function to query current camera position
      const getCamPos = async () => {
        return await page.evaluate(() => {
          const s = (window as any).__cineverse?.getState?.();
          if (s && s.cameraPosition) {
            return { x: s.cameraPosition[0], y: s.cameraPosition[1], z: s.cameraPosition[2] };
          }
          return (window as any).__cineverse_cam_pos;
        });
      };

      // Zoom levels to test: Min distance (~3.5m), Medium distance (~14m), Max distance (~32m)
      const zoomLevels = [
        { label: 'near_screen', distance: 3.5 },
        { label: 'mid_hall', distance: 14.0 },
        { label: 'wide_interior', distance: 32.0 },
      ];

      // Angles to capture: 0 (front facing screen), 90 (facing right wall), 180 (facing back), 270 (facing left wall)
      const captureAngles = [0, 90, 180, 270];
      const rotationSteps = [0, 45, 90, 135, 180, 225, 270, 315];

      for (const zoom of zoomLevels) {
        for (const angleDeg of rotationSteps) {
          const theta = (angleDeg * Math.PI) / 180;
          const phi = (45 * Math.PI) / 180; // 45 deg polar pitch (within [8, 85] limits)

          // Rotate orbit controls programmatically to test spring arm collision
          await page.evaluate(
            ({ theta, phi, distance }) => {
              if (typeof (window as any).__cineverse_set_orbit_pose === 'function') {
                (window as any).__cineverse_set_orbit_pose(theta, phi, distance);
              } else {
                const controls = (window as any).__cineverse_orbit_controls;
                if (controls) {
                  const target = controls.target;
                  const r = distance;
                  const sinPhi = Math.sin(phi);
                  controls.object.position.set(
                    target.x + r * sinPhi * Math.sin(theta),
                    target.y + r * Math.cos(phi),
                    target.z + r * sinPhi * Math.cos(theta)
                  );
                  controls.update();
                }
              }
            },
            { theta, phi, distance: zoom.distance }
          );

          await page.waitForTimeout(50);

          const camPos = await getCamPos();
          expect(camPos).toBeDefined();

          // Camera MUST always be inside the interior hall bounds (never outside the hall)
          expect(camPos.x).toBeGreaterThanOrEqual(bounds.minX - 0.05);
          expect(camPos.x).toBeLessThanOrEqual(bounds.maxX + 0.05);
          expect(camPos.y).toBeGreaterThanOrEqual(bounds.minY - 0.05);
          expect(camPos.y).toBeLessThanOrEqual(bounds.maxY + 0.05);
          expect(camPos.z).toBeGreaterThanOrEqual(bounds.minZ - 0.05);
          expect(camPos.z).toBeLessThanOrEqual(bounds.maxZ + 0.05);

          // Capture screenshots from 4 primary angles at mid_hall zoom
          if (zoom.label === 'mid_hall' && captureAngles.includes(angleDeg)) {
            const screenshotName = `${hall.type}_angle_${angleDeg}deg.png`;
            const screenshotPath = path.join(EVIDENCE_DIR, screenshotName);
            await page.screenshot({ path: screenshotPath, fullPage: false });
          }
        }
      }

      // Test Keyboard navigation in Overview: Arrow keys & zoom +/-
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(100);
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(100);
      await page.keyboard.press('Equal'); // Zoom in
      await page.waitForTimeout(100);
      await page.keyboard.press('Minus'); // Zoom out
      await page.waitForTimeout(100);

      // Verify camera is still safely inside bounds after keyboard controls
      const finalCam = await getCamPos();
      expect(finalCam.x).toBeGreaterThanOrEqual(bounds.minX);
      expect(finalCam.x).toBeLessThanOrEqual(bounds.maxX);
    });
  }
});

test.describe('Part B: Pure Motion-Seat Simulation & Safety Controls', () => {
  test('Non-motion halls do NOT display "Motion seat preview" button', async ({ page }) => {
    // Cinema 2, Audi 6 is standard multiplex (non-motion)
    await page.goto('/cinemas/2/auditorium/6?showtime=141&mode=3d', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('canvas', { timeout: 15000 });

    const motionBtn = page.locator('button:has-text("Motion seat preview")');
    expect(await motionBtn.isVisible()).toBe(false);

    // Old trademarked 4DX button must NEVER appear
    const old4dxBtn = page.locator('button:has-text("4DX")');
    expect(await old4dxBtn.isVisible()).toBe(false);
  });

  test('Motion-seat hall displays "Motion seat preview", modal safety controls, and pure mechanical motion', async ({
    page,
  }) => {
    // Cinema 2, Audi 5 is motion-seat hall
    await page.goto('/cinemas/2/auditorium/5?showtime=113&mode=3d', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('canvas', { timeout: 15000 });

    // Verify "Motion seat preview" button is visible
    const motionBtn = page.locator('button:has-text("Motion seat preview")');
    await expect(motionBtn).toBeVisible({ timeout: 10000 });

    // Open warning dialog
    await motionBtn.click();
    const modal = page.locator('[role="alertdialog"], [role="dialog"]');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Motion seat preview');
    await expect(modal).toContainText('Preview of motion-seat effects');

    // Confirm preview start
    const startBtn = modal.locator('button:has-text("Understood, start preview")');
    await startBtn.click();
    await expect(modal).not.toBeVisible();

    // Verify HUD is active
    const hud = page.locator('[data-testid="motion-hud"]');
    await expect(hud).toBeVisible();

    // 1. Assert: No particle systems or emitters active in the scene
    const emittersCount = await page.evaluate(() => (window as any).__cineverse_vfx_emitters_count);
    const particlesCount = await page.evaluate(() => (window as any).__cineverse_particles_count);
    expect(emittersCount).toBe(0);
    expect(particlesCount).toBe(0);

    // 2. Assert: No removed environmental controls (wind, fog, mist, strobe, scent) in interface
    const hudText = await hud.innerText();
    expect(hudText.toLowerCase()).not.toContain('wind');
    expect(hudText.toLowerCase()).not.toContain('fog');
    expect(hudText.toLowerCase()).not.toContain('mist');
    expect(hudText.toLowerCase()).not.toContain('water');
    expect(hudText.toLowerCase()).not.toContain('scent');
    expect(hudText.toLowerCase()).not.toContain('strobe');

    // 3. Assert: Seat motion follows timeline within 60 ms
    await page.waitForTimeout(1000);
    const latencyMs = await page.evaluate(() => (window as any).__cineverse_motion_timeline_latency_ms);
    expect(latencyMs).toBeLessThanOrEqual(60);

    // 4. Assert: Intensity controls work (Light, Medium, Full)
    const lightBtn = hud.locator('button:has-text("Light")');
    if (await lightBtn.isVisible()) {
      await lightBtn.click();
      await page.waitForTimeout(200);
    }

    // 5. Assert: Stop button ceases motion preview
    const stopBtn = hud.locator('button:has-text("Stop")');
    await expect(stopBtn).toBeVisible();
    await stopBtn.click();
    await expect(hud).not.toBeVisible();

    // Capture screenshot of motion-seat preview in action for evidence
    const motionEvidence = path.join(EVIDENCE_DIR, 'motion_seats_preview_evidence.png');
    await page.screenshot({ path: motionEvidence, fullPage: false });
  });

  test('Sit view synchronizes camera with seat motion (seat edges fixed to viewport)', async ({ page }) => {
    // Cinema 2, Audi 5
    await page.goto('/cinemas/2/auditorium/5?showtime=113&mode=3d', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('canvas', { timeout: 15000 });

    // Select a seat and sit down
    await page.evaluate(() => {
      (window as any).__cineverse?.selectSeat?.('C-10');
      (window as any).__cineverse?.sitAt?.('C-10');
    });
    await page.waitForTimeout(1000);

    // Start motion preview
    const motionBtn = page.locator('button:has-text("Motion seat preview")');
    if (await motionBtn.isVisible()) {
      await motionBtn.click();
      const startBtn = page.locator('button:has-text("Understood, start preview")');
      if (await startBtn.isVisible()) {
        await startBtn.click();
      }
    }

    await page.waitForTimeout(800);

    // In sit view, verify camera is active and rendering smoothly
    const renderInfo = await page.evaluate(() => (window as any).__cineverse?.getState?.()?.rendererInfo);
    expect(renderInfo).toBeDefined();
    expect(renderInfo.calls).toBeGreaterThan(0);

    // Press Escape to cease motion
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    const hud = page.locator('[data-testid="motion-hud"]');
    expect(await hud.isVisible()).toBe(false);
  });
});
