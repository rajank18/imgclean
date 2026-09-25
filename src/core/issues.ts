import type { ImageAnalysis, ImageIssue, ImgCleanRulesConfig } from '../types/index.js';
import { formatBytes } from '../utils/bytes.js';

export const DEFAULT_MAX_FILE_SIZE = 500 * 1024; // 500 KB
export const DEFAULT_MAX_DIMENSION = 2560; // 2560 px

export interface IssueDetectionOptions {
  maxSize?: number;
  maxDimension?: number;
  rules?: ImgCleanRulesConfig;
}

/**
 * Check if an image is oversized based on file size threshold
 */
export function checkOversizedIssue(
  image: ImageAnalysis,
  maxSize: number = DEFAULT_MAX_FILE_SIZE
): ImageIssue | null {
  if (image.size > maxSize) {
    const diff = image.size - maxSize;
    return {
      type: 'oversized',
      severity: 'warning',
      file: image.path,
      message: `File size ${formatBytes(image.size)} exceeds threshold of ${formatBytes(maxSize)}`,
      potentialSavings: diff,
      details: {
        size: image.size,
        threshold: maxSize,
        excessBytes: diff,
      },
    };
  }
  return null;
}

/**
 * Check if image dimensions exceed maximum threshold
 */
export function checkDimensionIssue(
  image: ImageAnalysis,
  maxDimension: number = DEFAULT_MAX_DIMENSION
): ImageIssue | null {
  const { width, height, path: filePath, size } = image;
  if (!width || !height) return null;

  if (width > maxDimension || height > maxDimension) {
    // Calculate recommended proportional dimensions
    let recommendedWidth = width;
    let recommendedHeight = height;

    if (width >= height) {
      recommendedWidth = maxDimension;
      recommendedHeight = Math.round((height / width) * maxDimension);
    } else {
      recommendedHeight = maxDimension;
      recommendedWidth = Math.round((width / height) * maxDimension);
    }

    // Estimate conservative savings from pixel area reduction
    const currentPixels = width * height;
    const targetPixels = recommendedWidth * recommendedHeight;
    const pixelRatio = targetPixels / currentPixels;
    // Conservative estimated savings: file size scales roughly with pixel count (with 0.7 dampening factor)
    const estimatedSavings = Math.max(0, Math.round(size * (1 - pixelRatio) * 0.7));

    return {
      type: 'dimensions',
      severity: 'warning',
      file: filePath,
      message: `Dimensions ${width}×${height} exceed limit (${maxDimension}px). Recommended: ${recommendedWidth}×${recommendedHeight}`,
      potentialSavings: estimatedSavings,
      details: {
        currentWidth: width,
        currentHeight: height,
        recommendedWidth,
        recommendedHeight,
        maxDimension,
      },
    };
  }

  return null;
}

/**
 * Check if image contains removable metadata (EXIF, IPTC, XMP)
 */
export function checkMetadataIssue(image: ImageAnalysis): ImageIssue | null {
  if (image.hasMetadata && image.metadataTypes && image.metadataTypes.length > 0) {
    // SVGs usually don't have binary EXIF in the same way, but raster formats do
    if (image.format === 'svg') return null;

    const typesStr = image.metadataTypes.join(', ');
    // Metadata stripping typically saves between 1KB to 10KB
    const estimatedSavings = Math.min(image.size > 20480 ? 4096 : 1024, Math.round(image.size * 0.05));

    return {
      type: 'metadata',
      severity: 'warning',
      file: image.path,
      message: `Contains non-essential metadata headers: ${typesStr}`,
      potentialSavings: estimatedSavings,
      details: {
        metadataTypes: image.metadataTypes,
      },
    };
  }

  return null;
}
