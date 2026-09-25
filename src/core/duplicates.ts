import type { DuplicateGroup, DiscoveredImageFile, ImageIssue } from '../types/index.js';
import { formatBytes } from '../utils/bytes.js';

export interface ImageWithHash extends DiscoveredImageFile {
  hash: string;
}

/**
 * Find exact duplicate files based on content hash (SHA-256)
 */
export function findDuplicateGroups(images: ImageWithHash[]): DuplicateGroup[] {
  const hashMap = new Map<string, ImageWithHash[]>();

  for (const img of images) {
    const list = hashMap.get(img.hash) || [];
    list.push(img);
    hashMap.set(img.hash, list);
  }

  const duplicates: DuplicateGroup[] = [];

  for (const [hash, group] of hashMap.entries()) {
    if (group.length > 1 && group[0]) {
      const size = group[0].size;
      const filePaths = group.map((item) => item.path);
      const potentialSavings = (group.length - 1) * size;

      duplicates.push({
        hash,
        size,
        files: filePaths,
        potentialSavings,
      });
    }
  }

  // Sort groups by potential savings descending
  duplicates.sort((a, b) => b.potentialSavings - a.potentialSavings);

  return duplicates;
}

/**
 * Generate issue records for detected duplicate images
 */
export function generateDuplicateIssues(duplicateGroups: DuplicateGroup[]): ImageIssue[] {
  const issues: ImageIssue[] = [];

  for (const group of duplicateGroups) {
    // For every file in the group after the first, flag as duplicate copy
    for (let i = 1; i < group.files.length; i++) {
      const file = group.files[i];
      const original = group.files[0];
      if (file && original) {
        issues.push({
          type: 'duplicate',
          severity: 'warning',
          file,
          message: `Identical content duplicate of "${original}" (${formatBytes(group.size)})`,
          potentialSavings: group.size,
          details: {
            hash: group.hash,
            originalFile: original,
            duplicateGroup: group.files,
          },
        });
      }
    }
  }

  return issues;
}
