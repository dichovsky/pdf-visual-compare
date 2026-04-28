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
};
