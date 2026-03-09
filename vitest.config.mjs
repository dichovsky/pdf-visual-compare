import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    testTimeout: 90000,
    coverage: {
      provider: 'v8',
      exclude: ['**/index.ts'],
      thresholds: {
        statements: 100,
        branches: 90,
        functions: 100,
        lines: 100,
      },
    },
  },
})
