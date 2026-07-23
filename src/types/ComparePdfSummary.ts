/**
 * Document-level rollup of page comparison outcomes, reported by `comparePdfDetailed()`.
 *
 * Derived entirely from the per-page results: it adds no new comparison work and is safe to
 * ignore by callers that only need the boolean outcome from `comparePdf()`.
 */
export type ComparePdfSummary = {
    /**
     * Total number of planned page entries (equals `pages.length`).
     */
    totalPages: number;

    /**
     * Number of pages within their applicable threshold (`status === 'matched'`).
     */
    matchedPages: number;

    /**
     * Number of pages that exceeded their applicable threshold (`status === 'mismatched'`).
     */
    mismatchedPages: number;

    /**
     * Number of pages that could not be compared because one rendered counterpart was missing
     * (`status === 'missing-actual'` or `'missing-expected'`).
     */
    missingPages: number;

    /**
     * Largest per-page `mismatchPercent` across compared pages. `0` when no page comparison ran
     * (e.g. every page is missing a counterpart); use `missingPages`/`mismatchedPages` to
     * distinguish "no differences" from "nothing was compared".
     */
    maxMismatchPercent: number;

    /**
     * Sum of `mismatchCount` across compared pages. Pages with a `null` mismatch count
     * (missing counterparts) contribute `0`.
     */
    totalMismatchCount: number;
};
