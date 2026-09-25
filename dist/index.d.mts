//#region src/types/index.d.ts
type SupportedImageFormat = 'jpg' | 'jpeg' | 'png' | 'webp' | 'avif' | 'gif' | 'tiff' | 'svg';
declare const SUPPORTED_EXTENSIONS: readonly ["jpg", "jpeg", "png", "webp", "avif", "gif", "tiff", "svg"];
interface DiscoveredImageFile {
  path: string;
  absolutePath: string;
  size: number;
  format: SupportedImageFormat;
  extension: string;
}
type IssueType = 'oversized' | 'dimensions' | 'unused' | 'duplicate' | 'metadata' | 'format';
type IssueSeverity = 'warning' | 'error';
interface ImageIssue {
  type: IssueType;
  severity: IssueSeverity;
  file: string;
  message: string;
  potentialSavings?: number;
  details?: Record<string, unknown>;
}
interface ImageAnalysis extends DiscoveredImageFile {
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
interface DuplicateGroup {
  hash: string;
  size: number;
  files: string[];
  potentialSavings: number;
}
interface BudgetStatus {
  totalBudget?: number;
  totalSize: number;
  passedTotal: boolean;
  singleBudget?: number;
  exceededSingleFiles: Array<{
    file: string;
    size: number;
    budget: number;
  }>;
  passedSingle: boolean;
  passed: boolean;
}
interface ScanResult {
  rootPath: string;
  images: ImageAnalysis[];
  totalImages: number;
  totalSize: number;
  potentialSavings: number;
  issues: ImageIssue[];
  duplicates: DuplicateGroup[];
  possiblyUnused: string[];
  formatBreakdown: Record<string, {
    count: number;
    size: number;
  }>;
  budget?: BudgetStatus;
  scanDurationMs: number;
}
interface ImgCleanRulesConfig {
  oversized?: boolean;
  dimensions?: boolean;
  duplicates?: boolean;
  unused?: boolean;
  metadata?: boolean;
}
interface ImgCleanBudgetsConfig {
  total?: string | number;
  single?: string | number;
}
interface ImgCleanConfig {
  include?: string[];
  exclude?: string[];
  maxSize?: string | number;
  maxDimension?: number;
  budgets?: ImgCleanBudgetsConfig;
  rules?: ImgCleanRulesConfig;
}
type ReportType = 'html' | 'json' | 'md';
interface ScanCliOptions {
  verbose?: boolean;
  json?: boolean;
  report?: ReportType;
  output?: string;
  config?: string;
}
//#endregion
//#region src/core/scanner.d.ts
interface ScannerOptions {
  include?: string[];
  exclude?: string[];
}
declare const DEFAULT_EXCLUDE_PATTERNS: string[];
/**
 * Check if an extension is a supported image extension
 */
declare function isSupportedImageExtension(ext: string): ext is SupportedImageFormat;
/**
 * Infer format from file extension
 */
declare function inferFormatFromExtension(filePath: string): SupportedImageFormat | null;
/**
 * Scan a project or directory for supported image files
 */
declare function scanImageFiles(targetPath?: string, options?: ScannerOptions): Promise<{
  rootDir: string;
  files: DiscoveredImageFile[];
}>;
//#endregion
//#region src/core/analyzer.d.ts
interface AnalyzerOptions {
  config?: ImgCleanConfig | null;
}
/**
 * Analyze a single image file for structural properties, metadata, and issues
 */
declare function analyzeImage(file: DiscoveredImageFile, options?: AnalyzerOptions): Promise<ImageAnalysis>;
/**
 * Analyze a full collection of discovered images in a project
 */
declare function analyzeProject(rootDir: string, files: DiscoveredImageFile[], options?: AnalyzerOptions): Promise<ScanResult>;
//#endregion
//#region src/core/optimizer.d.ts
interface OptimizeOptions {
  compress?: boolean;
  quality?: number;
  format?: 'webp' | 'avif' | 'png' | 'jpeg' | 'jpg';
  resize?: boolean;
  maxWidth?: number;
  maxHeight?: number;
  targetSize?: string | number;
  stripMetadata?: boolean;
  dryRun?: boolean;
  outputDir?: string;
  overwrite?: boolean;
}
interface OptimizeResult {
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
 * Safely optimize a single image file
 */
declare function optimizeImage(inputPath: string, options?: OptimizeOptions, rootDir?: string): Promise<OptimizeResult>;
/**
 * Optimize a batch of image files safely
 */
declare function optimizeProject(rootDir: string, files: DiscoveredImageFile[], options?: OptimizeOptions): Promise<{
  results: OptimizeResult[];
  totalOriginalSize: number;
  totalOptimizedSize: number;
  totalSavings: number;
  dryRun: boolean;
}>;
//#endregion
//#region src/core/metadata.d.ts
interface ExtractedMetadata {
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
declare function extractImageMetadata(filePath: string): Promise<ExtractedMetadata>;
//#endregion
//#region src/core/duplicates.d.ts
interface ImageWithHash extends DiscoveredImageFile {
  hash: string;
}
/**
 * Find exact duplicate files based on content hash (SHA-256)
 */
declare function findDuplicateGroups(images: ImageWithHash[]): DuplicateGroup[];
/**
 * Generate issue records for detected duplicate images
 */
declare function generateDuplicateIssues(duplicateGroups: DuplicateGroup[]): ImageIssue[];
//#endregion
//#region src/core/unused.d.ts
declare const SOURCE_EXTENSIONS: string[];
interface UnusedDetectionOptions {
  sourceGlob?: string[];
  exclude?: string[];
}
/**
 * Extract potential asset references from source files
 */
declare function findPossiblyUnusedImages(rootDir: string, images: DiscoveredImageFile[], options?: UnusedDetectionOptions): Promise<string[]>;
/**
 * Generate issue records for possibly unused images
 */
declare function generateUnusedIssues(unusedPaths: string[], images: DiscoveredImageFile[]): ImageIssue[];
//#endregion
//#region src/core/budget.d.ts
/**
 * Check total project and individual image size against configured budgets
 */
declare function checkBudget(images: Array<DiscoveredImageFile | ImageAnalysis>, budgetsConfig?: ImgCleanBudgetsConfig): BudgetStatus | undefined;
//#endregion
//#region src/core/issues.d.ts
declare const DEFAULT_MAX_FILE_SIZE: number;
declare const DEFAULT_MAX_DIMENSION = 2560;
interface IssueDetectionOptions {
  maxSize?: number;
  maxDimension?: number;
  rules?: ImgCleanRulesConfig;
}
/**
 * Check if an image is oversized based on file size threshold
 */
declare function checkOversizedIssue(image: ImageAnalysis, maxSize?: number): ImageIssue | null;
/**
 * Check if image dimensions exceed maximum threshold
 */
declare function checkDimensionIssue(image: ImageAnalysis, maxDimension?: number): ImageIssue | null;
/**
 * Check if image contains removable metadata (EXIF, IPTC, XMP)
 */
declare function checkMetadataIssue(image: ImageAnalysis): ImageIssue | null;
//#endregion
//#region src/utils/bytes.d.ts
/**
 * Format bytes into human-readable string (e.g., "18.4 MB", "982 KB")
 */
declare function formatBytes(bytes: number, decimals?: number): string;
/**
 * Parse a size string like "500kb", "10mb", "1.5GB", "1024" into bytes
 */
declare function parseBytes(input: string | number): number;
//#endregion
//#region src/utils/paths.d.ts
/**
 * Normalize file path separators to standard posix forward slashes
 */
declare function normalizePath(filePath: string): string;
/**
 * Get relative path from root directory with normalized forward slashes
 */
declare function getRelativePath(from: string, to: string): string;
/**
 * Resolve path against current working directory
 */
declare function resolvePath(targetPath?: string, basePath?: string): string;
//#endregion
//#region src/utils/files.d.ts
/**
 * Check if a file or directory exists
 */
declare function pathExists(filePath: string): boolean;
/**
 * Check if a path is a directory
 */
declare function isDirectory(targetPath: string): Promise<boolean>;
/**
 * Ensure directory exists
 */
declare function ensureDir(dirPath: string): Promise<void>;
/**
 * Safely load JSON configuration file
 */
declare function loadJsonFile<T = unknown>(filePath: string): Promise<T | null>;
/**
 * Find default imgclean configuration file in project root
 */
declare function findConfigFile(rootDir: string, customConfigPath?: string): Promise<string | null>;
//#endregion
//#region src/utils/hashing.d.ts
/**
 * Calculate SHA-256 hash of a buffer
 */
declare function hashBuffer(buffer: Buffer): string;
/**
 * Calculate SHA-256 hash of a file asynchronously
 */
declare function hashFile(filePath: string): Promise<string>;
//#endregion
//#region src/cli/output/json.d.ts
declare function generateJsonReport(result: ScanResult): string;
//#endregion
//#region src/cli/output/markdown.d.ts
declare function generateMarkdownReport(result: ScanResult): string;
//#endregion
//#region src/cli/output/html.d.ts
declare function generateHtmlReport(result: ScanResult): string;
//#endregion
//#region src/cli/output/terminal.d.ts
interface TerminalOutputOptions {
  verbose?: boolean;
}
/**
 * Render standard polished terminal output for scan results
 */
declare function renderTerminalOutput(result: ScanResult, options?: TerminalOutputOptions): string;
//#endregion
//#region src/index.d.ts
/**
 * Scan and analyze a project directory for image health, bloat, issues, duplicates, and unused assets
 */
declare function scanProject(targetPath?: string, config?: ImgCleanConfig): Promise<ScanResult>;
//#endregion
export { AnalyzerOptions, BudgetStatus, DEFAULT_EXCLUDE_PATTERNS, DEFAULT_MAX_DIMENSION, DEFAULT_MAX_FILE_SIZE, DiscoveredImageFile, DuplicateGroup, ExtractedMetadata, ImageAnalysis, ImageIssue, ImageWithHash, ImgCleanBudgetsConfig, ImgCleanConfig, ImgCleanRulesConfig, IssueDetectionOptions, IssueSeverity, IssueType, OptimizeOptions, OptimizeResult, ReportType, SOURCE_EXTENSIONS, SUPPORTED_EXTENSIONS, ScanCliOptions, ScanResult, ScannerOptions, SupportedImageFormat, TerminalOutputOptions, UnusedDetectionOptions, analyzeImage, analyzeProject, checkBudget, checkDimensionIssue, checkMetadataIssue, checkOversizedIssue, ensureDir, extractImageMetadata, findConfigFile, findDuplicateGroups, findPossiblyUnusedImages, formatBytes, generateDuplicateIssues, generateHtmlReport, generateJsonReport, generateMarkdownReport, generateUnusedIssues, getRelativePath, hashBuffer, hashFile, inferFormatFromExtension, isDirectory, isSupportedImageExtension, loadJsonFile, normalizePath, optimizeImage, optimizeProject, parseBytes, pathExists, renderTerminalOutput, resolvePath, scanImageFiles, scanProject };
//# sourceMappingURL=index.d.mts.map