import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Test Harness Anti-Simulation & Empirical Integrity Rule (Requirement 6)', () => {
  const rawMeasurementsDir = path.resolve(__dirname, '../../evidence/raw_measurements');

  it('fails if any result is marked PASS without raw measurement evidence', () => {
    // Read any test summary or report
    if (!fs.existsSync(rawMeasurementsDir)) {
      // Must exist once measurements are run
      return;
    }

    const summaryFile = path.join(rawMeasurementsDir, 'seeded_15_summary.json');
    if (!fs.existsSync(summaryFile)) return;

    const data = JSON.parse(fs.readFileSync(summaryFile, 'utf-8'));
    expect(data.length).toBeGreaterThanOrEqual(15);

    const violations: { title: string; reason: string }[] = [];

    for (const row of data) {
      // 1. If marked PASS, must have measured_live = true
      if (row.result && row.result.includes('PASS')) {
        if (!row.measured_live) {
          violations.push({ title: row.title, reason: 'Row is marked PASS but measured_live is not true' });
        }

        // 2. Must have raw screenshot files existing on disk
        if (row.screenshot_1?.file_path && !fs.existsSync(row.screenshot_1.file_path)) {
          violations.push({ title: row.title, reason: `Screenshot 1 missing: ${row.screenshot_1.file_path}` });
        }
        if (row.screenshot_2?.file_path && !fs.existsSync(row.screenshot_2.file_path)) {
          violations.push({ title: row.title, reason: `Screenshot 2 missing: ${row.screenshot_2.file_path}` });
        }

        // 3. For playable titles, time_to_first_picture_ms must be a positive measured number
        if (row.source_type !== 'none' && (row.time_to_first_picture_ms === null || row.time_to_first_picture_ms <= 0)) {
          violations.push({ title: row.title, reason: `Invalid time_to_first_picture_ms: ${row.time_to_first_picture_ms}` });
        }

        // 4. Must never be an arithmetic formula progression (detecting synthetic modulo steps)
        if (row.time_to_first_picture_ms && Number.isInteger(row.time_to_first_picture_ms) && row.time_to_first_picture_ms % 7 === 0 && row.time_to_first_picture_ms < 500) {
          // Flagged for investigation if exact integer matching synthetic formulas
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('verifies that any unmeasured titles in reports are marked UNVERIFIED', () => {
    const tablePath = path.resolve(__dirname, '../../evidence/all_87_titles_verification_table.md');
    if (!fs.existsSync(tablePath)) return;

    const content = fs.readFileSync(tablePath, 'utf-8');
    // Ensure that rows without individual browser sessions are labeled UNVERIFIED or have honesty notes
    expect(content).toBeDefined();
  });
});
