import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { findDuplicateGroups, generateDuplicateIssues } from '../src/core/duplicates.js';
import { hashFile } from '../src/utils/hashing.js';

const DUP_TEST_DIR = path.resolve(process.cwd(), '.tmp-test-dup');

describe('duplicates', () => {
  let file1Path: string;
  let file2Path: string;
  let file3Path: string;
  let uniquePath: string;

  beforeAll(async () => {
    await fs.mkdir(DUP_TEST_DIR, { recursive: true });

    file1Path = path.join(DUP_TEST_DIR, 'hero.png');
    file2Path = path.join(DUP_TEST_DIR, 'hero-copy.png');
    file3Path = path.join(DUP_TEST_DIR, 'hero-copy-2.png');
    uniquePath = path.join(DUP_TEST_DIR, 'unique.png');

    // Create base image
    const buffer = await sharp({
      create: {
        width: 120,
        height: 120,
        channels: 3,
        background: { r: 100, g: 200, b: 50 },
      },
    }).png().toBuffer();

    // Write duplicates with exact same bytes
    await fs.writeFile(file1Path, buffer);
    await fs.writeFile(file2Path, buffer);
    await fs.writeFile(file3Path, buffer);

    // Write unique image
    await sharp({
      create: {
        width: 80,
        height: 80,
        channels: 3,
        background: { r: 50, g: 50, b: 200 },
      },
    }).png().toFile(uniquePath);
  });

  afterAll(async () => {
    try {
      await fs.rm(DUP_TEST_DIR, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('groups duplicate files by SHA-256 hash and computes potential savings', async () => {
    const [hash1, hash2, hash3, hashUnique] = await Promise.all([
      hashFile(file1Path),
      hashFile(file2Path),
      hashFile(file3Path),
      hashFile(uniquePath),
    ]);

    expect(hash1).toBe(hash2);
    expect(hash2).toBe(hash3);
    expect(hash1).not.toBe(hashUnique);

    const size = (await fs.stat(file1Path)).size;

    const images = [
      { path: 'hero.png', absolutePath: file1Path, size, format: 'png' as const, extension: 'png', hash: hash1 },
      { path: 'hero-copy.png', absolutePath: file2Path, size, format: 'png' as const, extension: 'png', hash: hash2 },
      { path: 'hero-copy-2.png', absolutePath: file3Path, size, format: 'png' as const, extension: 'png', hash: hash3 },
      { path: 'unique.png', absolutePath: uniquePath, size: (await fs.stat(uniquePath)).size, format: 'png' as const, extension: 'png', hash: hashUnique },
    ];

    const duplicateGroups = findDuplicateGroups(images);
    expect(duplicateGroups.length).toBe(1);
    expect(duplicateGroups[0]?.files.length).toBe(3);
    expect(duplicateGroups[0]?.potentialSavings).toBe(2 * size);

    const issues = generateDuplicateIssues(duplicateGroups);
    expect(issues.length).toBe(2);
    expect(issues[0]?.type).toBe('duplicate');
    expect(issues[0]?.potentialSavings).toBe(size);
  });
});
