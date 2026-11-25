import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Hosted Title and Clip Match Audit (Requirement 4)', () => {
  const trailersDir = path.resolve(__dirname, '../../public/trailers');

  it('fails if any hosted clip does not have a matching title overlay / captions file containing the movie name', () => {
    expect(fs.existsSync(trailersDir)).toBe(true);

    const vttFiles = fs.readdirSync(trailersDir).filter(f => f.endsWith('_captions.vtt'));
    expect(vttFiles.length).toBeGreaterThanOrEqual(51);

    const mismatches: { file: string; reason: string }[] = [];

    for (const vttFile of vttFiles) {
      const baseName = vttFile.replace('_captions.vtt', '');
      const mp4File = path.join(trailersDir, `${baseName}.mp4`);

      if (!fs.existsSync(mp4File)) {
        mismatches.push({ file: vttFile, reason: `Matching MP4 file ${baseName}.mp4 does not exist` });
        continue;
      }

      const vttContent = fs.readFileSync(path.join(trailersDir, vttFile), 'utf-8');
      
      // Expected words from slug in vtt content (e.g. "astra", "shadow", "chandni", "sinhagad", "showcase")
      const slugWords = baseName.split('-').filter(w => w.length > 3 && !['from', 'with', 'this'].includes(w));
      const matchesAnySlugWord = slugWords.some(w => vttContent.toLowerCase().includes(w.toLowerCase()));

      if (!matchesAnySlugWord) {
        mismatches.push({ file: vttFile, reason: `Title overlay text in ${vttFile} does not contain movie name words from ${baseName}` });
      }
    }

    // Must be strictly zero mismatches
    expect(mismatches).toEqual([]);
  });
});
