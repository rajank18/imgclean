import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { analyzeImage, analyzeProject } from '../src/core/analyzer.js';
import { extractImageMetadata } from '../src/core/metadata.js';
import { checkOversizedIssue, checkDimensionIssue } from '../src/core/issues.js';

const ANALYZER_TEST_DIR = path.resolve(process.cwd(), '.tmp-test-analyzer');

describe('analyzer & metadata', () => {
  let smallPngPath: string;
  let largeDimensionsJpgPath: string;
  let alphaPngPath: string;

  beforeAll(async () => {
    await fs.mkdir(ANALYZER_TEST_DIR, { recursive: true });

    smallPngPath = path.join(ANALYZER_TEST_DIR, 'small.png');
    largeDimensionsJpgPath = path.join(ANALYZER_TEST_DIR, 'huge-dimensions.jpg');
    alphaPngPath = path.join(ANALYZER_TEST_DIR, 'transparent.png');

    // 1. Small standard PNG (100x100)
    await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    }).png().toFile(smallPngPath);

    // 2. Large dimension JPG (3000x2000 > 2560px max)
    await sharp({
      create: {
        width: 3000,
        height: 2000,
        channels: 3,
        background: { r: 0, g: 120, b: 200 },
      },
    }).jpeg().toFile(largeDimensionsJpgPath);

    // 3. PNG with Alpha channel
    await sharp({
      create: {
        width: 200,
        height: 150,
        channels: 4,
        background: { r: 0, g: 0, b: 255, alpha: 0.5 },
      },
    }).png().toFile(alphaPngPath);
  });

  afterAll(async () => {
    try {
      await fs.rm(ANALYZER_TEST_DIR, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('extracts correct metadata and dimensions via Sharp', async () => {
    const meta = await extractImageMetadata(smallPngPath);
    expect(meta.width).toBe(100);
    expect(meta.height).toBe(100);
    expect(meta.aspectRatio).toBe(1);
    expect(meta.hasAlpha).toBe(false);

    const alphaMeta = await extractImageMetadata(alphaPngPath);
    expect(alphaMeta.width).toBe(200);
    expect(alphaMeta.height).toBe(150);
    expect(alphaMeta.hasAlpha).toBe(true);
  });

  it('detects excessive dimensions and provides proportional recommendation', async () => {
    const fileStat = await fs.stat(largeDimensionsJpgPath);
    const analysis = await analyzeImage({
      path: 'huge-dimensions.jpg',
      absolutePath: largeDimensionsJpgPath,
      size: fileStat.size,
      format: 'jpeg',
      extension: 'jpg',
    });

    expect(analysis.width).toBe(3000);
    expect(analysis.height).toBe(2000);
    expect(analysis.issues?.some((i) => i.type === 'dimensions')).toBe(true);

    const dimIssue = checkDimensionIssue(analysis, 2560);
    expect(dimIssue).not.toBeNull();
    expect(dimIssue?.details?.['recommendedWidth']).toBe(2560);
    expect(dimIssue?.details?.['recommendedHeight']).toBe(1707); // 2000 / 3000 * 2560 = 1706.66 -> 1707
    expect(dimIssue?.potentialSavings).toBeGreaterThan(0);
  });

  it('detects oversized file issue based on custom size threshold', async () => {
    const fileStat = await fs.stat(smallPngPath);
    const mockAnalysis = {
      path: 'small.png',
      absolutePath: smallPngPath,
      size: 600 * 1024, // 600 KB
      format: 'png' as const,
      extension: 'png',
    };

    const issue = checkOversizedIssue(mockAnalysis, 500 * 1024);
    expect(issue).not.toBeNull();
    expect(issue?.type).toBe('oversized');
    expect(issue?.potentialSavings).toBe(100 * 1024);
  });

  it('analyzes entire project and computes total stats and format breakdown', async () => {
    const files = [
      {
        path: 'small.png',
        absolutePath: smallPngPath,
        size: (await fs.stat(smallPngPath)).size,
        format: 'png' as const,
        extension: 'png',
      },
      {
        path: 'huge-dimensions.jpg',
        absolutePath: largeDimensionsJpgPath,
        size: (await fs.stat(largeDimensionsJpgPath)).size,
        format: 'jpeg' as const,
        extension: 'jpg',
      },
    ];

    const result = await analyzeProject(ANALYZER_TEST_DIR, files);
    expect(result.totalImages).toBe(2);
    expect(result.totalSize).toBeGreaterThan(0);
    expect(result.formatBreakdown['PNG']).toBeDefined();
    expect(result.formatBreakdown['JPEG']).toBeDefined();
    expect(result.issues.length).toBeGreaterThan(0);
  });
});
