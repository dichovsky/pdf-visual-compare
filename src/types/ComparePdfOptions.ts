import type { PageExclusion } from './PageExclusion.js';
import type { PdfRenderOptions } from './PdfRenderOptions.js';

/**
 * Options for configuring the PDF comparison process.
 */
export type ComparePdfOptions = {
    /**
     * When `true`, writes diff PNG images to disk.
     * When omitted or `false`, comparison stays in memory and no diff files are produced.
     * @default false
     */
    writeDiffs?: boolean;

    /**
     * Folder path that defines the allowed root for diff PNG images written when differences are found.
     * Auto-generated diff paths and any per-page `diffFilePath` overrides must stay within this root.
     * Callers should treat this as a trusted filesystem write location on a trusted local filesystem.
     * If provided, it is validated even when `writeDiffs` is `false`; diff files are only written
     * when `writeDiffs` is `true`.
     * @default "./comparePdfOutput"
     */
    diffsOutputFolder?: string;

    /**
     * Optional workspace root that constrains string PDF inputs.
     *
     * When set, `actualPdf` and `expectedPdf` string paths must resolve within this directory
     * or `comparePdf()` throws a `ComparePdfConfigurationError`.
     *
     * When omitted, string paths are treated as trusted caller-controlled local file paths.
     * Binary inputs (`Buffer`, `ArrayBuffer`, `SharedArrayBuffer`) are not affected.
     */
    allowedInputRoot?: string;

    /**
     * Options for rendering PDF pages before comparison.
     */
    pdfToPngConvertOptions?: PdfRenderOptions;

    /**
     * Per-page areas to exclude from pixel comparison, matched by the rendered page's
     * `pageNumber` field (1-based).
     *
     * Entries for pages that were not rendered are ignored. If multiple entries target the
     * same `pageNumber`, the first entry wins and later duplicates are ignored.
     * @default []
     */
    excludedAreas?: readonly PageExclusion[];

    /**
     * Maximum number of differing pixels allowed before the comparison is considered a failure.
     * A value of `0` requires a pixel-perfect match. Must be a finite non-negative integer.
     * @default 0
     * @throws {ComparePdfConfigurationError} When set to a negative, fractional, infinite, or `NaN` value.
     */
    compareThreshold?: number;

    /**
     * Optional maximum percentage of differing pixels (relative to the rendered page area)
     * allowed before a page is considered a failure. A page passes when it stays within EITHER
     * `compareThreshold` (pixel count) OR this percentage threshold — the two criteria are
     * alternative, not cumulative, so configuring a percentage relaxes, never tightens, the
     * pixel-count default.
     *
     * Must be a finite number in the range 0–100. When omitted, only the pixel-count threshold
     * applies.
     * @throws {ComparePdfConfigurationError} When set outside 0–100, infinite, or `NaN`.
     */
    compareThresholdPercent?: number;

    /**
     * Restricts the comparison to a subset of pages. Accepts a comma-separated range spec
     * (e.g. `"1-3,5,7"`) or an explicit array of 1-based page numbers (e.g. `[1, 2, 3, 5, 7]`).
     *
     * When omitted, every rendered page is compared. A selected page present in only one PDF is
     * reported as a missing counterpart; selected pages that exist in neither PDF are ignored as
     * long as the selection still matches at least one rendered page. If the selection matches no
     * rendered page in either PDF, the comparison throws rather than silently passing.
     * @throws {ComparePdfConfigurationError} When the selection is malformed, selects no page, or
     * matches no rendered page in either PDF.
     */
    pages?: string | readonly number[];
};
