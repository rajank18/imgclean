import fs from 'node:fs/promises';
import path from 'node:path';
import sharp, { type Sharp } from 'sharp';
import { parseBytes } from '../utils/bytes.js';
import { ensureDir } from '../utils/files.js';
import { extractImageMetadata } from './metadata.js';
import { getRelativePath, normalizePath } from '../utils/paths.js';
import type { DiscoveredImageFile } from '../types/index.js';

export interface OptimizeOptions {
  compress?: boolean;
  quality?: number; // 1-100 (default: 80)
  format?: 'webp' | 'avif' | 'png' | 'jpeg' | 'jpg';
  resize?: boolean;
  maxWidth?: number;
  maxHeight?: number;
  targetSize?: string | number; // e.g. "300kb" or 307200
  stripMetadata?: boolean;
  dryRun?: boolean;
  outputDir?: string;
  overwrite?: boolean;
}

export interface OptimizeResult {
  inputPath: string;
  outputPath?: string;
  originalSize: number;
  optimizedSize: number;
  savingsBytes: number;
  savingsPercentage: number;
  format: string;
  width?: number;
  height?: number;
  qualityUsed?: number;
  targetSize?: number;
  targetReached?: boolean;
  metadataStripped?: boolean;
  dryRun: boolean;
  success: boolean;
  error?: string;
}

/**
 * Configure Sharp transformation pipeline based on options and quality
 */
