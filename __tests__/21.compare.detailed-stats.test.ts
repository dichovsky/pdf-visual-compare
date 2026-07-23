import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { comparePdfDetailed } from '../src';

test(`reports zero mismatch percentage and a populated summary for equal PDFs`, async () => {
    const result = await comparePdfDetailed('./test-data/pdf1.pdf', './test-data/pdf11.pdf', {
        diffsOutputFolder: resolve('./test-results/compare/21-1'),
    });

    expect(result.isEqual).toBe(true);
    expect(result.pages).toHaveLength(2);
    for (const page of result.pages) {
        expect(page.mismatchCount).toBe(0);
        expect(page.mismatchPercent).toBe(0);
    }
    expect(result.summary).toEqual({
        totalPages: 2,
        matchedPages: 2,
        mismatchedPages: 0,
        missingPages: 0,
        maxMismatchPercent: 0,
        totalMismatchCount: 0,
    });
});

test(`derives mismatch percentage from real rendered dimensions for differing PDFs`, async () => {
    const result = await comparePdfDetailed('./test-data/pdf1.pdf', './test-data/pdf2.pdf', {
        diffsOutputFolder: resolve('./test-results/compare/21-2'),
    });

    expect(result.isEqual).toBe(false);

    const comparedPages = result.pages.filter((page) => page.mismatchCount !== null);
    expect(comparedPages.length).toBeGreaterThan(0);
    for (const page of comparedPages) {
        expect(page.mismatchPercent).not.toBeNull();
        expect(page.mismatchPercent).toBeGreaterThanOrEqual(0);
        expect(page.mismatchPercent).toBeLessThanOrEqual(100);
        if (page.mismatchCount === 0) {
            expect(page.mismatchPercent).toBe(0);
        } else {
            expect(page.mismatchPercent).toBeGreaterThan(0);
        }
    }

    // Summary stays consistent with the per-page numbers it rolls up.
    expect(result.summary.totalMismatchCount).toBe(
        result.pages.reduce((sum, page) => sum + (page.mismatchCount ?? 0), 0),
    );
    expect(result.summary.maxMismatchPercent).toBe(
        Math.max(...result.pages.map((page) => page.mismatchPercent ?? 0)),
    );
    expect(result.summary.maxMismatchPercent).toBeGreaterThan(0);
});
