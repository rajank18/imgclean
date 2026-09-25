import { A as findConfigFile, C as hashFile, D as isSupportedImageExtension, E as inferFormatFromExtension, F as normalizePath, I as resolvePath, L as SUPPORTED_EXTENSIONS, M as loadJsonFile, N as pathExists, O as scanImageFiles, P as getRelativePath, S as hashBuffer, T as DEFAULT_EXCLUDE_PATTERNS, _ as generateUnusedIssues, a as optimizeImage, b as formatBytes, c as analyzeProject, d as checkDimensionIssue, f as checkMetadataIssue, g as findPossiblyUnusedImages, h as SOURCE_EXTENSIONS, i as generateJsonReport, j as isDirectory, k as ensureDir, l as DEFAULT_MAX_DIMENSION, m as checkBudget, n as generateHtmlReport, o as optimizeProject, p as checkOversizedIssue, r as generateMarkdownReport, s as analyzeImage, t as renderTerminalOutput, u as DEFAULT_MAX_FILE_SIZE, v as findDuplicateGroups, w as extractImageMetadata, x as parseBytes, y as generateDuplicateIssues } from "./terminal-Q04uGUSL.mjs";
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
export { DEFAULT_EXCLUDE_PATTERNS, DEFAULT_MAX_DIMENSION, DEFAULT_MAX_FILE_SIZE, SOURCE_EXTENSIONS, SUPPORTED_EXTENSIONS, analyzeImage, analyzeProject, checkBudget, checkDimensionIssue, checkMetadataIssue, checkOversizedIssue, ensureDir, extractImageMetadata, findConfigFile, findDuplicateGroups, findPossiblyUnusedImages, formatBytes, generateDuplicateIssues, generateHtmlReport, generateJsonReport, generateMarkdownReport, generateUnusedIssues, getRelativePath, hashBuffer, hashFile, inferFormatFromExtension, isDirectory, isSupportedImageExtension, loadJsonFile, normalizePath, optimizeImage, optimizeProject, parseBytes, pathExists, renderTerminalOutput, resolvePath, scanImageFiles, scanProject };

//# sourceMappingURL=index.mjs.map