import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { readPackageVersion } from '../src/cli/version.js';
import { toTextReport } from '../src/cli/report.js';
import type { ComparePdfDetailedResult } from '../src/types/ComparePdfDetailedResult.js';

test(`readPackageVersion returns the version from package.json`, () => {
    const expected = JSON.parse(readFileSync(resolve('./package.json'), 'utf8')).version;
    expect(readPackageVersion()).toBe(expected);
});

test(`toTextReport summarizes pass/fail, counts, and per-page detail`, () => {
    const result: ComparePdfDetailedResult = {
        isEqual: false,
        actualPageCount: 2,
        expectedPageCount: 2,
        compareThreshold: 0,
        compareThresholdPercent: null,
        writeDiffs: false,
        diffsOutputFolder: null,
        pages: [
            {
                pageNumber: 1,
                status: 'matched',
                isEqual: true,
                threshold: 0,
                thresholdPercent: null,
                mismatchCount: 0,
                mismatchPercent: 0,
                diffFilePath: null,
                actualPageName: 'a1.png',
                expectedPageName: 'e1.png',
            },
            {
                pageNumber: 2,
                status: 'missing-expected',
                isEqual: false,
                threshold: 0,
                thresholdPercent: null,
                mismatchCount: null,
                mismatchPercent: null,
                diffFilePath: null,
                actualPageName: 'a2.png',
                expectedPageName: null,
            },
        ],
        summary: {
            totalPages: 2,
            matchedPages: 1,
            mismatchedPages: 0,
            missingPages: 1,
            maxMismatchPercent: 0,
            totalMismatchCount: 0,
        },
    };

    const text = toTextReport(result);

    expect(text).toContain('PDF comparison: FAIL');
    expect(text).toContain('Pages: 2 total, 1 matched, 0 mismatched, 1 missing');
    expect(text).toContain('page 1: matched (0 px, 0%)');
    expect(text).toContain('page 2: missing-expected');
});
