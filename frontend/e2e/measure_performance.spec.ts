import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const EVIDENCE_DIR = path.join(__dirname, '../../docs/evidence/phase-2d');

test.describe('Phase 2d — Part D: Performance & Frame Time Profiling', () => {
  test('Scripted interaction profiling (60s benchmark: hover sweep, orbit, walk, sit, modes)', async ({ page }) => {
    test.setTimeout(180000);
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

    await page.goto('/cinemas/1/auditorium/1?showtime=1&mode=3d');
    await page.waitForFunction(() => !!window.__cineverse, { timeout: 35000 });
    await page.waitForTimeout(2000);

    // Initial render info
    const initialStats = await page.evaluate(() => window.__cineverse!.getState().rendererInfo);
    console.log('[Initial Renderer Stats]', initialStats);

    // Run scripted interaction while sampling frame times and performance
    const frameSamples = await page.evaluate(async () => {
      const times: number[] = [];
      let lastTime = performance.now();
      let active = true;

      function onFrame() {
        if (!active) return;
        const now = performance.now();
        times.push(now - lastTime);
        lastTime = now;
        requestAnimationFrame(onFrame);
      }
      requestAnimationFrame(onFrame);

      // Scripted 1: Hover sweep across rows A through J
      const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
      for (const row of rows) {
        for (let num = 1; num <= 10; num++) {
          const seatId = `${row}${String(num).padStart(2, '0')}`;
          window.__cineverse!.setHoveredSeat(seatId);
          await new Promise((r) => setTimeout(r, 20));
        }
      }
      window.__cineverse!.setHoveredSeat(null);

      // Scripted 2: Orbit camera presets
      const presets: any[] = ['overview', 'front', 'back', 'aerial', 'overview'];
      for (const p of presets) {
        window.__cineverse!.setCameraPreset(p);
        await new Promise((r) => setTimeout(r, 400));
      }

      // Scripted 3: Walk mode navigation and row jumps
      window.__cineverse!.setMode('walk');
      await new Promise((r) => setTimeout(r, 600));
      const walkRows = ['B', 'D', 'F', 'H', 'J', 'E'];
      for (const r of walkRows) {
        window.__cineverse!.teleportToRow(r);
        await new Promise((r) => setTimeout(r, 300));
      }

      // Scripted 4: Sit down at seat and seated pov next/prev
      window.__cineverse!.sitAt('E05');
      await new Promise((r) => setTimeout(r, 600));

      // Scripted 5: Return to overview
      window.__cineverse!.setMode('overview');
      await new Promise((r) => setTimeout(r, 800));

      active = false;
      return times;
    });

    const finalStats = await page.evaluate(() => {
      const state = window.__cineverse!.getState();
      const memory = (performance as any).memory ? {
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
      } : null;
      return {
        rendererInfo: state.rendererInfo,
        memory,
      };
    });

    console.log('[Final Renderer Stats]', finalStats);

    // Compute percentiles (p50, p95, p99)
    const sorted = [...frameSamples].filter((t) => t > 0).sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.50)] || 0;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
    const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;
    const avgFps = sorted.length > 0 ? 1000 / (sorted.reduce((a, b) => a + b, 0) / sorted.length) : 0;

    const report = {
      totalFramesSampled: sorted.length,
      p50FrameTimeMs: parseFloat(p50.toFixed(2)),
      p95FrameTimeMs: parseFloat(p95.toFixed(2)),
      p99FrameTimeMs: parseFloat(p99.toFixed(2)),
      averageFps: parseFloat(avgFps.toFixed(1)),
      drawCalls: finalStats.rendererInfo?.calls ?? 0,
      triangles: finalStats.rendererInfo?.triangles ?? 0,
      geometries: finalStats.rendererInfo?.geometries ?? 0,
      textures: finalStats.rendererInfo?.textures ?? 0,
      memory: finalStats.memory,
    };

    console.log('[Performance Profile Result]', report);

    fs.writeFileSync(
      path.join(EVIDENCE_DIR, 'performance_profile.json'),
      JSON.stringify(report, null, 2),
      'utf-8'
    );

    expect(report.totalFramesSampled).toBeGreaterThan(20);
    expect(report.triangles).toBeGreaterThan(1000);
    expect(report.drawCalls).toBeLessThan(200);
  });
});

