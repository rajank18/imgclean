import { A as resolvePath, C as ensureDir, D as pathExists, E as loadJsonFile, O as getRelativePath, S as scanImageFiles, T as isDirectory, _ as hashFile, a as checkDimensionIssue, b as inferFormatFromExtension, c as checkBudget, d as generateUnusedIssues, f as findDuplicateGroups, g as hashBuffer, h as parseBytes, i as DEFAULT_MAX_FILE_SIZE, j as SUPPORTED_EXTENSIONS, k as normalizePath, l as SOURCE_EXTENSIONS, m as formatBytes, n as analyzeProject, o as checkMetadataIssue, p as generateDuplicateIssues, r as DEFAULT_MAX_DIMENSION, s as checkOversizedIssue, t as analyzeImage, u as findPossiblyUnusedImages, v as extractImageMetadata, w as findConfigFile, x as isSupportedImageExtension, y as DEFAULT_EXCLUDE_PATTERNS } from "./analyzer-DiQkalZP.mjs";
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
export { DEFAULT_EXCLUDE_PATTERNS, DEFAULT_MAX_DIMENSION, DEFAULT_MAX_FILE_SIZE, SOURCE_EXTENSIONS, SUPPORTED_EXTENSIONS, analyzeImage, analyzeProject, checkBudget, checkDimensionIssue, checkMetadataIssue, checkOversizedIssue, ensureDir, extractImageMetadata, findConfigFile, findDuplicateGroups, findPossiblyUnusedImages, formatBytes, generateDuplicateIssues, generateUnusedIssues, getRelativePath, hashBuffer, hashFile, inferFormatFromExtension, isDirectory, isSupportedImageExtension, loadJsonFile, normalizePath, parseBytes, pathExists, resolvePath, scanImageFiles, scanProject };

//# sourceMappingURL=index.mjs.map