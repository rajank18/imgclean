import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import { normalizePath } from '../utils/paths.js';
import { DEFAULT_EXCLUDE_PATTERNS } from './scanner.js';
import type { DiscoveredImageFile, ImageIssue } from '../types/index.js';
import { formatBytes } from '../utils/bytes.js';

export const SOURCE_EXTENSIONS = [
  'html',
  'htm',
  'jsx',
  'tsx',
  'js',
  'ts',
  'mjs',
  'cjs',
  'css',
  'scss',
  'sass',
  'less',
  'json',
  'md',
  'mdx',
  'vue',
  'svelte',
  'astro',
  'php',
];

export interface UnusedDetectionOptions {
  sourceGlob?: string[];
  exclude?: string[];
}

/**
 * Extract potential asset references from source files
 */
export async function findPossiblyUnusedImages(
  rootDir: string,
  images: DiscoveredImageFile[],
  options: UnusedDetectionOptions = {}
): Promise<string[]> {
  if (images.length === 0) return [];

  const sourcePattern = `**/*.{${SOURCE_EXTENSIONS.join(',')}}`;
  const includePatterns = options.sourceGlob && options.sourceGlob.length > 0
    ? options.sourceGlob
    : [sourcePattern];

  const excludePatterns = [
    ...DEFAULT_EXCLUDE_PATTERNS,
    ...(options.exclude || []),
  ];

  const sourceFiles = await fg(includePatterns, {
    cwd: normalizePath(rootDir),
    absolute: true,
    dot: false,
    ignore: excludePatterns,
    onlyFiles: true,
  });

  if (sourceFiles.length === 0) {
    // If there are no source files to scan, avoid marking everything as unused false positives
    return [];
  }

  // Read all source file contents
  const sourceContents: string[] = [];
  for (const srcPath of sourceFiles) {
    try {
      const content = await fs.readFile(srcPath, 'utf-8');
      sourceContents.push(content);
    } catch {
      // Ignore unreadable files
    }
  }

  const combinedSource = sourceContents.join('\n');

  const unusedImagePaths: string[] = [];

  for (const image of images) {
    const relPath = image.path; // e.g. "public/images/hero.png"
    const basename = path.basename(relPath); // e.g. "hero.png"
    const nameWithoutExt = path.parse(relPath).name; // e.g. "hero"

    // Patterns to test for reference in source code:
    // 1. Direct path / filename reference
    // 2. Basename with extension
    // 3. Basename without extension (e.g. `import hero from './hero'`)
    const isReferenced =
      combinedSource.includes(relPath) ||
      combinedSource.includes(basename) ||
      (nameWithoutExt.length > 3 && combinedSource.includes(nameWithoutExt));

    if (!isReferenced) {
      unusedImagePaths.push(relPath);
    }
  }

  return unusedImagePaths;
}

/**
 * Generate issue records for possibly unused images
 */
export function generateUnusedIssues(
  unusedPaths: string[],
  images: DiscoveredImageFile[]
): ImageIssue[] {
  const imageMap = new Map(images.map((img) => [img.path, img]));
  const issues: ImageIssue[] = [];

  for (const unusedPath of unusedPaths) {
    const img = imageMap.get(unusedPath);
    const size = img ? img.size : 0;

    issues.push({
      type: 'unused',
      severity: 'warning',
      file: unusedPath,
      message: `Possibly unused image (no static references found in source code)`,
      potentialSavings: size,
      details: {
        size,
        formattedSize: formatBytes(size),
      },
    });
  }

  return issues;
}