function buildSharpPipeline(
  inputPath: string,
  targetFormat: string,
  quality: number,
  options: OptimizeOptions,
  currentWidth?: number,
  currentHeight?: number
): Sharp {
  let pipeline = sharp(inputPath, { failOn: 'none' });

  // 1. Resizing (preserving aspect ratio)
  if (options.resize || options.maxWidth || options.maxHeight) {
    const maxWidth = options.maxWidth;
    const maxHeight = options.maxHeight;

    if (maxWidth || maxHeight) {
      pipeline = pipeline.resize({
        width: maxWidth,
        height: maxHeight,
        fit: 'inside',
        withoutEnlargement: true,
      });
    } else if (currentWidth && currentHeight && (currentWidth > 2560 || currentHeight > 2560)) {
      pipeline = pipeline.resize({
        width: 2560,
        height: 2560,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }
  }

  // 2. Format & Compression settings
  const normalizedFormat = targetFormat.toLowerCase().replace('jpg', 'jpeg');

  switch (normalizedFormat) {
    case 'jpeg':
      pipeline = pipeline.jpeg({
        quality,
        mozjpeg: true,
      });
      break;
    case 'png':
      pipeline = pipeline.png({
        quality: quality < 100 ? quality : undefined,
        compressionLevel: 9,
        effort: 7,
      });
      break;
    case 'webp':
      pipeline = pipeline.webp({
        quality,
        effort: 6,
      });
      break;
    case 'avif':
      pipeline = pipeline.avif({
        quality,
        effort: 4,
      });
      break;
    default:
      break;
  }

  // 3. Metadata handling
  if (options.stripMetadata === false) {
    pipeline = pipeline.withMetadata();
  }

  return pipeline;
}

/**
 * Optimize image buffer to meet target file size via binary search over compression quality
 */
async function searchOptimalQuality(
  inputPath: string,
  targetFormat: string,
  targetSizeBytes: number,
  options: OptimizeOptions,
  width?: number,
  height?: number
): Promise<{ buffer: Buffer; quality: number; targetReached: boolean }> {
  let low = 5;
  let high = 95;
  let bestBuffer: Buffer | null = null;
  let bestQuality = 80;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const pipeline = buildSharpPipeline(inputPath, targetFormat, mid, options, width, height);
    const buffer = await pipeline.toBuffer();

    if (buffer.length <= targetSizeBytes) {
      bestBuffer = buffer;
      bestQuality = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (bestBuffer) {
    return {
      buffer: bestBuffer,
      quality: bestQuality,
      targetReached: true,
    };
  }

  const fallbackPipeline = buildSharpPipeline(inputPath, targetFormat, 5, options, width, height);
  const fallbackBuffer = await fallbackPipeline.toBuffer();

  return {
    buffer: fallbackBuffer,
    quality: 5,
    targetReached: fallbackBuffer.length <= targetSizeBytes,
  };
}

/**
 * Safely optimize a single image file
 */
export async function optimizeImage(
  inputPath: string,
  options: OptimizeOptions = {},
  rootDir?: string
): Promise<OptimizeResult> {
  try {
    const stat = await fs.stat(inputPath);
    const originalSize = stat.size;
    const metadata = await extractImageMetadata(inputPath);

    const targetFormat = options.format
      ? options.format.toLowerCase()
      : (path.extname(inputPath).replace(/^\./, '').toLowerCase() || 'jpeg');

    let targetSizeBytes: number | undefined;
    if (options.targetSize) {
      targetSizeBytes = parseBytes(options.targetSize);
    }

    let outputBuffer: Buffer;
    let qualityUsed: number | undefined = options.quality ?? 80;
    let targetReached: boolean | undefined;

    if (targetSizeBytes) {
      const searchResult = await searchOptimalQuality(
        inputPath,
        targetFormat,
        targetSizeBytes,
        options,
        metadata.width,
        metadata.height
      );
      outputBuffer = searchResult.buffer;
      qualityUsed = searchResult.quality;
      targetReached = searchResult.targetReached;
    } else {
      const pipeline = buildSharpPipeline(
        inputPath,
        targetFormat,
        qualityUsed,
        options,
        metadata.width,
        metadata.height
      );
      outputBuffer = await pipeline.toBuffer();
    }

    const optimizedSize = outputBuffer.length;
    const savingsBytes = Math.max(0, originalSize - optimizedSize);
    const savingsPercentage = originalSize > 0
      ? parseFloat(((savingsBytes / originalSize) * 100).toFixed(1))
      : 0;

    // Determine safe output path
    let outputPath: string | undefined;

    if (!options.dryRun) {
      const baseDir = rootDir || path.dirname(inputPath);
      const relative = getRelativePath(baseDir, inputPath);
      const ext = `.${targetFormat.replace('jpeg', 'jpg')}`;
      const newFileName = `${path.parse(relative).name}${ext}`;
      const relativeDir = path.dirname(relative);

      if (options.overwrite) {
        outputPath = inputPath;
      } else if (options.outputDir) {
        outputPath = path.resolve(options.outputDir, relativeDir, newFileName);
      } else {
        // Default safe strategy: output into .imgclean folder preserving relative structure
        outputPath = path.resolve(baseDir, '.imgclean', relativeDir, newFileName);
      }

      await ensureDir(path.dirname(outputPath));
      await fs.writeFile(outputPath, outputBuffer);
    }

    return {
      inputPath: normalizePath(inputPath),
      outputPath: outputPath ? normalizePath(outputPath) : undefined,
      originalSize,
      optimizedSize,
      savingsBytes,
      savingsPercentage,
      format: targetFormat,
      width: metadata.width,
      height: metadata.height,
      qualityUsed,
      targetSize: targetSizeBytes,
      targetReached,
      metadataStripped: options.stripMetadata !== false && metadata.hasMetadata,
      dryRun: Boolean(options.dryRun),
      success: true,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      inputPath: normalizePath(inputPath),
      originalSize: 0,
      optimizedSize: 0,
      savingsBytes: 0,
      savingsPercentage: 0,
      format: 'unknown',
      dryRun: Boolean(options.dryRun),
      success: false,
      error: message,
    };
  }
}

/**
 * Optimize a batch of image files safely
 */
export async function optimizeProject(
  rootDir: string,
  files: DiscoveredImageFile[],
  options: OptimizeOptions = {}
): Promise<{
  results: OptimizeResult[];
  totalOriginalSize: number;
  totalOptimizedSize: number;
  totalSavings: number;
  dryRun: boolean;
}> {
  const results: OptimizeResult[] = [];
  let totalOriginalSize = 0;
  let totalOptimizedSize = 0;

  for (const file of files) {
    const res = await optimizeImage(file.absolutePath, options, rootDir);
    results.push(res);
    if (res.success) {
      totalOriginalSize += res.originalSize;
      totalOptimizedSize += res.optimizedSize;
    }
  }

  const totalSavings = Math.max(0, totalOriginalSize - totalOptimizedSize);

  return {
    results,
    totalOriginalSize,
    totalOptimizedSize,
    totalSavings,
    dryRun: Boolean(options.dryRun),
  };
}
