import type { Area, Color } from 'png-visual-compare';

/**
 * Defines a page-specific exclusion zone for PDF comparison.
 *
 * Each entry is matched to a PDF page by its `pageNumber` field (1-based):
 * `pageNumber: 1` targets the first page, `pageNumber: 2` the second, and so on.
 * Entries whose `pageNumber` does not correspond to any page are silently ignored.
 */
export type ExcludedPageArea = {
    /**
     * 1-based page number this exclusion applies to.
     * Must match the page's position in the PDF (`1` = first page, `2` = second page, etc.).
     */
    pageNumber: number;

    /**
     * Rectangular regions to exclude from pixel comparison on this page.
     * Coordinates (`x1`, `y1`, `x2`, `y2`) are in pixels relative to the rendered PNG
     * at the configured `viewportScale`. `(x1, y1)` is the top-left corner and
     * `(x2, y2)` is the bottom-right corner.
     */
    excludedAreas?: Area[];

    /**
     * Fill color used to paint excluded regions in the diff output image.
     * Expressed as `{ r, g, b }` with channel values in the range 0–255.
     *
     * @remarks Currently reserved for future use. The underlying `png-visual-compare`
     * library always paints excluded areas blue; this field has no effect at runtime.
     */
    excludedAreaColor?: Color;

    /**
     * Override the diff image output file path for this specific page.
     * When set, takes precedence over the path derived from `diffsOutputFolder`.
     * When omitted, the path is auto-generated as `<diffsOutputFolder>/diff_<pageName>`.
     */
    diffFilePath?: string;

    /**
     * Per-page pixel difference threshold that overrides the document-level
     * `compareThreshold` for this page only. Must be >= 0.
     * When omitted, the document-level `compareThreshold` applies.
     */
    matchingThreshold?: number;
};
