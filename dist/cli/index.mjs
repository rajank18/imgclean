#!/usr/bin/env node
import { A as findConfigFile, M as loadJsonFile, N as pathExists, O as scanImageFiles, b as formatBytes, c as analyzeProject, i as generateJsonReport, k as ensureDir, n as generateHtmlReport, o as optimizeProject, r as generateMarkdownReport, t as renderTerminalOutput } from "../terminal-Q04uGUSL.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
//#region src/cli/commands/scan.ts
async function scanCommand(targetPath, options = {}) {
	const target = targetPath || ".";
	const resolvedTarget = path.resolve(process.cwd(), target);
	const configPath = await findConfigFile(process.cwd(), options.config);
	const config = configPath ? await loadJsonFile(configPath) : null;
	if (options.verbose && !options.json && !options.report) {
		console.log(chalk.gray(`Target: ${resolvedTarget}`));
		if (configPath) console.log(chalk.gray(`Config: ${configPath}`));
	}
	if (!options.json && !options.report) {
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
	if (options.report) {
		const reportType = String(options.report).toLowerCase();
		let content = "";
		let defaultFilename = "";
		switch (reportType) {
			case "html":
				content = generateHtmlReport(result);
				defaultFilename = "imgclean-report.html";
				break;
			case "json":
				content = generateJsonReport(result);
				defaultFilename = "imgclean-report.json";
				break;
			case "md":
			case "markdown":
				content = generateMarkdownReport(result);
				defaultFilename = "imgclean-report.md";
				break;
			default: throw new Error(`Unsupported report format: "${reportType}". Supported formats: html, json, md`);
		}
		const outputPath = options.output ? path.resolve(process.cwd(), options.output) : path.resolve(process.cwd(), defaultFilename);
		await ensureDir(path.dirname(outputPath));
		await fs.writeFile(outputPath, content, "utf-8");
		console.log(chalk.green(`\n✓ ${reportType.toUpperCase()} report generated: ${path.relative(process.cwd(), outputPath)}`));
		return result;
	}
	const output = renderTerminalOutput(result, { verbose: options.verbose });
	console.log(output);
	return result;
}
//#endregion
//#region src/cli/commands/fix.ts
async function fixCommand(targetPath, options = {}) {
	const target = targetPath || ".";
	const resolvedTarget = path.resolve(process.cwd(), target);
	const configPath = await findConfigFile(process.cwd(), options.config);
	const config = configPath ? await loadJsonFile(configPath) : null;
	console.log(chalk.cyan.bold("\nimgclean fix"));
	if (options.dryRun) console.log(chalk.yellow("[DRY RUN] No files will be modified or created.\n"));
	const { rootDir, files } = await scanImageFiles(resolvedTarget, {
		include: config?.include,
		exclude: config?.exclude
	});
	if (files.length === 0) {
		console.log(chalk.gray(`No images found in ${target}`));
		return;
	}
	console.log(chalk.gray(`Optimizing ${files.length} image(s)...`));
	const outcome = await optimizeProject(rootDir, files, {
		...options,
		outputDir: options.output || options.outputDir,
		quality: options.quality ? Number(options.quality) : void 0,
		maxWidth: options.maxWidth ? Number(options.maxWidth) : void 0,
		maxHeight: options.maxHeight ? Number(options.maxHeight) : void 0
	});
	console.log(chalk.green(`\n✓ ${outcome.results.filter((r) => r.success).length} image(s) processed\n`));
	console.log(chalk.bold("OPTIMIZATION SUMMARY"));
	console.log("─".repeat(40));
	console.log(`Original size:   ${formatBytes(outcome.totalOriginalSize).padStart(10, " ")}`);
	console.log(`Optimized size:  ${formatBytes(outcome.totalOptimizedSize).padStart(10, " ")}`);
	console.log(`Total savings:   ${chalk.green(formatBytes(outcome.totalSavings).padStart(10, " "))}`);
	const successfulResults = outcome.results.filter((r) => r.success);
	if (successfulResults.length > 0) {
		console.log(chalk.bold("\nPROCESSED FILES"));
		console.log("─".repeat(40));
		for (const res of successfulResults.slice(0, 10)) {
			const rel = path.basename(res.inputPath);
			const diff = `${formatBytes(res.originalSize)} → ${formatBytes(res.optimizedSize)} (-${res.savingsPercentage}%)`;
			console.log(`- ${rel.padEnd(20, " ")} ${diff}`);
		}
		if (successfulResults.length > 10) console.log(chalk.gray(`...and ${successfulResults.length - 10} more files`));
	}
	if (!options.dryRun && outcome.results.some((r) => r.outputPath)) {
		const firstOutput = outcome.results.find((r) => r.outputPath)?.outputPath;
		const outputLocation = firstOutput ? path.dirname(firstOutput) : ".imgclean";
		console.log(chalk.blue(`\n📁 Optimized images safely saved to: ${outputLocation}`));
		console.log(chalk.gray(`Original files were preserved.`));
	}
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
program.name("imgclean").description("Project-level image health and cleanup tool for web projects").version("0.1.0").showHelpAfterError("\n(run \"imgclean --help\" to see all available commands and options)");
program.command("scan").description("Scan project images, detect bloat and issues").argument("[path]", "Path to project directory or image file", ".").option("-v, --verbose", "Show detailed output for each image").option("--json", "Output scan results as JSON to stdout").option("--report <format>", "Generate report file (html, json, md)").option("-o, --output <path>", "Custom path for the generated report").option("-c, --config <path>", "Path to custom imgclean config file").action(async (targetPath, options) => {
	try {
		await scanCommand(targetPath, options);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error(`Error: ${message}`);
		process.exit(1);
	}
});
program.command("fix").description("Safely optimize and clean images").argument("[path]", "Path to project directory or image file", ".").option("--dry-run", "Simulate optimization without writing files").option("--compress", "Compress images").option("--quality <number>", "Compression quality (1-100)").option("--format <format>", "Convert images to format (webp, avif, png, jpeg)").option("--resize", "Resize oversized images").option("--max-width <number>", "Maximum width in pixels").option("--max-height <number>", "Maximum height in pixels").option("--target-size <size>", "Optimize to target size (e.g. 300kb)").option("--strip-metadata", "Remove EXIF/metadata from images").option("--overwrite", "Replace original images in-place (no code changes needed)").option("-o, --output <dir>", "Custom output destination directory").option("-c, --config <path>", "Path to custom imgclean config file").action(async (targetPath, options) => {
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
if (process.argv.length <= 2) program.help();
program.parse(process.argv);
//#endregion
export {};

//# sourceMappingURL=index.mjs.map