import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
const CLI_TEST_DIR = path.resolve(process.cwd(), '.tmp-test-cli');

describe('cli', () => {
  beforeAll(async () => {
    await fs.mkdir(CLI_TEST_DIR, { recursive: true });
    await sharp({
      create: {
        width: 64,
        height: 64,
        channels: 3,
        background: { r: 120, g: 150, b: 200 },
      },
    }).png().toFile(path.join(CLI_TEST_DIR, 'cli-sample.png'));
  });

  afterAll(async () => {
    try {
      await fs.rm(CLI_TEST_DIR, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('can scan directory programmatically', async () => {
    const { scanImageFiles } = await import('../src/core/scanner.js');
    const result = await scanImageFiles(CLI_TEST_DIR);
    expect(result.files.length).toBe(1);
    expect(result.files[0]?.path).toBe('cli-sample.png');
  });

  it('can execute built CLI binary with node', async () => {
    const cliPath = path.resolve(process.cwd(), 'dist/cli/index.mjs');
    const { stdout } = await execAsync(`node "${cliPath}" scan "${CLI_TEST_DIR}" --json`);
    const parsed = JSON.parse(stdout);
    expect(parsed.totalImages).toBe(1);
    expect(parsed.images[0].path).toBe('cli-sample.png');
    expect(parsed.images[0].width).toBe(64);
    expect(parsed.images[0].height).toBe(64);
  });

  it('can run imgclean init to generate config file', async () => {
    const initTestDir = path.join(CLI_TEST_DIR, 'init-sub');
    await fs.mkdir(initTestDir, { recursive: true });

    const cliPath = path.resolve(process.cwd(), 'dist/cli/index.mjs');
    await execAsync(`node "${cliPath}" init`, { cwd: initTestDir });

    const configFile = path.join(initTestDir, 'imgclean.config.json');
    const exists = await fs.stat(configFile);
    expect(exists.isFile()).toBe(true);

    const content = JSON.parse(await fs.readFile(configFile, 'utf-8'));
    expect(content.budgets.total).toBe('10mb');
    expect(content.rules.unused).toBe(true);
  });

  it('can run imgclean ci and report budget status', async () => {
    const ciTestDir = path.join(CLI_TEST_DIR, 'ci-sub');
    await fs.mkdir(ciTestDir, { recursive: true });

    // Create config with strict 100B budget
    const config = {
      budgets: { total: '100B' },
    };
    await fs.writeFile(
      path.join(ciTestDir, 'imgclean.config.json'),
      JSON.stringify(config, null, 2)
    );

    // Create image of ~400 bytes (will breach 100B budget)
    await sharp({
      create: { width: 32, height: 32, channels: 3, background: { r: 255, g: 0, b: 0 } },
    }).png().toFile(path.join(ciTestDir, 'sample.png'));

    const cliPath = path.resolve(process.cwd(), 'dist/cli/index.mjs');

    // Should fail with exit code 1
    try {
      await execAsync(`node "${cliPath}" ci --json`, { cwd: ciTestDir });
      expect.unreachable('Should have exited with code 1');
    } catch (err: unknown) {
      const execError = err as { code?: number; stdout?: string };
      expect(execError.code).toBe(1);
      const output = JSON.parse(execError.stdout || '{}');
      expect(output.passed).toBe(false);
    }
  });
});
