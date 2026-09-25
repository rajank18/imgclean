import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import fs$1, { existsSync } from "node:fs";
import sharp from "sharp";
import crypto from "node:crypto";
import chalk from "chalk";
//#region src/types/index.ts
const SUPPORTED_EXTENSIONS = [
	"jpg",
	"jpeg",
	"png",
	"webp",
	"avif",
	"gif",
	"tiff",
	"svg"
];
//#endregion
//#region src/utils/paths.ts
/**
* Normalize file path separators to standard posix forward slashes
*/
function normalizePath(filePath) {
	return filePath.replace(/\\/g, "/");
}
/**
* Get relative path from root directory with normalized forward slashes
*/
function getRelativePath(from, to) {
	return normalizePath(path.relative(from, to));
}
/**
* Resolve path against current working directory
*/
function resolvePath(targetPath, basePath = process.cwd()) {
	if (!targetPath) return path.resolve(basePath);
	return path.isAbsolute(targetPath) ? path.normalize(targetPath) : path.resolve(basePath, targetPath);
}
//#endregion
//#region src/utils/files.ts
/**
* Check if a file or directory exists
*/
function pathExists(filePath) {
	return existsSync(filePath);
}
/**
* Check if a path is a directory
*/
async function isDirectory(targetPath) {
	try {
		return (await fs.stat(targetPath)).isDirectory();
	} catch {
		return false;
	}
}
/**
* Ensure directory exists
*/
async function ensureDir(dirPath) {
	await fs.mkdir(dirPath, { recursive: true });
}
/**
* Safely load JSON configuration file
*/
async function loadJsonFile(filePath) {
	try {
		const content = await fs.readFile(filePath, "utf-8");
		return JSON.parse(content);
	} catch {
		return null;
	}
}
/**
* Find default imgclean configuration file in project root
*/
async function findConfigFile(rootDir, customConfigPath) {
	if (customConfigPath) {
		const resolved = path.isAbsolute(customConfigPath) ? customConfigPath : path.resolve(rootDir, customConfigPath);
		return existsSync(resolved) ? resolved : null;
	}
	for (const filename of [
		"imgclean.config.json",
		".imgcleanrc.json",
		".imgcleanrc"
	]) {
		const candidate = path.join(rootDir, filename);
		if (existsSync(candidate)) return candidate;
	}
	return null;
}
//#endregion
//#region src/core/scanner.ts
const DEFAULT_EXCLUDE_PATTERNS = [
	"**/node_modules/**",
	"**/.git/**",
	"**/.next/**",
	"**/.nuxt/**",
	"**/.svelte-kit/**",
	"**/dist/**",
	"**/build/**",
	"**/coverage/**",
	"**/.imgclean/**"
];
/**
* Check if an extension is a supported image extension
*/
function isSupportedImageExtension(ext) {
	const normalized = ext.toLowerCase().replace(/^\./, "");
	return SUPPORTED_EXTENSIONS.includes(normalized);
}
/**
* Infer format from file extension
*/
function inferFormatFromExtension(filePath) {
	const ext = path.extname(filePath).toLowerCase().replace(/^\./, "");
	if (isSupportedImageExtension(ext)) return ext;
	return null;
}
/**
* Scan a project or directory for supported image files
*/
async function scanImageFiles(targetPath = process.cwd(), options = {}) {
	const resolvedTarget = resolvePath(targetPath);
	if (!pathExists(resolvedTarget)) throw new Error(`Target path does not exist: "${targetPath}"`);
	if (!await isDirectory(resolvedTarget)) {
		const format = inferFormatFromExtension(resolvedTarget);
		if (!format) throw new Error(`Target file is not a supported image format: "${targetPath}"`);
		const stat = await fs.stat(resolvedTarget);
		const rootDir = path.dirname(resolvedTarget);
		const ext = path.extname(resolvedTarget).replace(/^\./, "").toLowerCase();
		return {
			rootDir,
			files: [{
				path: normalizePath(path.basename(resolvedTarget)),
				absolutePath: resolvedTarget,
				size: stat.size,
				format,
				extension: ext
			}]
		};
	}
	const rootDir = resolvedTarget;
	const extPattern = SUPPORTED_EXTENSIONS.join(",");
	const defaultInclude = [`**/*.{${extPattern}}`, `**/*.{${extPattern.toUpperCase()}}`];
	const includePatterns = options.include && options.include.length > 0 ? options.include : defaultInclude;
	const excludePatterns = [...DEFAULT_EXCLUDE_PATTERNS, ...options.exclude || []];
	const matchedPaths = await fg(includePatterns, {
		cwd: normalizePath(rootDir),
		absolute: true,
		dot: false,
		ignore: excludePatterns,
		onlyFiles: true,
		followSymbolicLinks: false
	});
	const files = [];
	for (const absPath of matchedPaths) {
		const format = inferFormatFromExtension(absPath);
		if (!format) continue;
		try {
			const stat = await fs.stat(absPath);
			const ext = path.extname(absPath).replace(/^\./, "").toLowerCase();
			const relative = getRelativePath(rootDir, absPath);
			files.push({
				path: relative,
				absolutePath: absPath,
				size: stat.size,
				format,
				extension: ext
			});
		} catch {}
	}
	files.sort((a, b) => a.path.localeCompare(b.path));
	return {
		rootDir,
		files
	};
}
//#endregion
//#region src/core/metadata.ts
/**
* Extract image metadata and structural properties using Sharp
*/
async function extractImageMetadata(filePath) {
	try {
		const meta = await sharp(filePath, { failOn: "none" }).metadata();
		const metadataTypes = [];
		if (meta.exif && meta.exif.length > 0) metadataTypes.push("EXIF");
		if (meta.iptc && meta.iptc.length > 0) metadataTypes.push("IPTC");
		if (meta.xmp && meta.xmp.length > 0) metadataTypes.push("XMP");
		if (meta.icc && meta.icc.length > 0) metadataTypes.push("ICC Profile");
		const width = meta.width;
		const height = meta.height;
		return {
			width,
			height,
			aspectRatio: width && height && height > 0 ? parseFloat((width / height).toFixed(3)) : void 0,
			channels: meta.channels,
			hasAlpha: Boolean(meta.hasAlpha),
			hasMetadata: metadataTypes.length > 0,
			metadataTypes,
			density: meta.density
		};
	} catch {
		return {
			hasMetadata: false,
			metadataTypes: []
		};
	}
}
//#endregion
//#region src/utils/hashing.ts
/**
* Calculate SHA-256 hash of a buffer
*/
function hashBuffer(buffer) {
	return crypto.createHash("sha256").update(buffer).digest("hex");
}
/**
* Calculate SHA-256 hash of a file asynchronously
*/
async function hashFile(filePath) {
	return new Promise((resolve, reject) => {
		const hash = crypto.createHash("sha256");
		const stream = fs$1.createReadStream(filePath);
		stream.on("error", (err) => reject(err));
		stream.on("data", (chunk) => hash.update(chunk));
		stream.on("end", () => resolve(hash.digest("hex")));
	});
}
//#endregion
//#region src/utils/bytes.ts
/**
* Format bytes into human-readable string (e.g., "18.4 MB", "982 KB")
*/
function formatBytes(bytes, decimals = 1) {
	if (bytes === 0) return "0 B";
	if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = [
		"B",
		"KB",
		"MB",
		"GB",
		"TB"
	];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	const idx = Math.min(i, sizes.length - 1);
	const val = bytes / Math.pow(k, idx);
	return `${parseFloat(val.toFixed(dm))} ${sizes[idx]}`;
}
/**
* Parse a size string like "500kb", "10mb", "1.5GB", "1024" into bytes
*/
function parseBytes(input) {
	if (typeof input === "number") return input;
	const match = input.trim().toLowerCase().match(/^([\d.]+)\s*([a-z]*)$/i);
	if (!match || !match[1]) throw new Error(`Invalid byte size format: "${input}"`);
	const num = parseFloat(match[1]);
	if (Number.isNaN(num)) throw new Error(`Invalid numeric value in byte size: "${input}"`);
	const unit = match[2] ?? "";
	switch (unit) {
		case "b":
		case "": return Math.round(num);
		case "k":
		case "kb": return Math.round(num * 1024);
		case "m":
		case "mb": return Math.round(num * 1024 * 1024);
		case "g":
		case "gb": return Math.round(num * 1024 * 1024 * 1024);
		case "t":
		case "tb": return Math.round(num * 1024 * 1024 * 1024 * 1024);
		default: throw new Error(`Unknown byte unit: "${unit}" in "${input}"`);
	}
}
//#endregion
//#region src/core/duplicates.ts
/**
* Find exact duplicate files based on content hash (SHA-256)
*/
function findDuplicateGroups(images) {
	const hashMap = /* @__PURE__ */ new Map();
	for (const img of images) {
		const list = hashMap.get(img.hash) || [];
		list.push(img);
		hashMap.set(img.hash, list);
	}
	const duplicates = [];
	for (const [hash, group] of hashMap.entries()) if (group.length > 1 && group[0]) {
		const size = group[0].size;
		const filePaths = group.map((item) => item.path);
		const potentialSavings = (group.length - 1) * size;
		duplicates.push({
			hash,
			size,
			files: filePaths,
			potentialSavings
		});
	}
	duplicates.sort((a, b) => b.potentialSavings - a.potentialSavings);
	return duplicates;
}
/**
* Generate issue records for detected duplicate images
*/
function generateDuplicateIssues(duplicateGroups) {
	const issues = [];
	for (const group of duplicateGroups) for (let i = 1; i < group.files.length; i++) {
		const file = group.files[i];
		const original = group.files[0];
		if (file && original) issues.push({
			type: "duplicate",
			severity: "warning",
			file,
			message: `Identical content duplicate of "${original}" (${formatBytes(group.size)})`,
			potentialSavings: group.size,
			details: {
				hash: group.hash,
				originalFile: original,
				duplicateGroup: group.files
			}
		});
	}
	return issues;
}
//#endregion
//#region src/core/unused.ts
const SOURCE_EXTENSIONS = [
	"html",
	"htm",
	"jsx",
	"tsx",
	"js",
	"ts",
	"mjs",
	"cjs",
	"css",
	"scss",
	"sass",
	"less",
	"json",
	"md",
	"mdx",
	"vue",
	"svelte",
	"astro",
	"php"
];
/**
* Extract potential asset references from source files
*/
async function findPossiblyUnusedImages(rootDir, images, options = {}) {
	if (images.length === 0) return [];
	const sourcePattern = `**/*.{${SOURCE_EXTENSIONS.join(",")}}`;
	const includePatterns = options.sourceGlob && options.sourceGlob.length > 0 ? options.sourceGlob : [sourcePattern];
	const excludePatterns = [...DEFAULT_EXCLUDE_PATTERNS, ...options.exclude || []];
	const sourceFiles = await fg(includePatterns, {
		cwd: normalizePath(rootDir),
		absolute: true,
		dot: false,
		ignore: excludePatterns,
		onlyFiles: true
	});
	if (sourceFiles.length === 0) return [];
	const sourceContents = [];
	for (const srcPath of sourceFiles) try {
		const content = await fs.readFile(srcPath, "utf-8");
		sourceContents.push(content);
	} catch {}
	const combinedSource = sourceContents.join("\n");
	const unusedImagePaths = [];
	for (const image of images) {
		const relPath = image.path;
		const basename = path.basename(relPath);
		const nameWithoutExt = path.parse(relPath).name;
		if (!(combinedSource.includes(relPath) || combinedSource.includes(basename) || nameWithoutExt.length > 3 && combinedSource.includes(nameWithoutExt))) unusedImagePaths.push(relPath);
	}
	return unusedImagePaths;
}
/**
* Generate issue records for possibly unused images
*/
function generateUnusedIssues(unusedPaths, images) {
	const imageMap = new Map(images.map((img) => [img.path, img]));
	const issues = [];
	for (const unusedPath of unusedPaths) {
		const img = imageMap.get(unusedPath);
		const size = img ? img.size : 0;
		issues.push({
			type: "unused",
			severity: "warning",
			file: unusedPath,
			message: `Possibly unused image (no static references found in source code)`,
			potentialSavings: size,
			details: {
				size,
				formattedSize: formatBytes(size)
			}
		});
	}
	return issues;
}
//#endregion
//#region src/core/budget.ts
/**
* Check total project and individual image size against configured budgets
*/
function checkBudget(images, budgetsConfig) {
	if (!budgetsConfig || !budgetsConfig.total && !budgetsConfig.single) return;
	const totalSize = images.reduce((acc, img) => acc + img.size, 0);
	let totalBudget;
	let passedTotal = true;
	if (budgetsConfig.total) {
		totalBudget = parseBytes(budgetsConfig.total);
		passedTotal = totalSize <= totalBudget;
	}
	let singleBudget;
	let passedSingle = true;
	const exceededSingleFiles = [];
	if (budgetsConfig.single) {
		singleBudget = parseBytes(budgetsConfig.single);
		for (const img of images) if (img.size > singleBudget) exceededSingleFiles.push({
			file: img.path,
			size: img.size,
			budget: singleBudget
		});
		passedSingle = exceededSingleFiles.length === 0;
	}
	return {
		totalBudget,
		totalSize,
		passedTotal,
		singleBudget,
		exceededSingleFiles,
		passedSingle,
		passed: passedTotal && passedSingle
	};
}
//#endregion
//#region src/core/issues.ts
const DEFAULT_MAX_FILE_SIZE = 500 * 1024;
const DEFAULT_MAX_DIMENSION = 2560;
/**
* Check if an image is oversized based on file size threshold
*/
function checkOversizedIssue(image, maxSize = DEFAULT_MAX_FILE_SIZE) {
	if (image.size > maxSize) {
		const diff = image.size - maxSize;
		return {
			type: "oversized",
			severity: "warning",
			file: image.path,
			message: `File size ${formatBytes(image.size)} exceeds threshold of ${formatBytes(maxSize)}`,
			potentialSavings: diff,
			details: {
				size: image.size,
				threshold: maxSize,
				excessBytes: diff
			}
		};
	}
	return null;
}
/**
* Check if image dimensions exceed maximum threshold
*/
function checkDimensionIssue(image, maxDimension = DEFAULT_MAX_DIMENSION) {
	const { width, height, path: filePath, size } = image;
	if (!width || !height) return null;
	if (width > maxDimension || height > maxDimension) {
		let recommendedWidth = width;
		let recommendedHeight = height;
		if (width >= height) {
			recommendedWidth = maxDimension;
			recommendedHeight = Math.round(height / width * maxDimension);
		} else {
			recommendedHeight = maxDimension;
			recommendedWidth = Math.round(width / height * maxDimension);
		}
		const currentPixels = width * height;
		const pixelRatio = recommendedWidth * recommendedHeight / currentPixels;
		const estimatedSavings = Math.max(0, Math.round(size * (1 - pixelRatio) * .7));
		return {
			type: "dimensions",
			severity: "warning",
			file: filePath,
			message: `Dimensions ${width}×${height} exceed limit (${maxDimension}px). Recommended: ${recommendedWidth}×${recommendedHeight}`,
			potentialSavings: estimatedSavings,
			details: {
				currentWidth: width,
				currentHeight: height,
				recommendedWidth,
				recommendedHeight,
				maxDimension
			}
		};
	}
	return null;
}
/**
* Check if image contains removable metadata (EXIF, IPTC, XMP)
*/
function checkMetadataIssue(image) {
	if (image.hasMetadata && image.metadataTypes && image.metadataTypes.length > 0) {
		if (image.format === "svg") return null;
		const typesStr = image.metadataTypes.join(", ");
		const estimatedSavings = Math.min(image.size > 20480 ? 4096 : 1024, Math.round(image.size * .05));
		return {
			type: "metadata",
			severity: "warning",
			file: image.path,
			message: `Contains non-essential metadata headers: ${typesStr}`,
			potentialSavings: estimatedSavings,
			details: { metadataTypes: image.metadataTypes }
		};
	}
	return null;
}
//#endregion
//#region src/core/analyzer.ts
/**
* Analyze a single image file for structural properties, metadata, and issues
*/
async function analyzeImage(file, options = {}) {
	const [meta, hash] = await Promise.all([extractImageMetadata(file.absolutePath), hashFile(file.absolutePath)]);
	const analysis = {
		...file,
		width: meta.width,
		height: meta.height,
		aspectRatio: meta.aspectRatio,
		channels: meta.channels,
		hasAlpha: meta.hasAlpha,
		hasMetadata: meta.hasMetadata,
		metadataTypes: meta.metadataTypes,
		hash,
		issues: [],
		estimatedSavings: 0
	};
	const config = options.config;
	const rules = config?.rules;
	const maxSize = config?.maxSize ? parseBytes(config.maxSize) : config?.budgets?.single ? parseBytes(config.budgets.single) : DEFAULT_MAX_FILE_SIZE;
	const maxDimension = config?.maxDimension || 2560;
	const issues = [];
	if (rules?.oversized !== false) {
		const oversizedIssue = checkOversizedIssue(analysis, maxSize);
		if (oversizedIssue) issues.push(oversizedIssue);
	}
	if (rules?.dimensions !== false) {
		const dimensionIssue = checkDimensionIssue(analysis, maxDimension);
		if (dimensionIssue) issues.push(dimensionIssue);
	}
	if (rules?.metadata !== false) {
		const metadataIssue = checkMetadataIssue(analysis);
		if (metadataIssue) issues.push(metadataIssue);
	}
	analysis.issues = issues;
	return analysis;
}
/**
* Analyze a full collection of discovered images in a project
*/
async function analyzeProject(rootDir, files, options = {}) {
	const startTime = Date.now();
	const config = options.config;
	const rules = config?.rules;
	const CONCURRENCY = 16;
	const analyzedImages = [];
	for (let i = 0; i < files.length; i += CONCURRENCY) {
		const batch = files.slice(i, i + CONCURRENCY);
		const batchResults = await Promise.all(batch.map((f) => analyzeImage(f, options)));
		analyzedImages.push(...batchResults);
	}
	const duplicateGroups = rules?.duplicates !== false ? findDuplicateGroups(analyzedImages.filter((img) => Boolean(img.hash))) : [];
	const duplicateIssues = generateDuplicateIssues(duplicateGroups);
	const possiblyUnused = rules?.unused !== false ? await findPossiblyUnusedImages(rootDir, files, { exclude: config?.exclude }) : [];
	const unusedIssues = generateUnusedIssues(possiblyUnused, files);
	const allIssues = [];
	for (const img of analyzedImages) if (img.issues && img.issues.length > 0) allIssues.push(...img.issues);
	allIssues.push(...duplicateIssues);
	allIssues.push(...unusedIssues);
	const savingsPerFile = /* @__PURE__ */ new Map();
	for (const dup of duplicateGroups) for (let i = 1; i < dup.files.length; i++) {
		const f = dup.files[i];
		if (f) savingsPerFile.set(f, dup.size);
	}
	for (const issue of allIssues) {
		if (issue.type === "duplicate") continue;
		if (issue.potentialSavings && issue.potentialSavings > 0) {
			const current = savingsPerFile.get(issue.file) || 0;
			savingsPerFile.set(issue.file, Math.max(current, issue.potentialSavings));
		}
	}
	let potentialSavings = 0;
	for (const sav of savingsPerFile.values()) potentialSavings += sav;
	let totalSize = 0;
	const formatBreakdown = {};
	for (const img of analyzedImages) {
		totalSize += img.size;
		const fmt = img.format.toUpperCase();
		const existing = formatBreakdown[fmt] || {
			count: 0,
			size: 0
		};
		existing.count += 1;
		existing.size += img.size;
		formatBreakdown[fmt] = existing;
	}
	const budget = checkBudget(analyzedImages, config?.budgets);
	const duration = Date.now() - startTime;
	return {
		rootPath: rootDir,
		images: analyzedImages,
		totalImages: analyzedImages.length,
		totalSize,
		potentialSavings,
		issues: allIssues,
		duplicates: duplicateGroups,
		possiblyUnused,
		formatBreakdown,
		budget,
		scanDurationMs: duration
	};
}
//#endregion
//#region src/core/optimizer.ts
/**
* Configure Sharp transformation pipeline based on options and quality
*/
function buildSharpPipeline(inputPath, targetFormat, quality, options, currentWidth, currentHeight) {
	let pipeline = sharp(inputPath, { failOn: "none" });
	if (options.resize || options.maxWidth || options.maxHeight) {
		const maxWidth = options.maxWidth;
		const maxHeight = options.maxHeight;
		if (maxWidth || maxHeight) pipeline = pipeline.resize({
			width: maxWidth,
			height: maxHeight,
			fit: "inside",
			withoutEnlargement: true
		});
		else if (currentWidth && currentHeight && (currentWidth > 2560 || currentHeight > 2560)) pipeline = pipeline.resize({
			width: 2560,
			height: 2560,
			fit: "inside",
			withoutEnlargement: true
		});
	}
	switch (targetFormat.toLowerCase().replace("jpg", "jpeg")) {
		case "jpeg":
			pipeline = pipeline.jpeg({
				quality,
				mozjpeg: true
			});
			break;
		case "png":
			pipeline = pipeline.png({
				quality: quality < 100 ? quality : void 0,
				compressionLevel: 9,
				effort: 7
			});
			break;
		case "webp":
			pipeline = pipeline.webp({
				quality,
				effort: 6
			});
			break;
		case "avif":
			pipeline = pipeline.avif({
				quality,
				effort: 4
			});
			break;
		default: break;
	}
	if (options.stripMetadata === false) pipeline = pipeline.withMetadata();
	return pipeline;
}
/**
* Optimize image buffer to meet target file size via binary search over compression quality
*/
async function searchOptimalQuality(inputPath, targetFormat, targetSizeBytes, options, width, height) {
	let low = 5;
	let high = 95;
	let bestBuffer = null;
	let bestQuality = 80;
	while (low <= high) {
		const mid = Math.floor((low + high) / 2);
		const buffer = await buildSharpPipeline(inputPath, targetFormat, mid, options, width, height).toBuffer();
		if (buffer.length <= targetSizeBytes) {
			bestBuffer = buffer;
			bestQuality = mid;
			low = mid + 1;
		} else high = mid - 1;
	}
	if (bestBuffer) return {
		buffer: bestBuffer,
		quality: bestQuality,
		targetReached: true
	};
	const fallbackBuffer = await buildSharpPipeline(inputPath, targetFormat, 5, options, width, height).toBuffer();
	return {
		buffer: fallbackBuffer,
		quality: 5,
		targetReached: fallbackBuffer.length <= targetSizeBytes
	};
}
/**
* Safely optimize a single image file
*/
async function optimizeImage(inputPath, options = {}, rootDir) {
	try {
		const originalSize = (await fs.stat(inputPath)).size;
		const metadata = await extractImageMetadata(inputPath);
		const targetFormat = options.format ? options.format.toLowerCase() : path.extname(inputPath).replace(/^\./, "").toLowerCase() || "jpeg";
		let targetSizeBytes;
		if (options.targetSize) targetSizeBytes = parseBytes(options.targetSize);
		let outputBuffer;
		let qualityUsed = options.quality ?? 80;
		let targetReached;
		if (targetSizeBytes) {
			const searchResult = await searchOptimalQuality(inputPath, targetFormat, targetSizeBytes, options, metadata.width, metadata.height);
			outputBuffer = searchResult.buffer;
			qualityUsed = searchResult.quality;
			targetReached = searchResult.targetReached;
		} else outputBuffer = await buildSharpPipeline(inputPath, targetFormat, qualityUsed, options, metadata.width, metadata.height).toBuffer();
		const optimizedSize = outputBuffer.length;
		const savingsBytes = Math.max(0, originalSize - optimizedSize);
		const savingsPercentage = originalSize > 0 ? parseFloat((savingsBytes / originalSize * 100).toFixed(1)) : 0;
		let outputPath;
		if (!options.dryRun) {
			const baseDir = rootDir || path.dirname(inputPath);
			const relative = getRelativePath(baseDir, inputPath);
			const ext = `.${targetFormat.replace("jpeg", "jpg")}`;
			const newFileName = `${path.parse(relative).name}${ext}`;
			const relativeDir = path.dirname(relative);
			if (options.overwrite) outputPath = inputPath;
			else if (options.outputDir) outputPath = path.resolve(options.outputDir, relativeDir, newFileName);
			else outputPath = path.resolve(baseDir, ".imgclean", relativeDir, newFileName);
			await ensureDir(path.dirname(outputPath));
			await fs.writeFile(outputPath, outputBuffer);
		}
		return {
			inputPath: normalizePath(inputPath),
			outputPath: outputPath ? normalizePath(outputPath) : void 0,
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
			success: true
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return {
			inputPath: normalizePath(inputPath),
			originalSize: 0,
			optimizedSize: 0,
			savingsBytes: 0,
			savingsPercentage: 0,
			format: "unknown",
			dryRun: Boolean(options.dryRun),
			success: false,
			error: message
		};
	}
}
/**
* Optimize a batch of image files safely
*/
async function optimizeProject(rootDir, files, options = {}) {
	const results = [];
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
		dryRun: Boolean(options.dryRun)
	};
}
//#endregion
//#region src/cli/output/json.ts
function generateJsonReport(result) {
	const reportData = {
		summary: {
			rootPath: result.rootPath,
			totalImages: result.totalImages,
			totalSize: result.totalSize,
			formattedTotalSize: formatBytes(result.totalSize),
			potentialSavings: result.potentialSavings,
			formattedPotentialSavings: formatBytes(result.potentialSavings),
			scanDurationMs: result.scanDurationMs,
			totalIssues: result.issues.length,
			duplicateGroupsCount: result.duplicates.length,
			possiblyUnusedCount: result.possiblyUnused.length
		},
		budget: result.budget,
		formatBreakdown: result.formatBreakdown,
		issues: result.issues,
		duplicates: result.duplicates,
		possiblyUnused: result.possiblyUnused,
		images: result.images.map((img) => ({
			path: img.path,
			format: img.format,
			size: img.size,
			formattedSize: formatBytes(img.size),
			width: img.width,
			height: img.height,
			aspectRatio: img.aspectRatio,
			channels: img.channels,
			hasAlpha: img.hasAlpha,
			hasMetadata: img.hasMetadata,
			metadataTypes: img.metadataTypes,
			hash: img.hash,
			issues: img.issues
		}))
	};
	return JSON.stringify(reportData, null, 2);
}
//#endregion
//#region src/cli/output/markdown.ts
function generateMarkdownReport(result) {
	const lines = [];
	lines.push("# imgclean Image Health Report\n");
	lines.push(`- **Scanned Directory:** \`${result.rootPath}\``);
	lines.push(`- **Total Images:** ${result.totalImages}`);
	lines.push(`- **Total Image Size:** ${formatBytes(result.totalSize)}`);
	if (result.potentialSavings > 0) lines.push(`- **Potential Savings:** **${formatBytes(result.potentialSavings)}**`);
	lines.push(`- **Scan Duration:** ${result.scanDurationMs}ms\n`);
	if (result.budget) {
		lines.push("## Image Budget");
		lines.push("| Metric | Value | Status |");
		lines.push("| :--- | :--- | :--- |");
		const totalBudgetStr = result.budget.totalBudget ? formatBytes(result.budget.totalBudget) : "N/A";
		lines.push(`| Total Budget | ${formatBytes(result.totalSize)} / ${totalBudgetStr} | ${result.budget.passedTotal ? "✅ Passed" : "❌ Exceeded"} |`);
		if (result.budget.singleBudget) lines.push(`| Single File Budget | Max ${formatBytes(result.budget.singleBudget)} | ${result.budget.passedSingle ? "✅ Passed" : "❌ Exceeded"} |`);
		lines.push("");
	}
	const formatEntries = Object.entries(result.formatBreakdown);
	if (formatEntries.length > 0) {
		lines.push("## Format Breakdown");
		lines.push("| Format | File Count | Total Size | % of Total |");
		lines.push("| :--- | :--- | :--- | :--- |");
		for (const [fmt, stat] of formatEntries) {
			const pct = result.totalSize > 0 ? (stat.size / result.totalSize * 100).toFixed(1) : "0.0";
			lines.push(`| **${fmt}** | ${stat.count} | ${formatBytes(stat.size)} | ${pct}% |`);
		}
		lines.push("");
	}
	if (result.issues.length > 0) {
		lines.push("## Detected Issues");
		lines.push("| File | Type | Severity | Message | Potential Savings |");
		lines.push("| :--- | :--- | :--- | :--- | :--- |");
		for (const issue of result.issues) {
			const savings = issue.potentialSavings ? formatBytes(issue.potentialSavings) : "-";
			lines.push(`| \`${issue.file}\` | \`${issue.type}\` | ${issue.severity} | ${issue.message} | ${savings} |`);
		}
		lines.push("");
	}
	if (result.duplicates.length > 0) {
		lines.push("## Exact Duplicates (SHA-256)");
		for (const group of result.duplicates) {
			lines.push(`- **Potential Savings:** ${formatBytes(group.potentialSavings)} (${group.files.length} copies)`);
			for (const f of group.files) lines.push(`  - \`${f}\``);
		}
		lines.push("");
	}
	if (result.possiblyUnused.length > 0) {
		lines.push("## Possibly Unused Images");
		lines.push("> ℹ️ *These images were not found in static code references. Verify before removing.*");
		for (const unused of result.possiblyUnused) lines.push(`- \`${unused}\``);
		lines.push("");
	}
	if (result.images.length > 0) {
		const sorted = [...result.images].sort((a, b) => b.size - a.size).slice(0, 10);
		lines.push("## Largest Images");
		lines.push("| File | Format | Dimensions | Size |");
		lines.push("| :--- | :--- | :--- | :--- |");
		for (const img of sorted) {
			const dims = img.width && img.height ? `${img.width}×${img.height}` : "-";
			lines.push(`| \`${img.path}\` | ${img.format.toUpperCase()} | ${dims} | ${formatBytes(img.size)} |`);
		}
		lines.push("");
	}
	lines.push("---\n*Generated by [imgclean](https://github.com/rajank18/imgclean)*");
	return lines.join("\n");
}
//#endregion
//#region src/cli/output/html.ts
function generateHtmlReport(result) {
	const formatEntries = Object.entries(result.formatBreakdown);
	const totalIssues = result.issues.length;
	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>imgclean Report · Image Health & Optimization</title>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --border: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #38bdf8;
      --accent-grad: linear-gradient(135deg, #38bdf8 0%, #818cf8 100%);
      --green: #22c55e;
      --yellow: #eab308;
      --red: #ef4444;
      --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: var(--font);
      line-height: 1.5;
      padding: 2rem 1rem;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    header {
      margin-bottom: 2rem;
      border-bottom: 1px solid var(--border);
      padding-bottom: 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .brand h1 {
      font-size: 2rem;
      font-weight: 800;
      background: var(--accent-grad);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      letter-spacing: -0.025em;
    }
    .brand p {
      color: var(--text-muted);
      font-size: 0.95rem;
      margin-top: 0.25rem;
    }
    .meta-badge {
      background: var(--card-bg);
      border: 1px solid var(--border);
      padding: 0.5rem 1rem;
      border-radius: 9999px;
      font-size: 0.85rem;
      color: var(--text-muted);
    }
    .grid-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .stat-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem;
    }
    .stat-label {
      font-size: 0.85rem;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--text-muted);
      letter-spacing: 0.05em;
    }
    .stat-value {
      font-size: 1.85rem;
      font-weight: 700;
      margin-top: 0.25rem;
    }
    .stat-value.savings { color: var(--green); }
    .stat-value.issues { color: var(--yellow); }

    .section-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 2rem;
    }
    .section-title {
      font-size: 1.25rem;
      font-weight: 700;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .table-container {
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.9rem;
    }
    th {
      background: #0f172a80;
      color: var(--text-muted);
      font-weight: 600;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--border);
    }
    td {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--border);
    }
    tr:hover td {
      background: #33415533;
    }
    .badge {
      display: inline-block;
      padding: 0.2rem 0.6rem;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge-oversized { background: #713f12; color: #fef08a; }
    .badge-dimensions { background: #1e3a8a; color: #bfdbfe; }
    .badge-duplicate { background: #581c87; color: #e9d5ff; }
    .badge-metadata { background: #134e4a; color: #99f6e4; }
    .badge-unused { background: #374151; color: #d1d5db; }

    .format-bar-container {
      display: flex;
      height: 12px;
      border-radius: 6px;
      overflow: hidden;
      margin-bottom: 1rem;
      background: #334155;
    }
    .format-slice { height: 100%; }
    .format-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 0.75rem;
    }
    .format-item {
      display: flex;
      justify-content: space-between;
      padding: 0.5rem 0.75rem;
      background: #0f172a66;
      border-radius: 8px;
      font-size: 0.85rem;
    }
    footer {
      text-align: center;
      color: var(--text-muted);
      font-size: 0.85rem;
      margin-top: 3rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border);
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="brand">
        <h1>imgclean Report</h1>
        <p>Target: <code>${result.rootPath}</code></p>
      </div>
      <div class="meta-badge">
        Scan Time: ${result.scanDurationMs}ms · Generated ${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}
      </div>
    </header>

    <!-- Overview Stats -->
    <div class="grid-stats">
      <div class="stat-card">
        <div class="stat-label">Total Images</div>
        <div class="stat-value">${result.totalImages}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Size</div>
        <div class="stat-value">${formatBytes(result.totalSize)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Potential Savings</div>
        <div class="stat-value savings">${formatBytes(result.potentialSavings)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Issues Detected</div>
        <div class="stat-value issues">${totalIssues}</div>
      </div>
    </div>

    <!-- Format Breakdown -->
    <div class="section-card">
      <div class="section-title">Format Breakdown</div>
      <div class="format-grid">
        ${formatEntries.map(([fmt, stat]) => `
          <div class="format-item">
            <span><strong>${fmt}</strong> (${stat.count})</span>
            <span>${formatBytes(stat.size)}</span>
          </div>`).join("")}
      </div>
    </div>

    <!-- Issues Section -->
    ${result.issues.length > 0 ? `
    <div class="section-card">
      <div class="section-title">Detected Issues (${result.issues.length})</div>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>File</th>
              <th>Details</th>
              <th>Potential Savings</th>
            </tr>
          </thead>
          <tbody>
            ${result.issues.map((issue) => `
              <tr>
                <td><span class="badge badge-${issue.type}">${issue.type}</span></td>
                <td><code>${issue.file}</code></td>
                <td>${issue.message}</td>
                <td>${issue.potentialSavings ? formatBytes(issue.potentialSavings) : "-"}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>` : ""}

    <!-- Duplicates Section -->
    ${result.duplicates.length > 0 ? `
    <div class="section-card">
      <div class="section-title">Exact Duplicate Groups (${result.duplicates.length})</div>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Copies</th>
              <th>Individual Size</th>
              <th>Potential Savings</th>
              <th>Files</th>
            </tr>
          </thead>
          <tbody>
            ${result.duplicates.map((group) => `
              <tr>
                <td>${group.files.length}</td>
                <td>${formatBytes(group.size)}</td>
                <td><strong style="color: var(--green)">${formatBytes(group.potentialSavings)}</strong></td>
                <td>${group.files.map((f) => `<code>${f}</code>`).join("<br/>")}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>` : ""}

    <!-- All Images Table -->
    <div class="section-card">
      <div class="section-title">All Scanned Images (${result.images.length})</div>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>File</th>
              <th>Format</th>
              <th>Dimensions</th>
              <th>Size</th>
              <th>Issues</th>
            </tr>
          </thead>
          <tbody>
            ${result.images.map((img) => {
		const dims = img.width && img.height ? `${img.width} × ${img.height}` : "-";
		const issues = img.issues && img.issues.length > 0 ? img.issues.map((i) => `<span class="badge badge-${i.type}">${i.type}</span>`).join(" ") : "<span style=\"color: var(--green)\">✓ Clean</span>";
		return `
              <tr>
                <td><code>${img.path}</code></td>
                <td>${img.format.toUpperCase()}</td>
                <td>${dims}</td>
                <td>${formatBytes(img.size)}</td>
                <td>${issues}</td>
              </tr>`;
	}).join("")}
          </tbody>
        </table>
      </div>
    </div>

    <footer>
      Generated with <strong>imgclean</strong> · Image Health and Cleanup Tool
    </footer>
  </div>
</body>
</html>`;
}
//#endregion
//#region src/cli/output/terminal.ts
/**
* Render standard polished terminal output for scan results
*/
function renderTerminalOutput(result, options = {}) {
	const lines = [];
	lines.push("");
	lines.push(chalk.green(`✓ ${result.totalImages} images scanned\n`));
	lines.push(chalk.bold("IMAGE SIZE"));
	lines.push("─".repeat(28));
	lines.push(`Total             ${formatBytes(result.totalSize).padStart(10, " ")}`);
	if (result.potentialSavings > 0) lines.push(`Potential savings ${chalk.green(formatBytes(result.potentialSavings).padStart(10, " "))}`);
	const issueCounts = {
		oversized: 0,
		dimensions: 0,
		duplicate: 0,
		metadata: 0,
		unused: 0
	};
	for (const issue of result.issues) if (issue.type in issueCounts) issueCounts[issue.type] = (issueCounts[issue.type] || 0) + 1;
	const totalIssuesCount = result.issues.length;
	if (totalIssuesCount > 0) {
		lines.push("");
		lines.push(chalk.bold("ISSUES"));
		lines.push("─".repeat(28));
		if (issueCounts.oversized && issueCounts.oversized > 0) lines.push(`${chalk.yellow("⚠")} Oversized          ${String(issueCounts.oversized).padStart(8, " ")}`);
		if (issueCounts.dimensions && issueCounts.dimensions > 0) lines.push(`${chalk.yellow("⚠")} Large dimensions   ${String(issueCounts.dimensions).padStart(8, " ")}`);
		if (issueCounts.duplicate && issueCounts.duplicate > 0) lines.push(`${chalk.yellow("⚠")} Duplicates         ${String(issueCounts.duplicate).padStart(8, " ")}`);
		if (issueCounts.metadata && issueCounts.metadata > 0) lines.push(`${chalk.yellow("⚠")} Metadata           ${String(issueCounts.metadata).padStart(8, " ")}`);
		if (issueCounts.unused && issueCounts.unused > 0) lines.push(`${chalk.yellow("⚠")} Possibly unused    ${String(issueCounts.unused).padStart(8, " ")}`);
	}
	if (result.images.length > 0) {
		const topFiles = [...result.images].sort((a, b) => b.size - a.size).slice(0, 5);
		lines.push("");
		lines.push(chalk.bold("LARGEST FILES"));
		lines.push("─".repeat(28));
		for (const img of topFiles) {
			const displayPath = img.path.length > 20 ? "..." + img.path.slice(-17) : img.path;
			lines.push(`${displayPath.padEnd(20, " ")} ${formatBytes(img.size).padStart(7, " ")}`);
		}
	}
	const formatEntries = Object.entries(result.formatBreakdown);
	if (formatEntries.length > 0) {
		lines.push("");
		lines.push(chalk.bold("FORMAT BREAKDOWN"));
		lines.push("─".repeat(28));
		for (const [format, stat] of formatEntries) lines.push(`${format.padEnd(16, " ")}  ${formatBytes(stat.size).padStart(10, " ")}`);
	}
	if (result.budget) {
		lines.push("");
		lines.push(chalk.bold("BUDGET"));
		lines.push("─".repeat(28));
		const budgetStr = `${formatBytes(result.totalSize)} / ${formatBytes(result.budget.totalBudget || 0)}`;
		const statusIcon = result.budget.passed ? chalk.green("✓") : chalk.red("✗");
		lines.push(`${budgetStr.padEnd(22, " ")} ${statusIcon}`);
	}
	if (options.verbose && result.issues.length > 0) {
		lines.push("");
		lines.push(chalk.bold("DETAILED FINDINGS"));
		lines.push("─".repeat(40));
		for (const issue of result.issues) {
			const typeLabel = `[${issue.type.toUpperCase()}]`.padEnd(14, " ");
			lines.push(`${chalk.yellow(typeLabel)} ${chalk.cyan(issue.file)}`);
			lines.push(`               ${issue.message}`);
		}
	}
	if (result.potentialSavings > 0 || totalIssuesCount > 0) {
		lines.push("");
		lines.push(chalk.dim("Run `imgclean fix` to optimize images."));
	}
	return lines.join("\n");
}
//#endregion
export { findConfigFile as A, hashFile as C, isSupportedImageExtension as D, inferFormatFromExtension as E, normalizePath as F, resolvePath as I, SUPPORTED_EXTENSIONS as L, loadJsonFile as M, pathExists as N, scanImageFiles as O, getRelativePath as P, hashBuffer as S, DEFAULT_EXCLUDE_PATTERNS as T, generateUnusedIssues as _, optimizeImage as a, formatBytes as b, analyzeProject as c, checkDimensionIssue as d, checkMetadataIssue as f, findPossiblyUnusedImages as g, SOURCE_EXTENSIONS as h, generateJsonReport as i, isDirectory as j, ensureDir as k, DEFAULT_MAX_DIMENSION as l, checkBudget as m, generateHtmlReport as n, optimizeProject as o, checkOversizedIssue as p, generateMarkdownReport as r, analyzeImage as s, renderTerminalOutput as t, DEFAULT_MAX_FILE_SIZE as u, findDuplicateGroups as v, extractImageMetadata as w, parseBytes as x, generateDuplicateIssues as y };

//# sourceMappingURL=terminal-CsKMqhJo.mjs.map