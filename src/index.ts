export * from './types/index.js';
export * from './core/scanner.js';
export * from './core/analyzer.js';
export * from './core/metadata.js';
export * from './core/duplicates.js';
export * from './core/unused.js';
export * from './core/budget.js';
export * from './core/issues.js';
export * from './utils/bytes.js';
export * from './utils/paths.js';
export * from './utils/files.js';
export * from './utils/hashing.js';

import { scanImageFiles } from './core/scanner.js';
import { analyzeProject } from './core/analyzer.js';
import type { ImgCleanConfig, ScanResult } from './types/index.js';

/**
 * Scan and analyze a project directory for image health, bloat, issues, duplicates, and unused assets
 */
export async function scanProject(
  targetPath: string = process.cwd(),
  config?: ImgCleanConfig
): Promise<ScanResult> {
  const { rootDir, files } = await scanImageFiles(targetPath, {
    include: config?.include,
    exclude: config?.exclude,
  });

  return analyzeProject(rootDir, files, { config });
}
