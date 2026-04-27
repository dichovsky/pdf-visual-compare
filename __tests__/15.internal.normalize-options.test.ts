import { expect, test } from 'vitest';
import { normalizeComparisonOptions } from '../src/internal/normalizeComparisonOptions.js';

test(`should disable diff writing by default and resolve the default diff root lazily`, () => {
    const normalized = normalizeComparisonOptions(undefined);

    expect(normalized.writeDiffs).toBeFalsy();
    expect(normalized.diffsOutputFolder).toContain('comparePdfOutput');
});

test(`should allow custom diff path configuration only when writeDiffs is enabled`, () => {
    expect(() =>
        normalizeComparisonOptions({
            excludedAreas: [{ pageNumber: 1, diffFilePath: '' }],
        }),
    ).toThrow('diffFilePath must be a non-empty string.');

    expect(() =>
        normalizeComparisonOptions({
            writeDiffs: true,
            excludedAreas: [{ pageNumber: 1, diffFilePath: '' }],
        }),
    ).toThrow('diffFilePath must be a non-empty string.');
});
