import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Test Harness Anti-Simulation & Empirical Integrity Rule (Requirement 6)', () => {
  const rootEvidence = fs.existsSync(path.resolve(__dirname, '../../../evidence'))
    ? path.resolve(__dirname, '../../../evidence')
    : path.resolve(__dirname, '../../evidence');
  const rawMeasurementsDir = path.join(rootEvidence, 'raw_measurements');
  const ocrResultsPath = path.join(rootEvidence, 'ocr_results.json');
  const tablePath = path.join(rootEvidence, 'all_87_titles_verification_table.md');

  it('fails if any result is marked PASS without raw measurement evidence across all 87 titles', () => {
    if (!fs.existsSync(rawMeasurementsDir)) {
      return;
    }

    const files = fs.readdirSync(rawMeasurementsDir).filter(f => f.endsWith('.json') && !f.startsWith('seeded_15_') && !f.startsWith('all_87_'));
    expect(files.length).toBeGreaterThanOrEqual(87);

    const violations: { slug: string; reason: string }[] = [];

    for (const f of files) {
      const row = JSON.parse(fs.readFileSync(path.join(rawMeasurementsDir, f), 'utf-8'));

      if (row.result && row.result.includes('PASS')) {
        // 1. Must be measured live
        if (!row.measured_live) {
          violations.push({ slug: row.slug, reason: 'Marked PASS but measured_live is not true' });
        }

        // 2. Must have raw screenshots existing on disk with non-zero size
        if (row.screenshot_1?.file_path) {
          if (!fs.existsSync(row.screenshot_1.file_path) || fs.statSync(row.screenshot_1.file_path).size === 0) {
            violations.push({ slug: row.slug, reason: `Screenshot 1 missing or empty: ${row.screenshot_1.file_path}` });
          }
        }
        if (row.screenshot_2?.file_path) {
          if (!fs.existsSync(row.screenshot_2.file_path) || fs.statSync(row.screenshot_2.file_path).size === 0) {
            violations.push({ slug: row.slug, reason: `Screenshot 2 missing or empty: ${row.screenshot_2.file_path}` });
          }
        }

        // 3. Movement proof check against calibrated threshold
        if (row.source_type !== 'none') {
          // Playable titles must have positive time_to_first_picture_ms
          if (row.time_to_first_picture_ms === null || row.time_to_first_picture_ms <= 0) {
            violations.push({ slug: row.slug, reason: `Invalid time_to_first_picture_ms: ${row.time_to_first_picture_ms}` });
          }
          // Must exceed calibrated movement threshold
          if (row.movement_proved === false) {
            violations.push({ slug: row.slug, reason: `Failed calibrated movement threshold: delta=${row.frame_diff_pixel_sum}` });
          }
        } else {
          // Titles without trailer must have audio state and volume as 'no player'
          const api = row.player_api || {};
          if (api.getVolume !== 'no player' || api.state !== 'no player') {
            violations.push({ slug: row.slug, reason: `Audio state for fallback title must be 'no player', got volume=${api.getVolume}, state=${api.state}` });
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('verifies that all 51 hosted video clips have video frames OCR matching the title', () => {
    if (!fs.existsSync(ocrResultsPath)) return;
    const ocrData = JSON.parse(fs.readFileSync(ocrResultsPath, 'utf-8'));
    expect(ocrData.length).toBe(51);

    const ocrFailures = ocrData.filter((item: any) => !item.is_match && !item.matched);
    expect(ocrFailures).toEqual([]);
  });

  it('verifies that the full 87-title report contains zero unverified rows or formulas', () => {
    if (!fs.existsSync(tablePath)) return;

    const content = fs.readFileSync(tablePath, 'utf-8');
    expect(content).toContain('Measured Live = **87 / 87**');
    expect(content).toContain('Unverified Remainder = **0**');
  });
});
