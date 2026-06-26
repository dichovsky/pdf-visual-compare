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
     * Pixel-count threshold applied to this page after combining the document-level threshold
     * with any page-specific override.
     */
    threshold: number;

    /**
     * Percentage threshold applied to this page after combining the document-level
     * `compareThresholdPercent` with any page-specific `matchingThresholdPercent` override.
     * `null` when no percentage threshold is configured for this page.
     */
    thresholdPercent: number | null;

    /**
     * Pixel mismatch count returned by the PNG comparator.
     * `null` means the page was not compared because one rendered counterpart was missing.
     */
    mismatchCount: number | null;

    /**
     * Percentage of differing pixels relative to the larger of the two rendered page areas,
     * rounded to 4 decimal places (e.g. `0.07` means 0.07%).
     * `null` means the page was not compared because one rendered counterpart was missing.
     * Reported as `0` in the degenerate case where the renderer returns a non-positive or
     * non-finite page area, even if `mismatchCount` is non-zero.
     */
    mismatchPercent: number | null;

    /**
     * Diff PNG output path chosen for this page comparison.
     * `null` means no page comparison ran because one rendered counterpart was missing,
     * or diff writing was disabled.
     * When `compareThresholdPercent` (or a per-page `matchingThresholdPercent`) is active, this can
     * be non-`null` even for a `matched` page: the diff captures pixel differences that the
     * percentage threshold tolerated. Detect failures via `isEqual`/`status`, not `diffFilePath`.
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
