import type { PageExclusion } from './PageExclusion.js';
import type { PdfRenderOptions } from './PdfRenderOptions.js';

/**
 * Options for the PDF comparison.
 */
export type ComparePdfOptions = {
    /**
     * When `true`, the comparison writes diff images to disk.
     * When omitted or `false`, the comparison stays in memory and writes no diff images.
     * @default false
     */
    writeDiffs?: boolean;

    /**
     * The diff output folder: the root folder for diff images. When `writeDiffs` is `true` and a page
     * has different pixels, the comparison writes a diff image to this folder. Generated diff paths
     * and each per-page `diffFilePath` must stay in this folder.
     * We recommend that callers use a trusted folder on a trusted local file system.
     * When you set this option, the comparison validates it, also when `writeDiffs` is `false`.
     * The comparison writes diff images only when `writeDiffs` is `true`.
     * @default "./comparePdfOutput"
     */
    diffsOutputFolder?: string;

    /**
     * Optional input root for string PDF inputs.
     *
     * When you set this option, the `actualPdf` and `expectedPdf` string paths must resolve to a
     * path in this folder. If a path is not in this folder, `comparePdf()` throws a
     * `ComparePdfConfigurationError`.
     *
     * When omitted, string paths are trusted local file paths that the caller controls.
     * This option has no effect on binary inputs (`Buffer`, `ArrayBuffer`, `SharedArrayBuffer`).
     */
    allowedInputRoot?: string;

    /**
     * Options to render the PDF pages before the comparison.
     */
    pdfToPngConvertOptions?: PdfRenderOptions;

    /**
     * Each entry is a page exclusion: the excluded areas for one page. The comparison does not
     * examine these areas. Each entry applies to the rendered page with the same `pageNumber` (1-based).
     *
     * The comparison ignores an entry for a page that was not rendered. If two or more entries
     * have the same `pageNumber`, the comparison uses the first entry and ignores the others.
     * @default []
     */
    excludedAreas?: readonly PageExclusion[];

    /**
     * Number of different pixels that the pixel threshold permits. Use a finite non-negative integer.
     * If the count exceeds this value, the page can still meet the percentage threshold.
     * @default 0
     * @throws {ComparePdfConfigurationError} When set to a negative, fractional, infinite, or `NaN` value.
     */
    compareThreshold?: number;

    /**
     * Optional percentage threshold: the maximum mismatch percentage on an equal page. The
     * mismatch percentage is the mismatch count as a percentage of the comparison canvas. The
     * comparison canvas is the larger width multiplied by the larger height of the two rendered pages.
     *
     * A page is equal when it is in EITHER `compareThreshold` (pixel count) OR this percentage
     * threshold. The page does not have to be in both thresholds. Thus, a percentage threshold
     * can make the pixel threshold less strict, but never more strict.
     *
     * The value must be a finite number from 0 to 100. When omitted, only the pixel threshold
     * applies.
     * @throws {ComparePdfConfigurationError} When set outside 0–100, infinite, or `NaN`.
     */
    compareThresholdPercent?: number;

    /**
     * Selects the pages that the comparison examines. The value is a comma-separated list of page
     * numbers and ranges (for example, `"1-3,5,7"`) or an array of 1-based page numbers (for example, `[1, 2, 3, 5, 7]`).
     *
     * When omitted, the comparison examines every rendered page.
     *
     * When you set this option:
     * - If a selected page is in only one PDF, the result shows a missing counterpart for it.
     * - If a selected page is not in the actual PDF and not in the expected PDF, the comparison
     *   ignores the page. The comparison ignores such a page only when the selection contains a
     *   minimum of one rendered page.
     * - If the selection contains no rendered page of either PDF, the comparison throws an error.
     *   It does not report the PDFs as equal.
     * @throws {ComparePdfConfigurationError} When the selection is malformed, selects no page, or
     * contains no rendered page of either PDF.
     */
    pages?: string | readonly number[];
};
