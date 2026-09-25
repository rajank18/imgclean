import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { optimizeImage, optimizeProject } from '../src/core/optimizer.js';

const OPT_TEST_DIR = path.resolve(process.cwd(), '.tmp-test-opt');

describe('optimizer', () => {
  let samplePng: string;
  let sampleJpg: string;

  beforeAll(async () => {
    await fs.mkdir(OPT_TEST_DIR, { recursive: true });

    samplePng = path.join(OPT_TEST_DIR, 'sample.png');
    sampleJpg = path.join(OPT_TEST_DIR, 'sample.jpg');

    // Create a 800x600 PNG
    await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 4,
        background: { r: 100, g: 150, b: 220, alpha: 0.9 },
      },
    }).png().toFile(samplePng);

    // Create a 1200x800 JPEG
    await sharp({
      create: {
        width: 1200,
        height: 800,
        channels: 3,
        background: { r: 200, g: 100, b: 50 },
      },
    }).jpeg({ quality: 95 }).toFile(sampleJpg);
  });

  afterAll(async () => {
    try {
      await fs.rm(OPT_TEST_DIR, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('performs dry run without writing files to disk', async () => {
    const res = await optimizeImage(sampleJpg, {
      dryRun: true,
      quality: 60,
    });

    expect(res.success).toBe(true);
    expect(res.dryRun).toBe(true);
    expect(res.optimizedSize).toBeGreaterThan(0);
    expect(res.outputPath).toBeUndefined();
  });

  it('converts image format to webp', async () => {
    const res = await optimizeImage(samplePng, {
      format: 'webp',
      quality: 75,
      outputDir: path.join(OPT_TEST_DIR, 'out-webp'),
    });

    expect(res.success).toBe(true);
    expect(res.format).toBe('webp');
    expect(res.outputPath).toBeDefined();

    const outStat = await fs.stat(res.outputPath!);
    expect(outStat.isFile()).toBe(true);
    expect(res.outputPath!.endsWith('.webp')).toBe(true);
  });

  it('resizes image to maximum dimensions while preserving aspect ratio', async () => {
    const res = await optimizeImage(sampleJpg, {
      resize: true,
      maxWidth: 600,
      outputDir: path.join(OPT_TEST_DIR, 'out-resize'),
    });

    expect(res.success).toBe(true);
    expect(res.outputPath).toBeDefined();

    const meta = await sharp(res.outputPath!).metadata();
    expect(meta.width).toBe(600);
    expect(meta.height).toBe(400); // 1200x800 scaled to 600x400
  });

  it('optimizes image to target size using binary search', async () => {
    const targetSizeStr = '15kb';
    const res = await optimizeImage(sampleJpg, {
      targetSize: targetSizeStr,
      outputDir: path.join(OPT_TEST_DIR, 'out-target'),
    });

    expect(res.success).toBe(true);
    expect(res.targetSize).toBe(15 * 1024);
    expect(res.targetReached).toBe(true);
    expect(res.optimizedSize).toBeLessThanOrEqual(15 * 1024);
    expect(res.qualityUsed).toBeDefined();
  });

  it('optimizes a batch of project files safely preserving originals', async () => {
    const originalStat = await fs.stat(sampleJpg);

    const outcome = await optimizeProject(
      OPT_TEST_DIR,
      [
        { path: 'sample.png', absolutePath: samplePng, size: (await fs.stat(samplePng)).size, format: 'png', extension: 'png' },
        { path: 'sample.jpg', absolutePath: sampleJpg, size: originalStat.size, format: 'jpeg', extension: 'jpg' },
      ],
      { quality: 70 }
    );

    expect(outcome.results.length).toBe(2);
    expect(outcome.totalOptimizedSize).toBeGreaterThan(0);

    // Original file must be completely untouched
    const afterStat = await fs.stat(sampleJpg);
    expect(afterStat.size).toBe(originalStat.size);
  });
});
