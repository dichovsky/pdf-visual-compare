import { expect, test } from 'vitest';
import { toJsonReport } from '../src/serialize/jsonReport.js';
import type { ComparePdfDetailedResult } from '../src/types/ComparePdfDetailedResult.js';

const result: ComparePdfDetailedResult = {
    isEqual: false,
    actualPageCount: 2,
    expectedPageCount: 2,
    compareThreshold: 0,
    compareThresholdPercent: 1,
    writeDiffs: false,
    diffsOutputFolder: null,
    pages: [
        {
            pageNumber: 1,
            status: 'matched',
            isEqual: true,
            threshold: 0,
            thresholdPercent: 1,
            mismatchCount: 0,
            mismatchPercent: 0,
            diffFilePath: null,
            actualPageName: 'a1.png',
            expectedPageName: 'e1.png',
        },
        {
            pageNumber: 2,
            status: 'mismatched',
            isEqual: false,
            threshold: 0,
            thresholdPercent: 1,
            mismatchCount: 200,
            mismatchPercent: 2,
            diffFilePath: null,
            actualPageName: 'a2.png',
            expectedPageName: 'e2.png',
        },
    ],
    summary: {
        totalPages: 2,
        matchedPages: 1,
        mismatchedPages: 1,
        missingPages: 0,
        maxMismatchPercent: 2,
        totalMismatchCount: 200,
    },
};

test(`serializes the detailed result as pretty JSON that round-trips back to the result`, () => {
    const json = toJsonReport(result);

    expect(JSON.parse(json)).toEqual(result);
    expect(json).toContain('\n  "isEqual": false');
});
