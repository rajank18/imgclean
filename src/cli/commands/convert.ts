import path from 'node:path';
import chalk from 'chalk';
import { convertProjectOrFile, type ConvertOptions } from '../../core/converter.js';
import { formatBytes } from '../../utils/bytes.js';

export interface ConvertCliOptions extends ConvertOptions {
  to?: string;
  output?: string;
  overwrite?: boolean;
}

export async function convertCommand(
  targetPath: string | undefined,
  arg2: string | undefined,
  arg3: string | undefined,
  options: ConvertCliOptions = {}
): Promise<void> {
  if (!targetPath) {
    console.error(chalk.red('\nError: Please provide a file or folder path to convert.'));
    console.log(chalk.gray('Example: imgclean convert ./image.png to webp\n'));
    process.exit(1);
  }

  // Parse arguments:
  // Case A: `imgclean convert ./image.png to webp` -> targetPath="./image.png", arg2="to", arg3="webp"
  // Case B: `imgclean convert ./image.png webp` -> targetPath="./image.png", arg2="webp"
  // Case C: `imgclean convert ./image.png --to webp` -> options.to="webp"
  let targetFormat: string | undefined;

  if (arg2 && arg2.toLowerCase() === 'to' && arg3) {
    targetFormat = arg3;
  } else if (arg2 && arg2.toLowerCase() !== 'to') {
    targetFormat = arg2;
  } else if (options.to) {
    targetFormat = options.to;
  }

  if (!targetFormat) {
    console.error(chalk.red('\nError: Target format not specified.'));
    console.log(chalk.gray('Usage: imgclean convert <filepath> to <format>'));
    console.log(chalk.gray('Example: imgclean convert ./hero.png to webp\n'));
    process.exit(1);
  }

  const resolvedTarget = path.resolve(process.cwd(), targetPath);
  const replaceOriginal = Boolean(options.replace || options.overwrite);

  console.log(chalk.cyan.bold('\nimgclean convert'));
  console.log(chalk.gray(`Converting ${targetPath} → ${targetFormat.toUpperCase()}...`));

  const convertOpts: ConvertOptions = {
    quality: options.quality ? Number(options.quality) : 90,
    outputDir: options.output || options.outputDir,
    replace: replaceOriginal,
    iconSize: options.iconSize ? Number(options.iconSize) : undefined,
  };

  const results = await convertProjectOrFile(resolvedTarget, targetFormat, convertOpts);

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  if (successful.length > 0) {
    console.log(chalk.green(`\n✓ Converted ${successful.length} image(s) to ${targetFormat.toUpperCase()}\n`));

    console.log(chalk.bold('CONVERTED FILES'));
    console.log('─'.repeat(40));
    for (const res of successful) {
      const inputName = path.basename(res.inputPath);
      const outputName = path.basename(res.outputPath);
      const sizeDiff = `${formatBytes(res.originalSize)} → ${formatBytes(res.convertedSize)}`;
      const replaceNotice = res.replacedOriginal ? chalk.yellow(' (original removed)') : '';
      console.log(`- ${inputName} → ${chalk.cyan(outputName)} (${sizeDiff})${replaceNotice}`);
    }
  }

  if (failed.length > 0) {
    console.log(chalk.red(`\n✗ Failed to convert ${failed.length} image(s):`));
    for (const res of failed) {
      console.log(chalk.red(`- ${path.basename(res.inputPath)}: ${res.error || 'Unknown error'}`));
    }
    process.exit(1);
  }

  console.log(chalk.gray(`\nDone.`));
}
