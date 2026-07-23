import type { ComparePdfPageResult } from './ComparePdfPageResult.js';
import type { ComparePdfSummary } from './ComparePdfSummary.js';

/**
 * Structured document-level comparison result returned by `comparePdfDetailed()`.
 */
export type ComparePdfDetailedResult = {
    /**
     * `true` when every planned page comparison stays within its applicable threshold.
     */
    isEqual: boolean;

    /**
     * Number of rendered pages produced from the actual PDF input.
     */
    actualPageCount: number;

    /**
     * Number of rendered pages produced from the expected PDF input.
     */
    expectedPageCount: number;

    /**
     * Document-level pixel-count threshold supplied to the comparison.
     */
    compareThreshold: number;

    /**
     * Document-level percentage threshold supplied to the comparison, or `null` when none was set.
     */
    compareThresholdPercent: number | null;

    /**
     * `true` when diff PNG files were written for compared pages.
     */
    writeDiffs: boolean;

    /**
     * Base diff output folder used when a page does not provide a custom diff path.
     * `null` when diff writing was disabled.
     */
    diffsOutputFolder: string | null;

    /**
     * Page-level results sorted by `pageNumber`.
     */
    pages: ComparePdfPageResult[];

    /**
     * Document-level rollup derived from `pages` (counts by status, max change percentage,
     * and total mismatched pixels).
     */
    summary: ComparePdfSummary;
};
