#!/usr/bin/env node
import { Command } from 'commander';
import { scanCommand } from './commands/scan.js';
import { fixCommand } from './commands/fix.js';
import { ciCommand } from './commands/ci.js';
import { initCommand } from './commands/init.js';
import type { ScanCliOptions } from '../types/index.js';

const program = new Command();

program
  .name('imgclean')
  .description('Project-level image health and cleanup tool for web projects')
  .version('0.1.0')
  .showHelpAfterError('\n(run "imgclean --help" to see all available commands and options)');

program
  .command('scan')
  .description('Scan project images, detect bloat and issues')
  .argument('[path]', 'Path to project directory or image file', '.')
  .option('-v, --verbose', 'Show detailed output for each image')
  .option('--json', 'Output scan results as JSON to stdout')
  .option('--report <format>', 'Generate report file (html, json, md)')
  .option('-o, --output <path>', 'Custom path for the generated report')
  .option('-c, --config <path>', 'Path to custom imgclean config file')
  .action(async (targetPath: string, options: ScanCliOptions) => {
    try {
      await scanCommand(targetPath, options);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  });

program
  .command('fix')
  .description('Safely optimize and clean images')
  .argument('[path]', 'Path to project directory or image file', '.')
  .option('--dry-run', 'Simulate optimization without writing files')
  .option('--compress', 'Compress images')
  .option('--quality <number>', 'Compression quality (1-100)')
  .option('--format <format>', 'Convert images to format (webp, avif, png, jpeg)')
  .option('--resize', 'Resize oversized images')
  .option('--max-width <number>', 'Maximum width in pixels')
  .option('--max-height <number>', 'Maximum height in pixels')
  .option('--target-size <size>', 'Optimize to target size (e.g. 300kb)')
  .option('--strip-metadata', 'Remove EXIF/metadata from images')
  .option('--overwrite', 'Replace original images in-place (no code changes needed)')
  .option('-o, --output <dir>', 'Custom output destination directory')
  .option('-c, --config <path>', 'Path to custom imgclean config file')
  .action(async (targetPath: string, options: Record<string, unknown>) => {
    try {
      await fixCommand(targetPath, options);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  });

program
  .command('ci')
  .description('Enforce image budgets in CI environments')
  .option('-c, --config <path>', 'Path to custom imgclean config file')
  .option('--json', 'Output CI results as JSON')
  .action(async (options: Record<string, unknown>) => {
    try {
      await ciCommand(options);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Create an imgclean.config.json configuration file')
  .action(async () => {
    try {
      await initCommand();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  });

// If no arguments provided, display help
if (process.argv.length <= 2) {
  program.help();
}

program.parse(process.argv);
