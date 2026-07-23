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
 * Computes the unrounded percentage of differing pixels for a compared page.
 *
 * The denominator is the area of the normalized comparison canvas —
 * `max(actualWidth, expectedWidth) * max(actualHeight, expectedHeight)` — which is exactly the
 * canvas `png-visual-compare` extends both pages onto before counting mismatches. This keeps the
 * result within `[0, 100]` even when the pages differ in size or aspect ratio; the larger-area
 * denominator would understate the canvas and could report more than 100%. Returns `0` when the
 * canvas area is not a positive finite number (e.g. a renderer reported zero or non-finite
 * dimensions), avoiding `NaN`/`Infinity` leaking into results.
 *
 * Percentage threshold decisions must use this unrounded value, not {@link computeMismatchPercent}:
 * rounding first can turn a real mismatch into an exact 0% match (e.g. 1 differing pixel on a
 * 5000x5000 canvas is 0.000004%, which rounds to 0.0000 and would incorrectly pass a
 * `compareThresholdPercent: 0` configuration).
 *
 * Named "Percent" rather than "Ratio": the return value is already on the 0–100 scale (directly
 * comparable to a `compareThresholdPercent`/`matchingThresholdPercent` input), not a 0–1 fraction.
 */
export function computeUnroundedMismatchPercent(
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

    return (mismatchCount / canvasPixels) * 100;
}

/**
 * Computes the percentage of differing pixels for a compared page, rounded to 4 decimal places
 * for reporting as the public `mismatchPercent` value. Threshold decisions must use
 * {@link computeUnroundedMismatchPercent} instead — see its doc comment for why.
 */
export function computeMismatchPercent(
    mismatchCount: number,
    actualWidth: number,
    actualHeight: number,
    expectedWidth: number,
    expectedHeight: number,
): number {
    return roundPercent(
        computeUnroundedMismatchPercent(mismatchCount, actualWidth, actualHeight, expectedWidth, expectedHeight),
    );
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
