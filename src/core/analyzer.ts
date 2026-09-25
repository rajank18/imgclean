import { extractImageMetadata } from './metadata.js';
import { hashFile } from '../utils/hashing.js';
import { findDuplicateGroups, generateDuplicateIssues } from './duplicates.js';
import { findPossiblyUnusedImages, generateUnusedIssues } from './unused.js';
import { checkBudget } from './budget.js';
import {
  checkOversizedIssue,
  checkDimensionIssue,
  checkMetadataIssue,
  DEFAULT_MAX_FILE_SIZE,
  DEFAULT_MAX_DIMENSION,
} from './issues.js';
import { parseBytes } from '../utils/bytes.js';
import type {
  DiscoveredImageFile,
  ImageAnalysis,
  ImageIssue,
  ScanResult,
  ImgCleanConfig,
} from '../types/index.js';

export interface AnalyzerOptions {
  config?: ImgCleanConfig | null;
}

/**
 * Analyze a single image file for structural properties, metadata, and issues
 */
export async function analyzeImage(
  file: DiscoveredImageFile,
  options: AnalyzerOptions = {}
): Promise<ImageAnalysis> {
  const [meta, hash] = await Promise.all([
    extractImageMetadata(file.absolutePath),
    hashFile(file.absolutePath),
  ]);

  const analysis: ImageAnalysis = {
    ...file,
    width: meta.width,
    height: meta.height,
    aspectRatio: meta.aspectRatio,
    channels: meta.channels,
    hasAlpha: meta.hasAlpha,
    hasMetadata: meta.hasMetadata,
    metadataTypes: meta.metadataTypes,
    hash,
    issues: [],
    estimatedSavings: 0,
  };

  const config = options.config;
  const rules = config?.rules;

  const maxSize = config?.maxSize
    ? parseBytes(config.maxSize)
    : (config?.budgets?.single ? parseBytes(config.budgets.single) : DEFAULT_MAX_FILE_SIZE);

  const maxDimension = config?.maxDimension || DEFAULT_MAX_DIMENSION;

  const issues: ImageIssue[] = [];

  // 1. Oversized check
  if (rules?.oversized !== false) {
    const oversizedIssue = checkOversizedIssue(analysis, maxSize);
    if (oversizedIssue) issues.push(oversizedIssue);
  }

  // 2. Large dimension check
  if (rules?.dimensions !== false) {
    const dimensionIssue = checkDimensionIssue(analysis, maxDimension);
    if (dimensionIssue) issues.push(dimensionIssue);
  }

  // 3. Metadata check
  if (rules?.metadata !== false) {
    const metadataIssue = checkMetadataIssue(analysis);
    if (metadataIssue) issues.push(metadataIssue);
  }

  analysis.issues = issues;

  return analysis;
}

/**
 * Analyze a full collection of discovered images in a project
 */
export async function analyzeProject(
  rootDir: string,
  files: DiscoveredImageFile[],
  options: AnalyzerOptions = {}
): Promise<ScanResult> {
  const startTime = Date.now();
  const config = options.config;
  const rules = config?.rules;

  // Run image analysis concurrently
  const CONCURRENCY = 16;
  const analyzedImages: ImageAnalysis[] = [];

  for (let i = 0; i < files.length; i += CONCURRENCY) {
    const batch = files.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map((f) => analyzeImage(f, options)));
    analyzedImages.push(...batchResults);
  }

  // 1. Duplicate detection
  const duplicateGroups = rules?.duplicates !== false
    ? findDuplicateGroups(analyzedImages.filter((img): img is ImageAnalysis & { hash: string } => Boolean(img.hash)))
    : [];

  const duplicateIssues = generateDuplicateIssues(duplicateGroups);

  // 2. Unused images detection
  const possiblyUnused = rules?.unused !== false
    ? await findPossiblyUnusedImages(rootDir, files, { exclude: config?.exclude })
    : [];

  const unusedIssues = generateUnusedIssues(possiblyUnused, files);

  // Combine all issues
  const allIssues: ImageIssue[] = [];
  for (const img of analyzedImages) {
    if (img.issues && img.issues.length > 0) {
      allIssues.push(...img.issues);
    }
  }
  allIssues.push(...duplicateIssues);
  allIssues.push(...unusedIssues);

  // Calculate potential savings (avoiding unrealistic double counts)
  const savingsPerFile = new Map<string, number>();

  // a. Add duplicate copy savings (100% of copy size)
  for (const dup of duplicateGroups) {
    for (let i = 1; i < dup.files.length; i++) {
      const f = dup.files[i];
      if (f) savingsPerFile.set(f, dup.size);
    }
  }

  // b. Add individual issue savings
  for (const issue of allIssues) {
    if (issue.type === 'duplicate') continue;
    if (issue.potentialSavings && issue.potentialSavings > 0) {
      const current = savingsPerFile.get(issue.file) || 0;
      savingsPerFile.set(issue.file, Math.max(current, issue.potentialSavings));
    }
  }

  let potentialSavings = 0;
  for (const sav of savingsPerFile.values()) {
    potentialSavings += sav;
  }

  // Calculate total size and format breakdown
  let totalSize = 0;
  const formatBreakdown: Record<string, { count: number; size: number }> = {};

  for (const img of analyzedImages) {
    totalSize += img.size;
    const fmt = img.format.toUpperCase();
    const existing = formatBreakdown[fmt] || { count: 0, size: 0 };
    existing.count += 1;
    existing.size += img.size;
    formatBreakdown[fmt] = existing;
  }

  // Check budget status
  const budget = checkBudget(analyzedImages, config?.budgets);

  const duration = Date.now() - startTime;

  return {
    rootPath: rootDir,
    images: analyzedImages,
    totalImages: analyzedImages.length,
    totalSize,
    potentialSavings,
    issues: allIssues,
    duplicates: duplicateGroups,
    possiblyUnused,
    formatBreakdown,
    budget,
    scanDurationMs: duration,
  };
}
