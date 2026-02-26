import type { Area, Color } from 'png-visual-compare';

/**
 * Defines a page-specific exclusion zone for PDF comparison.
 *
 * Elements in the `excludedAreas` array on {@link ComparePdfOptions} are matched to pages
 * by array index (0-based): index 0 targets the first page, index 1 the second, and so on.
 */
export type ExcludedPageArea = {
    /**
     * Informational page number for readability.
     * Matching is performed by array index, not by this value.
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
     */
    excludedAreaColor?: Color;

    /**
     * Override the diff image output file path for this specific page.
     * When omitted, the path is derived from the document-level `diffsOutputFolder`.
     */
    diffFilePath?: string;

    /**
     * Per-page pixel difference threshold that overrides the document-level
     * `compareThreshold` for this page only.
     */
    matchingThreshold?: number;
};
