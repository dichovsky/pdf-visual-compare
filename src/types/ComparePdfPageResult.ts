import type { ComparePdfPageStatus } from './ComparePdfPageStatus.js';

/**
 * Page-level comparison outcome reported by `comparePdfDetailed()`.
 */
export type ComparePdfPageResult = {
    /**
     * 1-based rendered page number used for planning and comparison.
     */
    pageNumber: number;

    /**
     * Final page outcome.
     */
    status: ComparePdfPageStatus;

    /**
     * `true` when this page is within its applicable threshold.
     */
    isEqual: boolean;

    /**
     * Threshold applied to this page after combining the document-level threshold with any
     * page-specific override.
     */
    threshold: number;

    /**
     * Pixel mismatch count returned by the PNG comparator.
     * `null` means the page was not compared because one rendered counterpart was missing.
     */
    mismatchCount: number | null;

    /**
     * Diff PNG output path chosen for this page comparison.
     * `null` means no page comparison ran because one rendered counterpart was missing,
     * or diff writing was disabled.
     */
    diffFilePath: string | null;

    /**
     * Renderer-reported actual page image name, when the actual PDF produced this page.
     */
    actualPageName: string | null;

    /**
     * Renderer-reported expected page image name, when the expected PDF produced this page.
     */
    expectedPageName: string | null;
};
