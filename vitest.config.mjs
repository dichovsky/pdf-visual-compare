import { defaultExclude, defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        exclude: [...defaultExclude, '.claude/worktrees/**'],
        testTimeout: 90000,
        coverage: {
            provider: 'v8',
            include: ['src/**/*.ts'],
            exclude: ['src/index.ts', 'src/cli.ts'],
            thresholds: {
                statements: 100,
                branches: 90,
                functions: 100,
                lines: 100,
            },
        },
    },
});
