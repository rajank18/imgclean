import fs from 'node:fs/promises';
import path from 'node:path';
import sharp, { type Sharp } from 'sharp';
import { ensureDir, isDirectory, pathExists } from '../utils/files.js';
import { normalizePath, getRelativePath } from '../utils/paths.js';
import { scanImageFiles } from './scanner.js';
import { extractImageMetadata } from './metadata.js';
import type { SupportedImageFormat } from '../types/index.js';

export type ConvertTargetFormat =
  | 'webp'
  | 'avif'
  | 'png'
  | 'jpeg'
  | 'jpg'
  | 'gif'
  | 'tiff'
  | 'ico';

export interface ConvertOptions {
  quality?: number; // 1-100 (default: 90 for high quality conversion)
  outputDir?: string; // Optional custom output directory
  replace?: boolean; // If true, deletes original image file after successful conversion
  iconSize?: number; // Target dimension for .ico files (default: 32 or 256)
}

export interface ConvertResult {
  inputPath: string;
  outputPath: string;
  sourceFormat: string;
  targetFormat: string;
  originalSize: number;
  convertedSize: number;
  success: boolean;
  replacedOriginal: boolean;
  error?: string;
}

/**
 * Normalize target format name
 */
export function normalizeTargetFormat(format: string): ConvertTargetFormat {
  const normalized = format.toLowerCase().trim().replace(/^\./, '');
  if (normalized === 'jpg') return 'jpeg';

  const validFormats: ConvertTargetFormat[] = [
    'webp',
    'avif',
    'png',
    'jpeg',
    'jpg',
    'gif',
    'tiff',
    'ico',
  ];

  if (validFormats.includes(normalized as ConvertTargetFormat)) {
    return normalized as ConvertTargetFormat;
  }

  throw new Error(
    `Unsupported target format: "${format}". Supported target formats are: webp, avif, png, jpeg, jpg, gif, tiff, ico`
  );
}

/**
 * Extract image data from standard ICO files (which contain embedded PNG or BMP frames)
 */
async function loadIcoBuffer(icoBuffer: Buffer): Promise<Buffer> {
  if (icoBuffer.length < 22) {
    throw new Error('Invalid ICO file: header is too small');
  }

  // ICO header: 6 bytes. First image directory entry: next 16 bytes.
  const imageSize = icoBuffer.readUInt32LE(14); // offset 8 in directory entry (6 + 8 = 14)
  const imageOffset = icoBuffer.readUInt32LE(18); // offset 12 in directory entry (6 + 12 = 18)

  if (imageOffset + imageSize <= icoBuffer.length) {
    const rawImage = icoBuffer.subarray(imageOffset, imageOffset + imageSize);
    return rawImage;
  }

  // Fallback: slice past the 22-byte header
  return icoBuffer.subarray(22);
}

/**
 * Load image into Sharp instance with robust support for all supported formats (including ICO & SVG)
 */
async function createSharpInstance(inputPath: string): Promise<{ instance: Sharp; isIco: boolean }> {
  const ext = path.extname(inputPath).toLowerCase().replace(/^\./, '');

  if (ext === 'ico') {
    const fileBuffer = await fs.readFile(inputPath);
    try {
      // First try reading directly
      const direct = sharp(fileBuffer, { failOn: 'none' });
      await direct.metadata();
      return { instance: direct, isIco: true };
    } catch {
      // Extract embedded payload from ICO structure
      const extracted = await loadIcoBuffer(fileBuffer);
      const fallback = sharp(extracted, { failOn: 'none' });
      return { instance: fallback, isIco: true };
    }
  }

  return {
    instance: sharp(inputPath, { failOn: 'none' }),
    isIco: false,
  };
}

/**
 * Generate a standard Windows .ico buffer containing a PNG payload
 */
