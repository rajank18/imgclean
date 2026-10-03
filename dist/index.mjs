import { A as isSupportedImageExtension, B as SUPPORTED_EXTENSIONS, C as formatBytes, D as extractImageMetadata, E as hashFile, F as loadJsonFile, I as pathExists, L as getRelativePath, M as ensureDir, N as findConfigFile, O as DEFAULT_EXCLUDE_PATTERNS, P as isDirectory, R as normalizePath, S as generateDuplicateIssues, T as hashBuffer, _ as checkBudget, a as generateHtmlReport, b as generateUnusedIssues, c as optimizeImage, d as analyzeProject, f as DEFAULT_MAX_DIMENSION, g as checkOversizedIssue, h as checkMetadataIssue, i as renderTerminalOutput, j as scanImageFiles, k as inferFormatFromExtension, l as optimizeProject, m as checkDimensionIssue, n as convertProjectOrFile, o as generateMarkdownReport, p as DEFAULT_MAX_FILE_SIZE, r as normalizeTargetFormat, s as generateJsonReport, t as convertImage, u as analyzeImage, v as SOURCE_EXTENSIONS, w as parseBytes, x as findDuplicateGroups, y as findPossiblyUnusedImages, z as resolvePath } from "./converter-CESpwYRI.mjs";
//#region src/index.ts
/**
* Scan and analyze a project directory for image health, bloat, issues, duplicates, and unused assets
*/
async function scanProject(targetPath = process.cwd(), config) {
	const { rootDir, files } = await scanImageFiles(targetPath, {
		include: config?.include,
		exclude: config?.exclude
	});
	return analyzeProject(rootDir, files, { config });
}
//#endregion
export { DEFAULT_EXCLUDE_PATTERNS, DEFAULT_MAX_DIMENSION, DEFAULT_MAX_FILE_SIZE, SOURCE_EXTENSIONS, SUPPORTED_EXTENSIONS, analyzeImage, analyzeProject, checkBudget, checkDimensionIssue, checkMetadataIssue, checkOversizedIssue, convertImage, convertProjectOrFile, ensureDir, extractImageMetadata, findConfigFile, findDuplicateGroups, findPossiblyUnusedImages, formatBytes, generateDuplicateIssues, generateHtmlReport, generateJsonReport, generateMarkdownReport, generateUnusedIssues, getRelativePath, hashBuffer, hashFile, inferFormatFromExtension, isDirectory, isSupportedImageExtension, loadJsonFile, normalizePath, normalizeTargetFormat, optimizeImage, optimizeProject, parseBytes, pathExists, renderTerminalOutput, resolvePath, scanImageFiles, scanProject };

//# sourceMappingURL=index.mjs.map