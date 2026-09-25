import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import {
  type DiscoveredImageFile,
  type SupportedImageFormat,
  SUPPORTED_EXTENSIONS,
} from '../types/index.js';
import { getRelativePath, normalizePath, resolvePath } from '../utils/paths.js';
import { isDirectory, pathExists } from '../utils/files.js';

export interface ScannerOptions {
  include?: string[];
  exclude?: string[];
}

export const DEFAULT_EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/.svelte-kit/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/.imgclean/**',
];

/**
 * Check if an extension is a supported image extension
 */
export function isSupportedImageExtension(ext: string): ext is SupportedImageFormat {
  const normalized = ext.toLowerCase().replace(/^\./, '');
  return SUPPORTED_EXTENSIONS.includes(normalized as SupportedImageFormat);
}

/**
 * Infer format from file extension
 */
export function inferFormatFromExtension(filePath: string): SupportedImageFormat | null {
  const ext = path.extname(filePath).toLowerCase().replace(/^\./, '');
  if (isSupportedImageExtension(ext)) {
    return ext;
  }
  return null;
}

/**
 * Scan a project or directory for supported image files
 */
export async function scanImageFiles(
  targetPath: string = process.cwd(),
  options: ScannerOptions = {}
): Promise<{ rootDir: string; files: DiscoveredImageFile[] }> {
  const resolvedTarget = resolvePath(targetPath);

  if (!pathExists(resolvedTarget)) {
    throw new Error(`Target path does not exist: "${targetPath}"`);
  }

  const isDir = await isDirectory(resolvedTarget);

  // If target is a single file
  if (!isDir) {
    const format = inferFormatFromExtension(resolvedTarget);
    if (!format) {
      throw new Error(`Target file is not a supported image format: "${targetPath}"`);
    }

    const stat = await fs.stat(resolvedTarget);
    const rootDir = path.dirname(resolvedTarget);
    const ext = path.extname(resolvedTarget).replace(/^\./, '').toLowerCase();

    return {
      rootDir,
      files: [
        {
          path: normalizePath(path.basename(resolvedTarget)),
          absolutePath: resolvedTarget,
          size: stat.size,
          format,
          extension: ext,
        },
      ],
    };
  }

  const rootDir = resolvedTarget;
  const extPattern = SUPPORTED_EXTENSIONS.join(',');
  const defaultInclude = [`**/*.{${extPattern}}`, `**/*.{${extPattern.toUpperCase()}}`];

  const includePatterns = options.include && options.include.length > 0
    ? options.include
    : defaultInclude;

  const excludePatterns = [
    ...DEFAULT_EXCLUDE_PATTERNS,
    ...(options.exclude || []),
  ];

  const normalizedRoot = normalizePath(rootDir);

  const matchedPaths = await fg(includePatterns, {
    cwd: normalizedRoot,
    absolute: true,
    dot: false,
    ignore: excludePatterns,
    onlyFiles: true,
    followSymbolicLinks: false,
  });

  const files: DiscoveredImageFile[] = [];

  for (const absPath of matchedPaths) {
    const format = inferFormatFromExtension(absPath);
    if (!format) continue;

    try {
      const stat = await fs.stat(absPath);
      const ext = path.extname(absPath).replace(/^\./, '').toLowerCase();
      const relative = getRelativePath(rootDir, absPath);

      files.push({
        path: relative,
        absolutePath: absPath,
        size: stat.size,
        format,
        extension: ext,
      });
    } catch {
      // Ignore unreadable files or race condition deletions
    }
  }

  // Sort files predictably by relative path
  files.sort((a, b) => a.path.localeCompare(b.path));

  return {
    rootDir,
    files,
  };
}
