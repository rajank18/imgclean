#!/usr/bin/env node
import { D as pathExists, E as loadJsonFile, S as scanImageFiles, m as formatBytes, n as analyzeProject, w as findConfigFile } from "../analyzer-DiQkalZP.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import chalk from "chalk";
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
//#region src/cli/commands/scan.ts
async function scanCommand(targetPath, options = {}) {
	const target = targetPath || ".";
	const resolvedTarget = path.resolve(process.cwd(), target);
	const configPath = await findConfigFile(process.cwd(), options.config);
	const config = configPath ? await loadJsonFile(configPath) : null;
	if (options.verbose && !options.json) {
		console.log(chalk.gray(`Target: ${resolvedTarget}`));
		if (configPath) console.log(chalk.gray(`Config: ${configPath}`));
	}
	if (!options.json) {
		console.log(chalk.cyan.bold("\nimgclean"));
		console.log(chalk.gray(`Scanning ${target}...`));
	}
	const { rootDir, files } = await scanImageFiles(resolvedTarget, {
		include: config?.include,
		exclude: config?.exclude
	});
	const result = await analyzeProject(rootDir, files, { config });
	if (options.json) {
		console.log(JSON.stringify(result, null, 2));
		return result;
	}
	const output = renderTerminalOutput(result, { verbose: options.verbose });
	console.log(output);
	return result;
}
//#endregion
//#region src/cli/commands/fix.ts
async function fixCommand(_targetPath, _options = {}) {
	console.log(chalk.yellow("imgclean fix will be available in Phase 4."));
}
//#endregion
//#region src/cli/commands/ci.ts
async function ciCommand(options = {}) {
	const rootDir = process.cwd();
	const configPath = await findConfigFile(rootDir, options.config);
	if (!configPath) {
		if (options.json) console.log(JSON.stringify({
			status: "error",
			message: "No imgclean configuration file found. Run `imgclean init` to create one."
		}));
		else {
			console.error(chalk.red("\n✗ Error: No imgclean configuration file found."));
			console.error(chalk.gray("Run `imgclean init` to create a default configuration.\n"));
		}
		process.exit(1);
	}
	const config = await loadJsonFile(configPath);
	const { files } = await scanImageFiles(rootDir, {
		include: config?.include,
		exclude: config?.exclude
	});
	const result = await analyzeProject(rootDir, files, { config });
	const budget = result.budget;
	if (!budget) {
		if (options.json) console.log(JSON.stringify({
			status: "passed",
			message: "No budgets defined in configuration.",
			result
		}));
		else {
			console.log(chalk.yellow("\n⚠ No budgets configured in imgclean.config.json"));
			console.log(chalk.gray("All checks passed by default.\n"));
		}
		process.exit(0);
	}
	const isPassed = budget.passed;
	if (options.json) {
		console.log(JSON.stringify({
			passed: isPassed,
			budget,
			totalSize: result.totalSize,
			totalImages: result.totalImages
		}, null, 2));
		process.exit(isPassed ? 0 : 1);
	}
	console.log(chalk.bold("\nIMAGE BUDGET"));
	console.log("─".repeat(30));
	console.log(`Current: ${formatBytes(result.totalSize)}`);
	if (budget.totalBudget) console.log(`Budget:  ${formatBytes(budget.totalBudget)}`);
	if (budget.singleBudget) console.log(`Per-file max: ${formatBytes(budget.singleBudget)}`);
	console.log("");
	if (!budget.passedTotal && budget.totalBudget) {
		const excess = result.totalSize - budget.totalBudget;
		console.log(chalk.red(`✗ Total budget exceeded by ${formatBytes(excess)}`));
	}
	if (!budget.passedSingle && budget.exceededSingleFiles.length > 0) {
		console.log(chalk.red(`✗ ${budget.exceededSingleFiles.length} file(s) exceeded single image budget:`));
		for (const item of budget.exceededSingleFiles) console.log(chalk.red(`  - ${item.file}: ${formatBytes(item.size)} > ${formatBytes(item.budget)}`));
	}
	if (isPassed) {
		console.log(chalk.green("✓ Image budget passed\n"));
		process.exit(0);
	} else {
		console.log(chalk.red("\n✗ Image budget check failed\n"));
		process.exit(1);
	}
}
//#endregion
//#region src/cli/commands/init.ts
const DEFAULT_CONFIG_TEMPLATE = {
	include: ["public/**/*", "src/assets/**/*"],
	exclude: [
		"node_modules",
		".git",
		".next",
		"dist",
		"build"
	],
	budgets: {
		total: "10mb",
		single: "500kb"
	},
	rules: {
		oversized: true,
		dimensions: true,
		duplicates: true,
		unused: true,
		metadata: true
	}
};
async function initCommand(targetDir = process.cwd()) {
	const configPath = path.join(targetDir, "imgclean.config.json");
	if (pathExists(configPath)) {
		console.log(chalk.yellow(`\n⚠ Configuration file already exists at: ${configPath}`));
		return;
	}
	const content = JSON.stringify(DEFAULT_CONFIG_TEMPLATE, null, 2) + "\n";
	await fs.writeFile(configPath, content, "utf-8");
	console.log(chalk.green(`\n✓ Created imgclean.config.json`));
	console.log(chalk.gray(`You can now run 'imgclean scan' or 'imgclean ci' to enforce image budgets.\n`));
}
//#endregion
//#region src/cli/index.ts
const program = new Command();
program.name("imgclean").description("Project-level image health and cleanup tool for web projects").version("0.1.0");
program.command("scan", { isDefault: true }).description("Scan project images, detect bloat and issues").argument("[path]", "Path to project directory or image file", ".").option("-v, --verbose", "Show detailed output for each image").option("--json", "Output scan results as JSON to stdout").option("--report <format>", "Generate report file (html, json, md)").option("-o, --output <path>", "Custom path for the generated report").option("-c, --config <path>", "Path to custom imgclean config file").action(async (targetPath, options) => {
	try {
		await scanCommand(targetPath, options);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error(`Error: ${message}`);
		process.exit(1);
	}
});
program.command("fix").description("Safely optimize and clean images").argument("[path]", "Path to project directory or image file", ".").option("--dry-run", "Simulate optimization without writing files").option("--compress", "Compress images").option("--quality <number>", "Compression quality (1-100)").option("--format <format>", "Convert images to format (webp, avif, png, jpeg)").option("--resize", "Resize oversized images").option("--max-width <number>", "Maximum width in pixels").option("--max-height <number>", "Maximum height in pixels").option("--target-size <size>", "Optimize to target size (e.g. 300kb)").option("--strip-metadata", "Remove EXIF/metadata from images").option("-c, --config <path>", "Path to custom imgclean config file").action(async (targetPath, options) => {
	try {
		await fixCommand(targetPath, options);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error(`Error: ${message}`);
		process.exit(1);
	}
});
program.command("ci").description("Enforce image budgets in CI environments").option("-c, --config <path>", "Path to custom imgclean config file").option("--json", "Output CI results as JSON").action(async (options) => {
	try {
		await ciCommand(options);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error(`Error: ${message}`);
		process.exit(1);
	}
});
program.command("init").description("Create an imgclean.config.json configuration file").action(async () => {
	try {
		await initCommand();
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error(`Error: ${message}`);
		process.exit(1);
	}
});
program.parse(process.argv);
//#endregion
export {};

//# sourceMappingURL=index.mjs.map