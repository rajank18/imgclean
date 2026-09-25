import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Check if a file or directory exists
 */
export function pathExists(filePath: string): boolean {
  return existsSync(filePath);
}

/**
 * Check if a path is a directory
 */
export async function isDirectory(targetPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(targetPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Ensure directory exists
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * Safely load JSON configuration file
 */
export async function loadJsonFile<T = unknown>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * Find default imgclean configuration file in project root
 */
export async function findConfigFile(rootDir: string, customConfigPath?: string): Promise<string | null> {
  if (customConfigPath) {
    const resolved = path.isAbsolute(customConfigPath)
      ? customConfigPath
      : path.resolve(rootDir, customConfigPath);
    return existsSync(resolved) ? resolved : null;
  }

  const defaultLocations = [
    'imgclean.config.json',
    '.imgcleanrc.json',
    '.imgcleanrc',
  ];

  for (const filename of defaultLocations) {
    const candidate = path.join(rootDir, filename);
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}
