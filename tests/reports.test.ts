import { describe, it, expect } from 'vitest';
import { generateJsonReport } from '../src/cli/output/json.js';
import { generateMarkdownReport } from '../src/cli/output/markdown.js';
import { generateHtmlReport } from '../src/cli/output/html.js';
import type { ScanResult } from '../src/types/index.js';

describe('reports', () => {
  const mockScanResult: ScanResult = {
    rootPath: '/project/public',
    images: [
      {
        path: 'hero.png',
        absolutePath: '/project/public/hero.png',
        size: 2847291,
        format: 'png',
        extension: 'png',
        width: 3840,
        height: 2160,
        aspectRatio: 1.777,
        hasAlpha: false,
        hasMetadata: true,
        metadataTypes: ['EXIF'],
        hash: 'abcdef1234567890',
        issues: [
          {
            type: 'dimensions',
            severity: 'warning',
            file: 'hero.png',
            message: 'Dimensions 3840×2160 exceed limit (2560px)',
            potentialSavings: 1000000,
          },
        ],
      },
    ],
    totalImages: 1,
    totalSize: 2847291,
    potentialSavings: 1000000,
    issues: [
      {
        type: 'dimensions',
        severity: 'warning',
        file: 'hero.png',
        message: 'Dimensions 3840×2160 exceed limit (2560px)',
        potentialSavings: 1000000,
      },
    ],
    duplicates: [],
    possiblyUnused: ['hero.png'],
    formatBreakdown: {
      PNG: { count: 1, size: 2847291 },
    },
    budget: {
      totalBudget: 2000000,
      totalSize: 2847291,
      passedTotal: false,
      passedSingle: true,
      exceededSingleFiles: [],
      passed: false,
    },
    scanDurationMs: 42,
  };

  it('generates valid JSON report matching structure', () => {
    const jsonStr = generateJsonReport(mockScanResult);
    const parsed = JSON.parse(jsonStr);

    expect(parsed.summary.totalImages).toBe(1);
    expect(parsed.summary.totalSize).toBe(2847291);
    expect(parsed.formatBreakdown.PNG.count).toBe(1);
    expect(parsed.images[0].path).toBe('hero.png');
    expect(parsed.budget.passed).toBe(false);
  });

  it('generates Markdown report with formatted tables', () => {
    const md = generateMarkdownReport(mockScanResult);

    expect(md).toContain('# imgclean Image Health Report');
    expect(md).toContain('| **PNG** | 1 |');
    expect(md).toContain('## Detected Issues');
    expect(md).toContain('Dimensions 3840×2160 exceed limit');
    expect(md).toContain('## Possibly Unused Images');
  });

  it('generates standalone HTML report with dashboard UI', () => {
    const html = generateHtmlReport(mockScanResult);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<title>imgclean Report');
    expect(html).toContain('hero.png');
    expect(html).toContain('PNG');
    expect(html).toContain('Detected Issues');
    expect(html).toContain('</html>');
  });
});
