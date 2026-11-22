import type { ComparePdfPageStatus } from './ComparePdfPageStatus.js';

/**
 * The comparison result of one page, from `comparePdfDetailed()`.
 */
export type ComparePdfPageResult = {
    /**
     * 1-based rendered page number. The comparison plan and the comparison use this number.
     */
    pageNumber: number;

    /**
     * Final status of the page.
     */
    status: ComparePdfPageStatus;

    /**
     * `true` when this page is in its applicable threshold.
     */
    isEqual: boolean;

    /**
     * Pixel threshold that the comparison applied to this page. A page-specific value replaces
     * the document-level threshold.
     */
    threshold: number;

    /**
     * Percentage threshold that the comparison applied to this page. A page-specific
     * `matchingThresholdPercent` replaces the document-level `compareThresholdPercent`.
     * `null` when no percentage threshold is set for this page.
     */
    thresholdPercent: number | null;

    /**
     * Mismatch count that the PNG comparator returned.
     * `null` means that the page was not compared, because one rendered counterpart was missing.
     */
    mismatchCount: number | null;

    /**
     * Mismatch percentage: the different pixels as a percentage of the comparison canvas.
     * The comparison canvas is the larger width multiplied by the larger height of the two
     * rendered pages. The library rounds the value to 4 decimal places (for example, `0.07` means
     * 0.07%).
     *
     * The comparator extends the two pages to the same canvas. Thus, the value stays in
     * `[0, 100]`, also when the page sizes or the aspect ratios are different.
     * `null` means that the page was not compared, because one rendered counterpart was missing.
     * The value is `0` when the renderer gives a canvas area that is not positive or not finite,
     * also when `mismatchCount` is not zero.
     */
    mismatchPercent: number | null;

    /**
     * Diff image path for this page comparison.
     * `null` means that the page was not compared, because one rendered counterpart was missing.
     * `null` also means that diff image writing was disabled.
     *
     * When diff image writing is enabled, every compared page has a path, including a matched page.
     * The path can refer to a file that does not exist. Use `isEqual` or `status` to check the result.
     */
    diffFilePath: string | null;

    /**
     * Name of the actual rendered page from the renderer, when the actual PDF has this page.
     */
    actualPageName: string | null;

    /**
     * Name of the expected rendered page from the renderer, when the expected PDF has this page.
     */
    expectedPageName: string | null;
};
