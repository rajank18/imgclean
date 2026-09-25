import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
import { scanImageFiles } from '../../core/scanner.js';
import { analyzeProject } from '../../core/analyzer.js';
import { renderTerminalOutput } from '../output/terminal.js';
import { generateJsonReport } from '../output/json.js';
import { generateMarkdownReport } from '../output/markdown.js';
import { generateHtmlReport } from '../output/html.js';
import { findConfigFile, loadJsonFile, ensureDir } from '../../utils/files.js';
import type { ImgCleanConfig, ScanCliOptions, ScanResult } from '../../types/index.js';

export async function scanCommand(
  targetPath?: string,
  options: ScanCliOptions = {}
): Promise<ScanResult> {
  const target = targetPath || '.';
  const resolvedTarget = path.resolve(process.cwd(), target);

  // Load config if present
  const configPath = await findConfigFile(process.cwd(), options.config);
  const config = configPath ? await loadJsonFile<ImgCleanConfig>(configPath) : null;

  if (options.verbose && !options.json && !options.report) {
    console.log(chalk.gray(`Target: ${resolvedTarget}`));
    if (configPath) {
      console.log(chalk.gray(`Config: ${configPath}`));
    }
  }

  if (!options.json && !options.report) {
    console.log(chalk.cyan.bold('\nimgclean'));
    console.log(chalk.gray(`Scanning ${target}...`));
  }

  // 1. Filesystem scan
  const { rootDir, files } = await scanImageFiles(resolvedTarget, {
    include: config?.include,
    exclude: config?.exclude,
  });

  // 2. Image analysis
  const result = await analyzeProject(rootDir, files, { config });

  // 3. Handle JSON output to stdout
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  // 4. Handle Report File Export (--report=html | json | md)
  if (options.report) {
    const reportType = String(options.report).toLowerCase();
    let content = '';
    let defaultFilename = '';

    switch (reportType) {
      case 'html':
        content = generateHtmlReport(result);
        defaultFilename = 'imgclean-report.html';
        break;
      case 'json':
        content = generateJsonReport(result);
        defaultFilename = 'imgclean-report.json';
        break;
      case 'md':
      case 'markdown':
        content = generateMarkdownReport(result);
        defaultFilename = 'imgclean-report.md';
        break;
      default:
        throw new Error(`Unsupported report format: "${reportType}". Supported formats: html, json, md`);
    }

    const outputPath = options.output
      ? path.resolve(process.cwd(), options.output)
      : path.resolve(process.cwd(), defaultFilename);

    await ensureDir(path.dirname(outputPath));
    await fs.writeFile(outputPath, content, 'utf-8');

    console.log(chalk.green(`\n✓ ${reportType.toUpperCase()} report generated: ${path.relative(process.cwd(), outputPath)}`));
    return result;
  }

  // 5. Default terminal output
  const output = renderTerminalOutput(result, { verbose: options.verbose });
  console.log(output);

  return result;
}
