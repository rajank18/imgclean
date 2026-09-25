import path from 'node:path';
import chalk from 'chalk';
import { scanImageFiles } from '../../core/scanner.js';
import { optimizeProject, type OptimizeOptions } from '../../core/optimizer.js';
import { findConfigFile, loadJsonFile } from '../../utils/files.js';
import { formatBytes } from '../../utils/bytes.js';
import type { ImgCleanConfig } from '../../types/index.js';

export interface FixCliOptions extends OptimizeOptions {
  config?: string;
  output?: string;
  maxWidth?: number;
  maxHeight?: number;
}

export async function fixCommand(
  targetPath?: string,
  options: FixCliOptions = {}
): Promise<void> {
  const target = targetPath || '.';
  const resolvedTarget = path.resolve(process.cwd(), target);

  const configPath = await findConfigFile(process.cwd(), options.config);
  const config = configPath ? await loadJsonFile<ImgCleanConfig>(configPath) : null;

  console.log(chalk.cyan.bold('\nimgclean fix'));
  if (options.dryRun) {
    console.log(chalk.yellow('[DRY RUN] No files will be modified or created.\n'));
  }

  // 1. Scan images
  const { rootDir, files } = await scanImageFiles(resolvedTarget, {
    include: config?.include,
    exclude: config?.exclude,
  });

  if (files.length === 0) {
    console.log(chalk.gray(`No images found in ${target}`));
    return;
  }

  console.log(chalk.gray(`Optimizing ${files.length} image(s)...`));

  // Merge CLI options with config rules
  const optimizeOpts: OptimizeOptions = {
    ...options,
    outputDir: options.output || options.outputDir,
    quality: options.quality ? Number(options.quality) : undefined,
    maxWidth: options.maxWidth ? Number(options.maxWidth) : undefined,
    maxHeight: options.maxHeight ? Number(options.maxHeight) : undefined,
  };

  // 2. Perform optimization
  const outcome = await optimizeProject(rootDir, files, optimizeOpts);

  console.log(chalk.green(`\n✓ ${outcome.results.filter((r) => r.success).length} image(s) processed\n`));

  console.log(chalk.bold('OPTIMIZATION SUMMARY'));
  console.log('─'.repeat(40));
  console.log(`Original size:   ${formatBytes(outcome.totalOriginalSize).padStart(10, ' ')}`);
  console.log(`Optimized size:  ${formatBytes(outcome.totalOptimizedSize).padStart(10, ' ')}`);
  console.log(`Total savings:   ${chalk.green(formatBytes(outcome.totalSavings).padStart(10, ' '))}`);

  const successfulResults = outcome.results.filter((r) => r.success);
  if (successfulResults.length > 0) {
    console.log(chalk.bold('\nPROCESSED FILES'));
    console.log('─'.repeat(40));
    for (const res of successfulResults.slice(0, 10)) {
      const rel = path.basename(res.inputPath);
      const diff = `${formatBytes(res.originalSize)} → ${formatBytes(res.optimizedSize)} (-${res.savingsPercentage}%)`;
      console.log(`- ${rel.padEnd(20, ' ')} ${diff}`);
    }

    if (successfulResults.length > 10) {
      console.log(chalk.gray(`...and ${successfulResults.length - 10} more files`));
    }
  }

  if (!options.dryRun && outcome.results.some((r) => r.outputPath)) {
    const firstOutput = outcome.results.find((r) => r.outputPath)?.outputPath;
    const outputLocation = firstOutput ? path.dirname(firstOutput) : '.imgclean';
    console.log(chalk.blue(`\n📁 Optimized images safely saved to: ${outputLocation}`));
    console.log(chalk.gray(`Original files were preserved.`));
  }
}
