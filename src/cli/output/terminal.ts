import chalk from 'chalk';
import type { ScanResult, ImageIssue } from '../../types/index.js';
import { formatBytes } from '../../utils/bytes.js';

export interface TerminalOutputOptions {
  verbose?: boolean;
}

/**
 * Render standard polished terminal output for scan results
 */
export function renderTerminalOutput(result: ScanResult, options: TerminalOutputOptions = {}): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(chalk.green(`✓ ${result.totalImages} images scanned\n`));

  // IMAGE SIZE SECTION
  lines.push(chalk.bold('IMAGE SIZE'));
  lines.push('─'.repeat(28));
  lines.push(`Total             ${formatBytes(result.totalSize).padStart(10, ' ')}`);
  if (result.potentialSavings > 0) {
    lines.push(`Potential savings ${chalk.green(formatBytes(result.potentialSavings).padStart(10, ' '))}`);
  }

  // ISSUES SECTION
  const issueCounts: Record<string, number> = {
    oversized: 0,
    dimensions: 0,
    duplicate: 0,
    metadata: 0,
    unused: 0,
  };

  for (const issue of result.issues) {
    if (issue.type in issueCounts) {
      issueCounts[issue.type] = (issueCounts[issue.type] || 0) + 1;
    }
  }

  const totalIssuesCount = result.issues.length;

  if (totalIssuesCount > 0) {
    lines.push('');
    lines.push(chalk.bold('ISSUES'));
    lines.push('─'.repeat(28));

    if (issueCounts.oversized && issueCounts.oversized > 0) {
      lines.push(`${chalk.yellow('⚠')} Oversized          ${String(issueCounts.oversized).padStart(8, ' ')}`);
    }
    if (issueCounts.dimensions && issueCounts.dimensions > 0) {
      lines.push(`${chalk.yellow('⚠')} Large dimensions   ${String(issueCounts.dimensions).padStart(8, ' ')}`);
    }
    if (issueCounts.duplicate && issueCounts.duplicate > 0) {
      lines.push(`${chalk.yellow('⚠')} Duplicates         ${String(issueCounts.duplicate).padStart(8, ' ')}`);
    }
    if (issueCounts.metadata && issueCounts.metadata > 0) {
      lines.push(`${chalk.yellow('⚠')} Metadata           ${String(issueCounts.metadata).padStart(8, ' ')}`);
    }
    if (issueCounts.unused && issueCounts.unused > 0) {
      lines.push(`${chalk.yellow('⚠')} Possibly unused    ${String(issueCounts.unused).padStart(8, ' ')}`);
    }
  }

  // LARGEST FILES SECTION
  if (result.images.length > 0) {
    const sortedImages = [...result.images].sort((a, b) => b.size - a.size);
    const topFiles = sortedImages.slice(0, 5);

    lines.push('');
    lines.push(chalk.bold('LARGEST FILES'));
    lines.push('─'.repeat(28));
    for (const img of topFiles) {
      const displayPath = img.path.length > 20 ? '...' + img.path.slice(-17) : img.path;
      lines.push(`${displayPath.padEnd(20, ' ')} ${formatBytes(img.size).padStart(7, ' ')}`);
    }
  }

  // FORMAT BREAKDOWN SECTION
  const formatEntries = Object.entries(result.formatBreakdown);
  if (formatEntries.length > 0) {
    lines.push('');
    lines.push(chalk.bold('FORMAT BREAKDOWN'));
    lines.push('─'.repeat(28));
    for (const [format, stat] of formatEntries) {
      lines.push(`${format.padEnd(16, ' ')}  ${formatBytes(stat.size).padStart(10, ' ')}`);
    }
  }

  // BUDGET SECTION (if present)
  if (result.budget) {
    lines.push('');
    lines.push(chalk.bold('BUDGET'));
    lines.push('─'.repeat(28));
    const budgetStr = `${formatBytes(result.totalSize)} / ${formatBytes(result.budget.totalBudget || 0)}`;
    const statusIcon = result.budget.passed ? chalk.green('✓') : chalk.red('✗');
    lines.push(`${budgetStr.padEnd(22, ' ')} ${statusIcon}`);
  }

  // VERBOSE DETAILED FINDINGS
  if (options.verbose && result.issues.length > 0) {
    lines.push('');
    lines.push(chalk.bold('DETAILED FINDINGS'));
    lines.push('─'.repeat(40));
    for (const issue of result.issues) {
      const typeLabel = `[${issue.type.toUpperCase()}]`.padEnd(14, ' ');
      lines.push(`${chalk.yellow(typeLabel)} ${chalk.cyan(issue.file)}`);
      lines.push(`               ${issue.message}`);
    }
  }

  if (result.potentialSavings > 0 || totalIssuesCount > 0) {
    lines.push('');
    lines.push(chalk.dim('Run `imgclean fix` to optimize images.'));
  }

  return lines.join('\n');
}
