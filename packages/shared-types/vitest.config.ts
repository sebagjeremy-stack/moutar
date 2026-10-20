import { defineConfig } from 'vitest/config';

/** Tests des règles pures et des catalogues partagés. */
export default defineConfig({
  test: { globals: true, environment: 'node', include: ['src/**/*.spec.ts'] },
});
