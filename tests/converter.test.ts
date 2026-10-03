import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { convertImage, convertProjectOrFile } from '../src/core/converter.js';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
const CONVERT_TEST_DIR = path.resolve(process.cwd(), '.tmp-test-convert');

describe('converter', () => {
  let samplePng: string;
  let sampleJpg: string;
  let sampleSvg: string;

  beforeAll(async () => {
    await fs.mkdir(CONVERT_TEST_DIR, { recursive: true });

    samplePng = path.join(CONVERT_TEST_DIR, 'sample.png');
    sampleJpg = path.join(CONVERT_TEST_DIR, 'sample.jpg');
    sampleSvg = path.join(CONVERT_TEST_DIR, 'sample.svg');

    // Create PNG
    await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 255, g: 100, b: 50, alpha: 1 },
      },
    }).png().toFile(samplePng);

    // Create JPEG
    await sharp({
      create: {
        width: 120,
        height: 80,
        channels: 3,
        background: { r: 50, g: 120, b: 200 },
      },
    }).jpeg().toFile(sampleJpg);

    // Create simple SVG
    const svgContent = `<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40" fill="green" /></svg>`;
    await fs.writeFile(sampleSvg, svgContent, 'utf-8');
  });

  afterAll(async () => {
    try {
      await fs.rm(CONVERT_TEST_DIR, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('converts PNG to WebP and stores at same directory', async () => {
    const result = await convertImage(samplePng, 'webp');
    expect(result.success).toBe(true);
    expect(result.targetFormat).toBe('webp');
    expect(result.outputPath.endsWith('sample.webp')).toBe(true);

    const exists = await fs.stat(result.outputPath);
    expect(exists.isFile()).toBe(true);
  });

  it('converts JPEG to AVIF format', async () => {
    const result = await convertImage(sampleJpg, 'avif');
    expect(result.success).toBe(true);
    expect(result.targetFormat).toBe('avif');
    expect(result.outputPath.endsWith('sample.avif')).toBe(true);

    const exists = await fs.stat(result.outputPath);
    expect(exists.isFile()).toBe(true);
  });

  it('converts SVG to PNG', async () => {
    const result = await convertImage(sampleSvg, 'png');
    expect(result.success).toBe(true);
    expect(result.targetFormat).toBe('png');
    expect(result.outputPath.endsWith('sample.png')).toBe(true);
  });

  it('converts PNG to ICO format', async () => {
    const icoPath = path.join(CONVERT_TEST_DIR, 'icon-source.png');
    await sharp({
      create: { width: 64, height: 64, channels: 4, background: { r: 0, g: 0, b: 255, alpha: 1 } },
    }).png().toFile(icoPath);

    const result = await convertImage(icoPath, 'ico', { iconSize: 32 });
    expect(result.success).toBe(true);
    expect(result.outputPath.endsWith('.ico')).toBe(true);

    // Now convert ICO back to PNG
    const icoToPngResult = await convertImage(result.outputPath, 'png');
    expect(icoToPngResult.success).toBe(true);
    expect(icoToPngResult.targetFormat).toBe('png');
  });

  it('replaces original file when replace option is enabled', async () => {
    const tempOriginal = path.join(CONVERT_TEST_DIR, 'to-replace.png');
    await sharp({
      create: { width: 50, height: 50, channels: 3, background: { r: 10, g: 200, b: 30 } },
    }).png().toFile(tempOriginal);

    const res = await convertImage(tempOriginal, 'webp', { replace: true });
    expect(res.success).toBe(true);
    expect(res.replacedOriginal).toBe(true);

    // Converted file should exist
    const outStat = await fs.stat(res.outputPath);
    expect(outStat.isFile()).toBe(true);

    // Original file should be deleted
    await expect(fs.stat(tempOriginal)).rejects.toThrow();
  });

  it('converts all images in a directory recursively', async () => {
    const subDir = path.join(CONVERT_TEST_DIR, 'batch-convert');
    await fs.mkdir(subDir, { recursive: true });

    await sharp({ create: { width: 30, height: 30, channels: 3, background: { r: 1, g: 2, b: 3 } } })
      .png()
      .toFile(path.join(subDir, 'img1.png'));
    await sharp({ create: { width: 30, height: 30, channels: 3, background: { r: 4, g: 5, b: 6 } } })
      .jpeg()
      .toFile(path.join(subDir, 'img2.jpg'));

    const batchResults = await convertProjectOrFile(subDir, 'webp');
    expect(batchResults.length).toBe(2);
    expect(batchResults.every((r) => r.success && r.targetFormat === 'webp')).toBe(true);
  });

  it('runs CLI convert command with natural syntax', async () => {
    const cliPath = path.resolve(process.cwd(), 'dist/cli/index.mjs');
    const cliImg = path.join(CONVERT_TEST_DIR, 'cli-convert.png');
    await sharp({ create: { width: 40, height: 40, channels: 3, background: { r: 100, g: 100, b: 100 } } })
      .png()
      .toFile(cliImg);

    const { stdout } = await execAsync(`node "${cliPath}" convert "${cliImg}" to webp`);
    expect(stdout).toContain('Converted 1 image(s) to WEBP');

    const expectedOut = path.join(CONVERT_TEST_DIR, 'cli-convert.webp');
    const stat = await fs.stat(expectedOut);
    expect(stat.isFile()).toBe(true);
  });
});
