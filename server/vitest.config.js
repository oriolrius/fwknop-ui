import { defineConfig } from 'vitest/config';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    // Tests share one throwaway data dir; run files serially to avoid collisions.
    env: { FWKNOP_DATA_DIR: join(tmpdir(), 'fwknop-ui-test-data') },
    fileParallelism: false,
    include: ['test/**/*.test.js'],
  },
});
