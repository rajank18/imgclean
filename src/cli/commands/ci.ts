import path from 'node:path';
import chalk from 'chalk';
import { scanImageFiles } from '../../core/scanner.js';
import { analyzeProject } from '../../core/analyzer.js';
import { findConfigFile, loadJsonFile } from '../../utils/files.js';
import { formatBytes } from '../../utils/bytes.js';
import type { ImgCleanConfig } from '../../types/index.js';

export interface CiCliOptions {
  config?: string;
  json?: boolean;
}

export async function ciCommand(options: CiCliOptions = {}): Promise<void> {
  const rootDir = process.cwd();
  const configPath = await findConfigFile(rootDir, options.config);

  if (!configPath) {
    if (options.json) {
      console.log(JSON.stringify({
        status: 'error',
        message: 'No imgclean configuration file found. Run `imgclean init` to create one.',
      }));
    } else {
      console.error(chalk.red('\n✗ Error: No imgclean configuration file found.'));
      console.error(chalk.gray('Run `imgclean init` to create a default configuration.\n'));
    }
    process.exit(1);
  }

  const config = await loadJsonFile<ImgCleanConfig>(configPath);

  // 1. Filesystem scan
  const { files } = await scanImageFiles(rootDir, {
    include: config?.include,
    exclude: config?.exclude,
  });

  // 2. Project analysis
  const result = await analyzeProject(rootDir, files, { config });
  const budget = result.budget;

  if (!budget) {
    if (options.json) {
      console.log(JSON.stringify({
        status: 'passed',
        message: 'No budgets defined in configuration.',
        result,
      }));
    } else {
      console.log(chalk.yellow('\n⚠ No budgets configured in imgclean.config.json'));
      console.log(chalk.gray('All checks passed by default.\n'));
    }
    process.exit(0);
  }

  const isPassed = budget.passed;

  if (options.json) {
    console.log(JSON.stringify({
      passed: isPassed,
      budget,
      totalSize: result.totalSize,
      totalImages: result.totalImages,
    }, null, 2));
    process.exit(isPassed ? 0 : 1);
  }

  // Terminal Output
  console.log(chalk.bold('\nIMAGE BUDGET'));
  console.log('─'.repeat(30));

  console.log(`Current: ${formatBytes(result.totalSize)}`);
  if (budget.totalBudget) {
    console.log(`Budget:  ${formatBytes(budget.totalBudget)}`);
  }

  if (budget.singleBudget) {
    console.log(`Per-file max: ${formatBytes(budget.singleBudget)}`);
  }

  console.log('');

  if (!budget.passedTotal && budget.totalBudget) {
    const excess = result.totalSize - budget.totalBudget;
    console.log(chalk.red(`✗ Total budget exceeded by ${formatBytes(excess)}`));
  }

  if (!budget.passedSingle && budget.exceededSingleFiles.length > 0) {
    console.log(chalk.red(`✗ ${budget.exceededSingleFiles.length} file(s) exceeded single image budget:`));
    for (const item of budget.exceededSingleFiles) {
      console.log(chalk.red(`  - ${item.file}: ${formatBytes(item.size)} > ${formatBytes(item.budget)}`));
    }
  }

  if (isPassed) {
    console.log(chalk.green('✓ Image budget passed\n'));
    process.exit(0);
  } else {
    console.log(chalk.red('\n✗ Image budget check failed\n'));
    process.exit(1);
  }
}
