import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { ComparePdfConfigurationError } from '../src/errors/ComparePdfConfigurationError.js';
import { toComparePngOptions } from '../src/internal/adapters/comparePngOptions.js';
import {
    assertCanonicalDiffOutputPath,
    assertDiffOutputPathUsesRealFilesystemEntries,
} from '../src/internal/diffOutputGuards.js';

test(`should reject blank diffFilePath directly in comparePngOptions adapter`, () => {
    expect(() =>
        toComparePngOptions({ pageNumber: 1, diffFilePath: '' }, resolve('./test-results/compare/16-1'), 'page-1.png', true),
    ).toThrow('diffFilePath must be a non-empty string.');
});

test(`should allow diff-output guard early return for paths outside the diff root`, () => {
    expect(() =>
        assertDiffOutputPathUsesRealFilesystemEntries(
            resolve('./test-results/compare/16-outside/file.png'),
            resolve('./test-results/compare/16-root'),
        ),
    ).not.toThrow();
});

test(`should reject canonical diff output parents that escape the diff root`, () => {
    const diffsOutputFolder = resolve('./test-results/compare/16-root');
    const outsideFolder = resolve('./test-results/compare/16-outside');

    rmSync(diffsOutputFolder, { recursive: true, force: true });
    rmSync(outsideFolder, { recursive: true, force: true });
    mkdirSync(diffsOutputFolder, { recursive: true });
    mkdirSync(outsideFolder, { recursive: true });

    expect(() => assertCanonicalDiffOutputPath(resolve(outsideFolder, 'diff.png'), diffsOutputFolder)).toThrow(
        ComparePdfConfigurationError,
    );
});
