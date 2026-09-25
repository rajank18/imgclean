import { describe, it, expect } from 'vitest';
import { checkBudget } from '../src/core/budget.js';

describe('budget system', () => {
  const sampleImages = [
    {
      path: 'hero.png',
      absolutePath: '/path/hero.png',
      size: 400 * 1024, // 400 KB
      format: 'png' as const,
      extension: 'png',
    },
    {
      path: 'banner.jpg',
      absolutePath: '/path/banner.jpg',
      size: 800 * 1024, // 800 KB
      format: 'jpeg' as const,
      extension: 'jpg',
    },
  ];

  it('passes when total size and single sizes are within budget', () => {
    const status = checkBudget(sampleImages, {
      total: '2MB',
      single: '1MB',
    });

    expect(status).toBeDefined();
    expect(status?.passedTotal).toBe(true);
    expect(status?.passedSingle).toBe(true);
    expect(status?.passed).toBe(true);
    expect(status?.exceededSingleFiles.length).toBe(0);
  });

  it('fails when total size exceeds budget', () => {
    const status = checkBudget(sampleImages, {
      total: '1MB', // Total size is 1.2MB
    });

    expect(status).toBeDefined();
    expect(status?.passedTotal).toBe(false);
    expect(status?.passed).toBe(false);
  });

  it('fails when a single file exceeds individual budget', () => {
    const status = checkBudget(sampleImages, {
      total: '5MB',
      single: '500KB', // banner.jpg is 800KB
    });

    expect(status).toBeDefined();
    expect(status?.passedTotal).toBe(true);
    expect(status?.passedSingle).toBe(false);
    expect(status?.passed).toBe(false);
    expect(status?.exceededSingleFiles.length).toBe(1);
    expect(status?.exceededSingleFiles[0]?.file).toBe('banner.jpg');
  });

  it('returns undefined if no budgets are configured', () => {
    const status = checkBudget(sampleImages, {});
    expect(status).toBeUndefined();
  });
});