async function generateIcoBuffer(sharpInstance: Sharp, iconSize: number = 256): Promise<Buffer> {
  const pngBuffer = await sharpInstance
    .resize(iconSize, iconSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved (must be 0)
  header.writeUInt16LE(1, 2); // Type (1 = icon)
  header.writeUInt16LE(1, 4); // Number of images in file

  const dirEntry = Buffer.alloc(16);
  // Width & height (0 means 256 in ICO spec)
  dirEntry.writeUInt8(iconSize >= 256 ? 0 : iconSize, 0);
  dirEntry.writeUInt8(iconSize >= 256 ? 0 : iconSize, 1);
  dirEntry.writeUInt8(0, 2); // Color palette
  dirEntry.writeUInt8(0, 3); // Reserved
  dirEntry.writeUInt16LE(1, 4); // Color planes
  dirEntry.writeUInt16LE(32, 6); // Bits per pixel (32-bit RGBA)
  dirEntry.writeUInt32LE(pngBuffer.length, 8); // Size of image data
  dirEntry.writeUInt32LE(22, 12); // Offset to image data (6 header + 16 dir entry = 22)

  return Buffer.concat([header, dirEntry, pngBuffer]);
}

/**
 * Convert a single image file to the target format
 */
export async function convertImage(
  inputPath: string,
  targetFormatRaw: string,
  options: ConvertOptions = {}
): Promise<ConvertResult> {
  const resolvedInput = path.resolve(inputPath);
  const targetFormat = normalizeTargetFormat(targetFormatRaw);
  const quality = options.quality ?? 90;

  try {
    const stat = await fs.stat(resolvedInput);
    const originalSize = stat.size;

    const sourceExt = path.extname(resolvedInput).replace(/^\./, '').toLowerCase();
    const sourceFormat = sourceExt || 'unknown';

    const { instance: sharpInstance } = await createSharpInstance(resolvedInput);

    let outputBuffer: Buffer;

    switch (targetFormat) {
      case 'jpeg':
      case 'jpg':
        outputBuffer = await sharpInstance.jpeg({ quality, mozjpeg: true }).toBuffer();
        break;
      case 'png':
        outputBuffer = await sharpInstance.png({ compressionLevel: 9 }).toBuffer();
        break;
      case 'webp':
        outputBuffer = await sharpInstance.webp({ quality, effort: 6 }).toBuffer();
        break;
      case 'avif':
        outputBuffer = await sharpInstance.avif({ quality, effort: 4 }).toBuffer();
        break;
      case 'gif':
        outputBuffer = await sharpInstance.gif().toBuffer();
        break;
      case 'tiff':
        outputBuffer = await sharpInstance.tiff({ quality }).toBuffer();
        break;
      case 'ico':
        outputBuffer = await generateIcoBuffer(sharpInstance, options.iconSize || 256);
        break;
      default:
        throw new Error(`Unsupported target format: ${targetFormat}`);
    }

    // Determine output path (same directory as input unless custom outputDir specified)
    const baseName = path.parse(resolvedInput).name;
    const targetExtension = targetFormat === 'jpeg' ? 'jpg' : targetFormat;
    const newFileName = `${baseName}.${targetExtension}`;

    let outputPath: string;
    if (options.outputDir) {
      outputPath = path.resolve(options.outputDir, newFileName);
    } else {
      outputPath = path.resolve(path.dirname(resolvedInput), newFileName);
    }

    await ensureDir(path.dirname(outputPath));
    await fs.writeFile(outputPath, outputBuffer);

    let replacedOriginal = false;
    // If replace is requested and the output path is different from input path, remove the original file
    if (options.replace && resolvedInput !== outputPath) {
      try {
        await fs.unlink(resolvedInput);
        replacedOriginal = true;
      } catch {
        // Ignore deletion errors
      }
    }

    return {
      inputPath: normalizePath(resolvedInput),
      outputPath: normalizePath(outputPath),
      sourceFormat,
      targetFormat,
      originalSize,
      convertedSize: outputBuffer.length,
      success: true,
      replacedOriginal,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      inputPath: normalizePath(resolvedInput),
      outputPath: '',
      sourceFormat: path.extname(resolvedInput).replace(/^\./, '').toLowerCase(),
      targetFormat,
      originalSize: 0,
      convertedSize: 0,
      success: false,
      replacedOriginal: false,
      error: message,
    };
  }
}

/**
 * Convert a single file or recursively convert all images in a directory
 */
export async function convertProjectOrFile(
  targetPath: string,
  targetFormatRaw: string,
  options: ConvertOptions = {}
): Promise<ConvertResult[]> {
  const resolved = path.resolve(targetPath);

  if (!pathExists(resolved)) {
    throw new Error(`Target path does not exist: "${targetPath}"`);
  }

  const isDir = await isDirectory(resolved);

  if (!isDir) {
    const singleResult = await convertImage(resolved, targetFormatRaw, options);
    return [singleResult];
  }

  // Scan all supported image files in the directory
  const { files } = await scanImageFiles(resolved);
  const results: ConvertResult[] = [];

  for (const file of files) {
    const res = await convertImage(file.absolutePath, targetFormatRaw, {
      ...options,
      outputDir: options.outputDir
        ? path.resolve(options.outputDir, path.dirname(getRelativePath(resolved, file.absolutePath)))
        : undefined,
    });
    results.push(res);
  }

  return results;
}
