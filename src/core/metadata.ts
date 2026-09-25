import sharp from 'sharp';
import type { SupportedImageFormat } from '../types/index.js';

export interface ExtractedMetadata {
  width?: number;
  height?: number;
  aspectRatio?: number;
  channels?: number;
  hasAlpha?: boolean;
  hasMetadata?: boolean;
  metadataTypes?: string[];
  format?: SupportedImageFormat;
  density?: number;
}

/**
 * Extract image metadata and structural properties using Sharp
 */
export async function extractImageMetadata(filePath: string): Promise<ExtractedMetadata> {
  try {
    const image = sharp(filePath, { failOn: 'none' });
    const meta = await image.metadata();

    const metadataTypes: string[] = [];
    if (meta.exif && meta.exif.length > 0) metadataTypes.push('EXIF');
    if (meta.iptc && meta.iptc.length > 0) metadataTypes.push('IPTC');
    if (meta.xmp && meta.xmp.length > 0) metadataTypes.push('XMP');
    if (meta.icc && meta.icc.length > 0) metadataTypes.push('ICC Profile');

    const width = meta.width;
    const height = meta.height;
    const aspectRatio = width && height && height > 0 ? parseFloat((width / height).toFixed(3)) : undefined;

    return {
      width,
      height,
      aspectRatio,
      channels: meta.channels,
      hasAlpha: Boolean(meta.hasAlpha),
      hasMetadata: metadataTypes.length > 0,
      metadataTypes,
      density: meta.density,
    };
  } catch {
    // For unreadable / corrupt files or SVGs not supported directly by sharp
    return {
      hasMetadata: false,
      metadataTypes: [],
    };
  }
}
