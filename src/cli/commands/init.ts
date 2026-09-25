import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
import { pathExists } from '../../utils/files.js';

export const DEFAULT_CONFIG_TEMPLATE = {
  include: [
    'public/**/*',
    'src/assets/**/*',
  ],
  exclude: [
    'node_modules',
    '.git',
    '.next',
    'dist',
    'build',
  ],
  budgets: {
    total: '10mb',
    single: '500kb',
  },
  rules: {
    oversized: true,
    dimensions: true,
    duplicates: true,
    unused: true,
    metadata: true,
  },
};

export async function initCommand(targetDir: string = process.cwd()): Promise<void> {
  const configPath = path.join(targetDir, 'imgclean.config.json');

  if (pathExists(configPath)) {
    console.log(chalk.yellow(`\n⚠ Configuration file already exists at: ${configPath}`));
    return;
  }

  const content = JSON.stringify(DEFAULT_CONFIG_TEMPLATE, null, 2) + '\n';
  await fs.writeFile(configPath, content, 'utf-8');

  console.log(chalk.green(`\n✓ Created imgclean.config.json`));
  console.log(chalk.gray(`You can now run 'imgclean scan' or 'imgclean ci' to enforce image budgets.\n`));
}
