/**
 * Document-level summary of the page results, from `comparePdfDetailed()`.
 *
 * The library calculates the summary only from the page results. The summary does not add
 * comparison work. Callers that need only the boolean result of `comparePdf()` can ignore it.
 */
export type ComparePdfSummary = {
    /**
     * Total number of planned page entries (the same as `pages.length`).
     */
    totalPages: number;

    /**
     * Number of pages in their applicable threshold (`status === 'matched'`).
     */
    matchedPages: number;

    /**
     * Number of pages that are not in their applicable threshold (`status === 'mismatched'`).
     */
    mismatchedPages: number;

    /**
     * Number of pages that the comparison could not compare, because one rendered counterpart
     * was missing (`status === 'missing-actual'` or `'missing-expected'`).
     */
    missingPages: number;

    /**
     * Largest `mismatchPercent` of the compared pages. The value is `0` if no pages were compared.
     * The number of compared pages is `totalPages - missingPages`.
     * Use `totalMismatchCount` for the number of different pixels.
     */
    maxMismatchPercent: number;

    /**
     * Sum of `mismatchCount` for the compared pages. A page with a `null` mismatch count
     * (no counterpart) adds `0`.
     */
    totalMismatchCount: number;
};
