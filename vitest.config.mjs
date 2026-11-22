import { defineConfig } from 'vitest/config';

// The npm override covers the optional Vitest peer of png-visual-compare 6.3.
// This suite uses its core comparator. Its Vitest 4 matcher is a separate entry point.
export default defineConfig({
    test: {
        testTimeout: 90000,
        coverage: {
            provider: 'v8',
            exclude: ['**/index.ts', '**/cli.ts', 'scripts/**'],
            thresholds: {
                statements: 100,
                branches: 90,
                functions: 100,
                lines: 100,
            },
        },
    },
});
