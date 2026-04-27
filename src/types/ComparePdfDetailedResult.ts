import type { ComparePdfPageResult } from './ComparePdfPageResult.js';

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
     * Document-level threshold supplied to the comparison.
     */
    compareThreshold: number;

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
};
