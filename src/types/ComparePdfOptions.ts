import type { PdfToPngOptions } from 'pdf-to-png-converter';
import type { ExcludedPageArea } from './ExcludedPageArea.js';

/**
 * Options for configuring the PDF comparison process.
 */
export type ComparePdfOptions = {
    /**
     * Folder path where diff PNG images are written when differences are found.
     * @default "./comparePdfOutput"
     */
    diffsOutputFolder?: string;

    /**
     * Options passed to the underlying PDF-to-PNG converter.
     * Controls rendering scale, font handling, page selection, and more.
     */
    pdfToPngConvertOptions?: PdfToPngOptions;

    /**
     * Per-page areas to exclude from pixel comparison, matched by array index (0-based).
     * The element at index 0 applies to the first page, index 1 to the second, and so on.
     * @default []
     */
    excludedAreas?: readonly ExcludedPageArea[];

    /**
     * Maximum number of differing pixels allowed before the comparison is considered a failure.
     * A value of `0` requires a pixel-perfect match. Must be >= 0.
     * @default 0
     * @throws {Error} When set to a value less than 0.
     */
    compareThreshold?: number;
};
