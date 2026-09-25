import type { ScanResult } from '../../types/index.js';
import { formatBytes } from '../../utils/bytes.js';

export function generateJsonReport(result: ScanResult): string {
  const reportData = {
    summary: {
      rootPath: result.rootPath,
      totalImages: result.totalImages,
      totalSize: result.totalSize,
      formattedTotalSize: formatBytes(result.totalSize),
      potentialSavings: result.potentialSavings,
      formattedPotentialSavings: formatBytes(result.potentialSavings),
      scanDurationMs: result.scanDurationMs,
      totalIssues: result.issues.length,
      duplicateGroupsCount: result.duplicates.length,
      possiblyUnusedCount: result.possiblyUnused.length,
    },
    budget: result.budget,
    formatBreakdown: result.formatBreakdown,
    issues: result.issues,
    duplicates: result.duplicates,
    possiblyUnused: result.possiblyUnused,
    images: result.images.map((img) => ({
      path: img.path,
      format: img.format,
      size: img.size,
      formattedSize: formatBytes(img.size),
      width: img.width,
      height: img.height,
      aspectRatio: img.aspectRatio,
      channels: img.channels,
      hasAlpha: img.hasAlpha,
      hasMetadata: img.hasMetadata,
      metadataTypes: img.metadataTypes,
      hash: img.hash,
      issues: img.issues,
    })),
  };

  return JSON.stringify(reportData, null, 2);
}
