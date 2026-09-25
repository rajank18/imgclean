import path from 'node:path';
import chalk from 'chalk';
import { scanImageFiles } from '../../core/scanner.js';
import { analyzeProject } from '../../core/analyzer.js';
import { renderTerminalOutput } from '../output/terminal.js';
import { findConfigFile, loadJsonFile } from '../../utils/files.js';
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

  if (options.verbose && !options.json) {
    console.log(chalk.gray(`Target: ${resolvedTarget}`));
    if (configPath) {
      console.log(chalk.gray(`Config: ${configPath}`));
    }
  }

  if (!options.json) {
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

  // 4. Default terminal output
  const output = renderTerminalOutput(result, { verbose: options.verbose });
  console.log(output);

  return result;
}
