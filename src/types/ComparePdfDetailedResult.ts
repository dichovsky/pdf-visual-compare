import type { ComparePdfPageResult } from './ComparePdfPageResult.js';
import type { ComparePdfSummary } from './ComparePdfSummary.js';

/**
 * The document-level comparison result that `comparePdfDetailed()` returns.
 */
export type ComparePdfDetailedResult = {
    /**
     * `true` when every planned page comparison is in its applicable threshold.
     */
    isEqual: boolean;

    /**
     * Number of rendered pages from the actual PDF input.
     */
    actualPageCount: number;

    /**
     * Number of rendered pages from the expected PDF input.
     */
    expectedPageCount: number;

    /**
     * Document-level pixel threshold that the comparison used.
     */
    compareThreshold: number;

    /**
     * Document-level percentage threshold that the caller gave to the comparison, or `null` when not set.
     */
    compareThresholdPercent: number | null;

    /**
     * `true` when diff image writing was enabled for the comparison.
     */
    writeDiffs: boolean;

    /**
     * Diff output folder for a page that does not have a custom diff path.
     * `null` when diff image writing was disabled.
     */
    diffsOutputFolder: string | null;

    /**
     * Page results in the order of `pageNumber`.
     */
    pages: ComparePdfPageResult[];

    /**
     * Document-level summary of `pages`: the number of pages for each status, the maximum
     * mismatch percentage, and the total mismatch count.
     */
    summary: ComparePdfSummary;
};
