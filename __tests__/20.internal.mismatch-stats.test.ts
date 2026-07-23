import { expect, test } from 'vitest';
import {
    computeMismatchPercent,
    computeUnroundedMismatchPercent,
    summarizePageResults,
} from '../src/internal/mismatchStats.js';
import type { ComparePdfPageResult } from '../src/types/ComparePdfPageResult.js';

function pageResult(overrides: Partial<ComparePdfPageResult>): ComparePdfPageResult {
    return {
        pageNumber: 1,
        status: 'matched',
        isEqual: true,
        threshold: 0,
        thresholdPercent: null,
        mismatchCount: 0,
        mismatchPercent: 0,
        diffFilePath: null,
        actualPageName: null,
        expectedPageName: null,
        ...overrides,
    };
}

test(`computeMismatchPercent divides by the page area and rounds to 4 decimals`, () => {
    expect(computeMismatchPercent(7, 100, 100, 100, 100)).toBe(0.07);
    expect(computeMismatchPercent(0, 100, 100, 100, 100)).toBe(0);
    expect(computeMismatchPercent(10000, 100, 100, 100, 100)).toBe(100);
});

test(`computeMismatchPercent divides by the normalized comparison canvas (max width x max height)`, () => {
    // Same aspect ratio: actual 2x2, expected 100x100 -> canvas 100x100 = 10000 px.
    expect(computeMismatchPercent(50, 2, 2, 100, 100)).toBe(0.5);
    // Differing aspect ratios: 100x1 vs 1x100 -> canvas max(100,1) x max(1,100) = 100x100 = 10000 px,
    // NOT max(area) = 100. So 199 mismatches is 1.99%, not a nonsensical 199%.
    expect(computeMismatchPercent(199, 100, 1, 1, 100)).toBe(1.99);
    // The whole canvas differing reports exactly 100%.
    expect(computeMismatchPercent(10000, 100, 1, 1, 100)).toBe(100);
});

test(`computeMismatchPercent returns 0 for zero or non-finite dimensions`, () => {
    expect(computeMismatchPercent(5, 0, 0, 0, 0)).toBe(0);
    expect(computeMismatchPercent(5, Number.NaN, 10, 10, 10)).toBe(0);
    expect(computeMismatchPercent(5, 10, 10, Number.POSITIVE_INFINITY, 10)).toBe(0);
});

test(`computeUnroundedMismatchPercent preserves the value that computeMismatchPercent rounds away`, () => {
    // 1 differing pixel on a 5000x5000 canvas is 0.000004%, which computeMismatchPercent rounds
    // to 0.0000 for reporting. Threshold decisions must use the unrounded value instead, or a
    // real (nonzero) mismatch would incorrectly pass a strict compareThresholdPercent: 0 config.
    expect(computeUnroundedMismatchPercent(1, 5000, 5000, 5000, 5000)).toBeCloseTo(0.000004, 10);
    expect(computeMismatchPercent(1, 5000, 5000, 5000, 5000)).toBe(0);
});

test(`computeUnroundedMismatchPercent divides by the normalized comparison canvas, unrounded`, () => {
    // Unlike computeMismatchPercent, the value is not rounded, so binary floating-point division
    // noise (e.g. 7/10000*100 = 0.06999999999999999) is asserted with toBeCloseTo, not toBe.
    expect(computeUnroundedMismatchPercent(7, 100, 100, 100, 100)).toBeCloseTo(0.07, 10);
    expect(computeUnroundedMismatchPercent(199, 100, 1, 1, 100)).toBeCloseTo(1.99, 10);
});

test(`computeUnroundedMismatchPercent returns 0 for zero or non-finite dimensions`, () => {
    expect(computeUnroundedMismatchPercent(5, 0, 0, 0, 0)).toBe(0);
    expect(computeUnroundedMismatchPercent(5, Number.NaN, 10, 10, 10)).toBe(0);
    expect(computeUnroundedMismatchPercent(5, 10, 10, Number.POSITIVE_INFINITY, 10)).toBe(0);
});

test(`summarizePageResults rolls up counts, max percent, and total mismatch`, () => {
    const summary = summarizePageResults([
        pageResult({ pageNumber: 1, status: 'matched', mismatchCount: 2, mismatchPercent: 0.02 }),
        pageResult({ pageNumber: 2, status: 'mismatched', isEqual: false, mismatchCount: 90, mismatchPercent: 0.9 }),
        pageResult({
            pageNumber: 3,
            status: 'missing-actual',
            isEqual: false,
            mismatchCount: null,
            mismatchPercent: null,
        }),
        pageResult({
            pageNumber: 4,
            status: 'missing-expected',
            isEqual: false,
            mismatchCount: null,
            mismatchPercent: null,
        }),
        // A later compared page whose percent does NOT exceed the running max keeps maxMismatchPercent at 0.9.
        pageResult({ pageNumber: 5, status: 'matched', mismatchCount: 1, mismatchPercent: 0.5 }),
    ]);

    expect(summary).toEqual({
        totalPages: 5,
        matchedPages: 2,
        mismatchedPages: 1,
        missingPages: 2,
        maxMismatchPercent: 0.9,
        totalMismatchCount: 93,
    });
});

test(`summarizePageResults returns a zeroed summary for no pages`, () => {
    expect(summarizePageResults([])).toEqual({
        totalPages: 0,
        matchedPages: 0,
        mismatchedPages: 0,
        missingPages: 0,
        maxMismatchPercent: 0,
        totalMismatchCount: 0,
    });
});
