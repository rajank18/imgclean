export type SupportedImageFormat =
  | 'jpg'
  | 'jpeg'
  | 'png'
  | 'webp'
  | 'avif'
  | 'gif'
  | 'tiff'
  | 'svg'
  | 'ico';

export const SUPPORTED_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'webp',
  'avif',
  'gif',
  'tiff',
  'svg',
  'ico',
] as const;

export interface DiscoveredImageFile {
  path: string; // project-relative path with normalized forward slashes
  absolutePath: string;
  size: number;
  format: SupportedImageFormat;
  extension: string;
}

export type IssueType =
  | 'oversized'
  | 'dimensions'
  | 'unused'
  | 'duplicate'
  | 'metadata'
  | 'format';

export type IssueSeverity = 'warning' | 'error';

export interface ImageIssue {
  type: IssueType;
  severity: IssueSeverity;
  file: string;
  message: string;
  potentialSavings?: number;
  details?: Record<string, unknown>;
}

export interface ImageAnalysis extends DiscoveredImageFile {
  width?: number;
  height?: number;
  aspectRatio?: number;
  channels?: number;
  hasAlpha?: boolean;
  hasMetadata?: boolean;
  metadataTypes?: string[];
  hash?: string;
  issues?: ImageIssue[];
  estimatedSavings?: number;
}

export interface DuplicateGroup {
  hash: string;
  size: number;
  files: string[];
  potentialSavings: number; // (files.length - 1) * size
}

export interface BudgetStatus {
  totalBudget?: number;
  totalSize: number;
  passedTotal: boolean;
  singleBudget?: number;
  exceededSingleFiles: Array<{ file: string; size: number; budget: number }>;
  passedSingle: boolean;
  passed: boolean;
}

export interface ScanResult {
  rootPath: string;
  images: ImageAnalysis[];
  totalImages: number;
  totalSize: number;
  potentialSavings: number;
  issues: ImageIssue[];
  duplicates: DuplicateGroup[];
  possiblyUnused: string[];
  formatBreakdown: Record<string, { count: number; size: number }>;
  budget?: BudgetStatus;
  scanDurationMs: number;
}

export interface ImgCleanRulesConfig {
  oversized?: boolean;
  dimensions?: boolean;
  duplicates?: boolean;
  unused?: boolean;
  metadata?: boolean;
}

export interface ImgCleanBudgetsConfig {
  total?: string | number;
  single?: string | number;
}

export interface ImgCleanConfig {
  include?: string[];
  exclude?: string[];
  maxSize?: string | number;
  maxDimension?: number;
  budgets?: ImgCleanBudgetsConfig;
  rules?: ImgCleanRulesConfig;
}

export type ReportType = 'html' | 'json' | 'md';

export interface ScanCliOptions {
  verbose?: boolean;
  json?: boolean;
  report?: ReportType;
  output?: string;
  config?: string;
}
