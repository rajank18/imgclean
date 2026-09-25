import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'cli/index': 'src/cli/index.ts',
  },
  format: ['esm'],
  target: 'node20.9',
  dts: true,
  clean: true,
  sourcemap: true,
  platform: 'node',
  failOnWarn: false,
});
