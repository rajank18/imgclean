import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { findPossiblyUnusedImages, generateUnusedIssues } from '../src/core/unused.js';

const UNUSED_TEST_DIR = path.resolve(process.cwd(), '.tmp-test-unused');

describe('unused images detection', () => {
  let referencedImg: string;
  let unusedImg: string;
  let htmlFilePath: string;
  let jsFilePath: string;

  beforeAll(async () => {
    await fs.mkdir(UNUSED_TEST_DIR, { recursive: true });
    await fs.mkdir(path.join(UNUSED_TEST_DIR, 'public'), { recursive: true });
    await fs.mkdir(path.join(UNUSED_TEST_DIR, 'src'), { recursive: true });

    referencedImg = path.join(UNUSED_TEST_DIR, 'public', 'logo.png');
    unusedImg = path.join(UNUSED_TEST_DIR, 'public', 'old-banner.png');

    // Create image files
    await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 100, g: 100, b: 100 },
      },
    }).png().toFile(referencedImg);

    await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 50, g: 50, b: 50 },
      },
    }).png().toFile(unusedImg);

    // Create source files referencing ONLY logo.png
    htmlFilePath = path.join(UNUSED_TEST_DIR, 'src', 'index.html');
    await fs.writeFile(htmlFilePath, '<img src="/public/logo.png" alt="Logo" />');

    jsFilePath = path.join(UNUSED_TEST_DIR, 'src', 'app.js');
    await fs.writeFile(jsFilePath, 'console.log("App initialized with logo");');
  });

  afterAll(async () => {
    try {
      await fs.rm(UNUSED_TEST_DIR, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('detects unreferenced images as possibly unused', async () => {
    const images = [
      {
        path: 'public/logo.png',
        absolutePath: referencedImg,
        size: 1024,
        format: 'png' as const,
        extension: 'png',
      },
      {
        path: 'public/old-banner.png',
        absolutePath: unusedImg,
        size: 2048,
        format: 'png' as const,
        extension: 'png',
      },
    ];

    const unused = await findPossiblyUnusedImages(UNUSED_TEST_DIR, images);
    expect(unused).toContain('public/old-banner.png');
    expect(unused).not.toContain('public/logo.png');

    const issues = generateUnusedIssues(unused, images);
    expect(issues.length).toBe(1);
    expect(issues[0]?.type).toBe('unused');
    expect(issues[0]?.message).toContain('Possibly unused');
    expect(issues[0]?.potentialSavings).toBe(2048);
  });
});
