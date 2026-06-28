import type { ComparePdfPageResult } from '../types/ComparePdfPageResult.js';
import type { ComparePdfPageStatus } from '../types/ComparePdfPageStatus.js';
import type { ComparePdfSummary } from '../types/ComparePdfSummary.js';

const PERCENT_DECIMALS = 4;
const PERCENT_ROUNDING_FACTOR = 10 ** PERCENT_DECIMALS;

/**
 * Maps each page status to the summary counter it increments. The `satisfies Record<...>`
 * makes the mapping exhaustive at compile time: adding a new `ComparePdfPageStatus` member
 * without a counter here becomes a build error rather than a silently miscounted page.
 */
const STATUS_TO_COUNTER = {
    matched: 'matchedPages',
    mismatched: 'mismatchedPages',
    'missing-actual': 'missingPages',
    'missing-expected': 'missingPages',
} as const satisfies Record<ComparePdfPageStatus, 'matchedPages' | 'mismatchedPages' | 'missingPages'>;

/**
 * Computes the percentage of differing pixels for a compared page.
 *
 * The denominator is the area of the normalized comparison canvas —
 * `max(actualWidth, expectedWidth) * max(actualHeight, expectedHeight)` — which is exactly the
 * canvas `png-visual-compare` extends both pages onto before counting mismatches. This keeps the
 * result within `[0, 100]` even when the pages differ in size or aspect ratio; the larger-area
 * denominator would understate the canvas and could report more than 100%. Returns `0` when the
 * canvas area is not a positive finite number (e.g. a renderer reported zero or non-finite
 * dimensions), avoiding `NaN`/`Infinity` leaking into results.
 *
 * The value is rounded to 4 decimal places so the same number drives both the reported
 * `mismatchPercent` and any percentage threshold decision.
 */
export function computeMismatchPercent(
    mismatchCount: number,
    actualWidth: number,
    actualHeight: number,
    expectedWidth: number,
    expectedHeight: number,
): number {
    const canvasPixels = Math.max(actualWidth, expectedWidth) * Math.max(actualHeight, expectedHeight);
    if (!Number.isFinite(canvasPixels) || canvasPixels <= 0) {
        return 0;
    }

    return roundPercent((mismatchCount / canvasPixels) * 100);
}

/**
 * Builds the document-level summary from per-page results. Pure: no comparison work is performed.
 */
export function summarizePageResults(pages: readonly ComparePdfPageResult[]): ComparePdfSummary {
    const counters = { matchedPages: 0, mismatchedPages: 0, missingPages: 0 };
    let totalMismatchCount = 0;
    let maxMismatchPercent = 0;

    for (const page of pages) {
        counters[STATUS_TO_COUNTER[page.status]] += 1;

        if (page.mismatchCount !== null) {
            totalMismatchCount += page.mismatchCount;
        }

        if (page.mismatchPercent !== null && page.mismatchPercent > maxMismatchPercent) {
            maxMismatchPercent = page.mismatchPercent;
        }
    }

    return {
        totalPages: pages.length,
        matchedPages: counters.matchedPages,
        mismatchedPages: counters.mismatchedPages,
        missingPages: counters.missingPages,
        maxMismatchPercent,
        totalMismatchCount,
    };
}

function roundPercent(value: number): number {
    return Math.round(value * PERCENT_ROUNDING_FACTOR) / PERCENT_ROUNDING_FACTOR;
}
