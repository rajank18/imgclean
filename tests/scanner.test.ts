import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { scanImageFiles, isSupportedImageExtension, inferFormatFromExtension } from '../src/core/scanner.js';

const TEST_DIR = path.resolve(process.cwd(), '.tmp-test-scanner');

describe('scanner', () => {
  beforeAll(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
    await fs.mkdir(path.join(TEST_DIR, 'subfolder'), { recursive: true });
    await fs.mkdir(path.join(TEST_DIR, 'node_modules', 'pkg'), { recursive: true });

    // Create test images using Sharp
    await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 },
      },
    }).png().toFile(path.join(TEST_DIR, 'test.png'));

    await sharp({
      create: {
        width: 50,
        height: 50,
        channels: 3,
        background: { r: 0, g: 255, b: 0 },
      },
    }).jpeg().toFile(path.join(TEST_DIR, 'subfolder', 'banner.jpg'));

    await sharp({
      create: {
        width: 30,
        height: 30,
        channels: 4,
        background: { r: 0, g: 0, b: 255, alpha: 0.5 },
      },
    }).webp().toFile(path.join(TEST_DIR, 'subfolder', 'icon.webp'));

    // Create an image inside node_modules that should be ignored by default
    await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 3,
        background: { r: 100, g: 100, b: 100 },
      },
    }).png().toFile(path.join(TEST_DIR, 'node_modules', 'pkg', 'ignored.png'));

    // Create a non-image file
    await fs.writeFile(path.join(TEST_DIR, 'text.txt'), 'hello world');
  });

  afterAll(async () => {
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch {
      // cleanup error ignored
    }
  });

  it('identifies supported image extensions', () => {
    expect(isSupportedImageExtension('png')).toBe(true);
    expect(isSupportedImageExtension('JPG')).toBe(true);
    expect(isSupportedImageExtension('.webp')).toBe(true);
    expect(isSupportedImageExtension('avif')).toBe(true);
    expect(isSupportedImageExtension('ico')).toBe(true);
    expect(isSupportedImageExtension('txt')).toBe(false);
    expect(isSupportedImageExtension('pdf')).toBe(false);
  });

  it('infers format from file extension', () => {
    expect(inferFormatFromExtension('sample.jpg')).toBe('jpg');
    expect(inferFormatFromExtension('/path/to/hero.PNG')).toBe('png');
    expect(inferFormatFromExtension('doc.pdf')).toBeNull();
  });

  it('scans a directory and ignores node_modules and non-image files', async () => {
    const { files, rootDir } = await scanImageFiles(TEST_DIR);

    expect(rootDir).toBe(TEST_DIR);
    expect(files.length).toBe(3);

    const relativePaths = files.map((f) => f.path);
    expect(relativePaths).toContain('test.png');
    expect(relativePaths).toContain('subfolder/banner.jpg');
    expect(relativePaths).toContain('subfolder/icon.webp');
    expect(relativePaths).not.toContain('node_modules/pkg/ignored.png');
    expect(relativePaths).not.toContain('text.txt');
  });

  it('scans a single file target directly', async () => {
    const filePath = path.join(TEST_DIR, 'test.png');
    const { files } = await scanImageFiles(filePath);

    expect(files.length).toBe(1);
    expect(files[0]?.path).toBe('test.png');
    expect(files[0]?.format).toBe('png');
    expect(files[0]?.size).toBeGreaterThan(0);
  });

  it('throws error when target does not exist', async () => {
    await expect(scanImageFiles(path.join(TEST_DIR, 'non-existent'))).rejects.toThrow();
  });
});
