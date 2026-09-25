import path from 'node:path';

/**
 * Normalize file path separators to standard posix forward slashes
 */
export function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

/**
 * Get relative path from root directory with normalized forward slashes
 */
export function getRelativePath(from: string, to: string): string {
  const rel = path.relative(from, to);
  return normalizePath(rel);
}

/**
 * Resolve path against current working directory
 */
export function resolvePath(targetPath?: string, basePath: string = process.cwd()): string {
  if (!targetPath) {
    return path.resolve(basePath);
  }
  return path.isAbsolute(targetPath)
    ? path.normalize(targetPath)
    : path.resolve(basePath, targetPath);
}
