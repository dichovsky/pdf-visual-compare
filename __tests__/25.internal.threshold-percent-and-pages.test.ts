import { expect, test } from 'vitest';
import { normalizeComparisonOptions } from '../src/internal/normalizeComparisonOptions.js';

test(`accepts boundary percentage thresholds and exposes them on the normalized options`, () => {
    expect(normalizeComparisonOptions({ compareThresholdPercent: 0 }).compareThresholdPercent).toBe(0);
    expect(normalizeComparisonOptions({ compareThresholdPercent: 100 }).compareThresholdPercent).toBe(100);
    expect(normalizeComparisonOptions({ compareThresholdPercent: 12.5 }).compareThresholdPercent).toBe(12.5);
    expect(normalizeComparisonOptions(undefined).compareThresholdPercent).toBeUndefined();
});

test(`rejects out-of-range, infinite, and NaN percentage thresholds`, () => {
    expect(() => normalizeComparisonOptions({ compareThresholdPercent: -1 })).toThrow(
        'Compare Threshold Percent must be a finite number between 0 and 100.',
    );
    expect(() => normalizeComparisonOptions({ compareThresholdPercent: 101 })).toThrow(
        'Compare Threshold Percent must be a finite number between 0 and 100.',
    );
    expect(() => normalizeComparisonOptions({ compareThresholdPercent: Number.NaN })).toThrow(
        'Compare Threshold Percent must be a finite number between 0 and 100.',
    );
});

test(`validates per-page matchingThresholdPercent overrides`, () => {
    expect(() =>
        normalizeComparisonOptions({ excludedAreas: [{ pageNumber: 1, matchingThresholdPercent: 150 }] }),
    ).toThrow('Matching Threshold Percent must be a finite number between 0 and 100.');

    expect(
        normalizeComparisonOptions({ excludedAreas: [{ pageNumber: 1, matchingThresholdPercent: 5 }] }).excludedAreas,
    ).toHaveLength(1);
});

test(`parses the pages selection into a set and leaves it undefined when omitted`, () => {
    const normalized = normalizeComparisonOptions({ pages: '1-3,5' });
    expect(normalized.selectedPageNumbers).toBeInstanceOf(Set);
    expect([...(normalized.selectedPageNumbers ?? [])]).toEqual([1, 2, 3, 5]);

    expect(normalizeComparisonOptions(undefined).selectedPageNumbers).toBeUndefined();
});

test(`surfaces malformed pages selections as configuration errors`, () => {
    expect(() => normalizeComparisonOptions({ pages: '5-2' })).toThrow('descending range');
    expect(() => normalizeComparisonOptions({ pages: [] })).toThrow('must select at least one page');
});
