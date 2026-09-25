/**
 * Format bytes into human-readable string (e.g., "18.4 MB", "982 KB")
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '0 B';
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const idx = Math.min(i, sizes.length - 1);
  const val = bytes / Math.pow(k, idx);

  // Format clean numbers without trailing .0 if integer
  const formatted = parseFloat(val.toFixed(dm));
  return `${formatted} ${sizes[idx]}`;
}

/**
 * Parse a size string like "500kb", "10mb", "1.5GB", "1024" into bytes
 */
export function parseBytes(input: string | number): number {
  if (typeof input === 'number') {
    return input;
  }

  const trimmed = input.trim().toLowerCase();
  const match = trimmed.match(/^([\d.]+)\s*([a-z]*)$/i);

  if (!match || !match[1]) {
    throw new Error(`Invalid byte size format: "${input}"`);
  }

  const num = parseFloat(match[1]);
  if (Number.isNaN(num)) {
    throw new Error(`Invalid numeric value in byte size: "${input}"`);
  }

  const unit = match[2] ?? '';

  switch (unit) {
    case 'b':
    case '':
      return Math.round(num);
    case 'k':
    case 'kb':
      return Math.round(num * 1024);
    case 'm':
    case 'mb':
      return Math.round(num * 1024 * 1024);
    case 'g':
    case 'gb':
      return Math.round(num * 1024 * 1024 * 1024);
    case 't':
    case 'tb':
      return Math.round(num * 1024 * 1024 * 1024 * 1024);
    default:
      throw new Error(`Unknown byte unit: "${unit}" in "${input}"`);
  }
}
