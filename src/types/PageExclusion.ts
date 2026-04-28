import type { PageArea } from './PageArea.js';
import type { RgbColor } from './RgbColor.js';

/**
 * Defines a page-specific exclusion zone for PDF comparison.
 *
 * Each entry is matched to a PDF page by its `pageNumber` field (1-based):
 * `pageNumber: 1` targets the first page, `pageNumber: 2` the second, and so on.
 * Entries whose `pageNumber` does not correspond to any rendered page are silently ignored.
 * If multiple entries target the same `pageNumber`, only the first matching entry is used.
 */
export type PageExclusion = {
    /**
     * 1-based page number this exclusion applies to.
     * Must be a finite positive integer matching the page's position in the PDF
     * (`1` = first page, `2` = second page, etc.).
     */
    pageNumber: number;

    /**
     * Rectangular regions to exclude from pixel comparison on this page.
     * Coordinates (`x1`, `y1`, `x2`, `y2`) are in pixels relative to the rendered PNG
     * at the configured `viewportScale`. `(x1, y1)` is the top-left corner and
     * `(x2, y2)` is the bottom-right corner.
     */
    excludedAreas?: PageArea[];

    /**
     * Colour used to paint excluded regions before comparison.
     * Expressed as `{ r, g, b }` with channel values in the range 0–255.
     *
     * When omitted, the downstream PNG comparator uses its default blue fill colour.
     */
    excludedAreaColor?: RgbColor;

    /**
     * Override the diff image output file path for this specific page.
     * When set, takes precedence over the path derived from `diffsOutputFolder`.
     * When omitted, the path is auto-generated as `<diffsOutputFolder>/diff_<pageName>`.
     * When diff writing is enabled, the resolved path must stay within `diffsOutputFolder`,
     * otherwise `comparePdf` throws `ComparePdfConfigurationError`.
     */
    diffFilePath?: string;

    /**
     * Per-page pixel difference threshold that overrides the document-level
     * `compareThreshold` for this page only. Must be a finite non-negative integer.
     * When omitted, the document-level `compareThreshold` applies.
     */
    matchingThreshold?: number;
};
