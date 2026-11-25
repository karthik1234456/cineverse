import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { execFileSync } from 'child_process';

describe('Hosted Trailer Uniqueness & Perceptual Distinction (Task 1 & Task 2)', () => {
  const trailersDir = path.resolve(__dirname, '../../public/trailers');
  const ffmpegPath = path.resolve(__dirname, '../../node_modules/ffmpeg-static/ffmpeg.exe');

  it('ensures no two hosted showcase titles share the same file or checksum', () => {
    expect(fs.existsSync(trailersDir)).toBe(true);

    const mp4Files = fs.readdirSync(trailersDir).filter(f => f.endsWith('.mp4'));
    expect(mp4Files.length).toBeGreaterThanOrEqual(51);

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
    const qoPath = path.join(trailersDir, 'quantum-odyssey.mp4');
    const ssPath = path.join(trailersDir, 'sample-showcase.mp4');

    expect(fs.existsSync(qoPath)).toBe(true);
    expect(fs.existsSync(ssPath)).toBe(true);

    const qoHash = crypto.createHash('sha256').update(fs.readFileSync(qoPath)).digest('hex');
    const ssHash = crypto.createHash('sha256').update(fs.readFileSync(ssPath)).digest('hex');

    expect(qoHash).not.toEqual(ssHash);
  });

  it('verifies perceptual distinctness: sample frame dHash distance between clips exceeds similarity threshold', () => {
    // Check that Quantum Odyssey and Sample Showcase have distinct visual frames (perceptual distance)
    const qoPath = path.join(trailersDir, 'quantum-odyssey.mp4');
    const ssPath = path.join(trailersDir, 'sample-showcase.mp4');

    const qoFrame = path.resolve(__dirname, '../../tmp_qo_frame.raw');
    const ssFrame = path.resolve(__dirname, '../../tmp_ss_frame.raw');

    // Extract raw grayscale 16x16 pixels from t=5s
    execFileSync(ffmpegPath, [
      '-y', '-ss', '00:00:05', '-i', qoPath,
      '-vframes', '1', '-s', '16x16', '-pix_fmt', 'gray', '-f', 'rawvideo', qoFrame
    ], { stdio: 'pipe' });

    execFileSync(ffmpegPath, [
      '-y', '-ss', '00:00:05', '-i', ssPath,
      '-vframes', '1', '-s', '16x16', '-pix_fmt', 'gray', '-f', 'rawvideo', ssFrame
    ], { stdio: 'pipe' });

    const qoBytes = fs.readFileSync(qoFrame);
    const ssBytes = fs.readFileSync(ssFrame);

    // Compute pixel difference
    let diff = 0;
    for (let i = 0; i < qoBytes.length; i++) {
      diff += Math.abs(qoBytes[i] - ssBytes[i]);
    }
    const avgPixelDiff = diff / qoBytes.length;

    // Clean up temp files
    try { fs.unlinkSync(qoFrame); } catch {}
    try { fs.unlinkSync(ssFrame); } catch {}

    // Perceptual difference must be significant (distinct video frames, not a copy or metadata-only difference)
    expect(avgPixelDiff).toBeGreaterThan(15.0);
  });
});
