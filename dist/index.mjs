import { A as getRelativePath, C as isSupportedImageExtension, D as isDirectory, E as findConfigFile, M as resolvePath, N as SUPPORTED_EXTENSIONS, O as loadJsonFile, S as inferFormatFromExtension, T as ensureDir, _ as parseBytes, a as DEFAULT_MAX_DIMENSION, b as extractImageMetadata, c as checkMetadataIssue, d as SOURCE_EXTENSIONS, f as findPossiblyUnusedImages, g as formatBytes, h as generateDuplicateIssues, i as analyzeProject, j as normalizePath, k as pathExists, l as checkOversizedIssue, m as findDuplicateGroups, n as optimizeProject, o as DEFAULT_MAX_FILE_SIZE, p as generateUnusedIssues, r as analyzeImage, s as checkDimensionIssue, t as optimizeImage, u as checkBudget, v as hashBuffer, w as scanImageFiles, x as DEFAULT_EXCLUDE_PATTERNS, y as hashFile } from "./optimizer-BD393IIm.mjs";
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
export { DEFAULT_EXCLUDE_PATTERNS, DEFAULT_MAX_DIMENSION, DEFAULT_MAX_FILE_SIZE, SOURCE_EXTENSIONS, SUPPORTED_EXTENSIONS, analyzeImage, analyzeProject, checkBudget, checkDimensionIssue, checkMetadataIssue, checkOversizedIssue, ensureDir, extractImageMetadata, findConfigFile, findDuplicateGroups, findPossiblyUnusedImages, formatBytes, generateDuplicateIssues, generateUnusedIssues, getRelativePath, hashBuffer, hashFile, inferFormatFromExtension, isDirectory, isSupportedImageExtension, loadJsonFile, normalizePath, optimizeImage, optimizeProject, parseBytes, pathExists, resolvePath, scanImageFiles, scanProject };

//# sourceMappingURL=index.mjs.map