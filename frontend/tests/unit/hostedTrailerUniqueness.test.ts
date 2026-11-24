import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

interface MovieRow {
  id: number;
  title: string;
  trailer_url: string | null;
  is_showcase: number;
}

describe('Hosted Trailer Uniqueness & Collision Prevention (Task 2)', () => {
  it('ensures no two hosted showcase titles share the same file or checksum', () => {
    // Read from SQLite database or public/trailers directory
    const trailersDir = path.resolve(__dirname, '../../public/trailers');
    expect(fs.existsSync(trailersDir)).toBe(true);

    const mp4Files = fs.readdirSync(trailersDir).filter(f => f.endsWith('.mp4'));
    expect(mp4Files.length).toBeGreaterThanOrEqual(50);

    const hashes = new Map<string, string>();
    const duplicateFiles: string[][] = [];

    for (const file of mp4Files) {
      const filePath = path.join(trailersDir, file);
      const buffer = fs.readFileSync(filePath);
      const hash = crypto.createHash('sha256').update(buffer).digest('hex');

      if (hashes.has(hash)) {
        duplicateFiles.push([hashes.get(hash)!, file]);
      } else {
        hashes.set(hash, file);
      }
    }

    // Must fail if any two hosted clips share the same checksum
    expect(duplicateFiles).toEqual([]);
  });

  it('verifies Quantum Odyssey and Sample Showcase have distinct files and checksums', () => {
    const trailersDir = path.resolve(__dirname, '../../public/trailers');
    const qoPath = path.join(trailersDir, 'quantum-odyssey.mp4');
    const ssPath = path.join(trailersDir, 'sample-showcase.mp4');

    expect(fs.existsSync(qoPath)).toBe(true);
    expect(fs.existsSync(ssPath)).toBe(true);

    const qoHash = crypto.createHash('sha256').update(fs.readFileSync(qoPath)).digest('hex');
    const ssHash = crypto.createHash('sha256').update(fs.readFileSync(ssPath)).digest('hex');

    expect(qoHash).not.toEqual(ssHash);
  });
});
