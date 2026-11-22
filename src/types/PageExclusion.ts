import type { PageArea } from './PageArea.js';
import type { RgbColor } from './RgbColor.js';

/**
 * A page exclusion: the excluded areas and the settings for one page of the PDF comparison.
 *
 * Each entry applies to the PDF page with the same `pageNumber` (1-based):
 * `pageNumber: 1` is the first page, `pageNumber: 2` is the second page, and so on.
 * When no rendered page has the `pageNumber` of an entry, the library ignores the entry
 * without a message. If two or more entries have the same `pageNumber`, the library uses only
 * the first entry.
 */
export type PageExclusion = {
    /**
     * 1-based page number for this page exclusion.
     * Must be a finite positive integer. The value is the position of the page in the PDF
     * (`1` = first page, `2` = second page, and so on).
     */
    pageNumber: number;

    /**
     * Excluded areas: rectangles on this page that the pixel comparison does not examine.
     * The coordinates (`x1`, `y1`, `x2`, `y2`) are pixels on the rendered PNG at the
     * `viewportScale` that you set. `(x1, y1)` is the top-left corner and
     * `(x2, y2)` is the bottom-right corner.
     */
    excludedAreas?: PageArea[];

    /**
     * Color that fills the excluded areas before the comparison.
     * The value is `{ r, g, b }`. Each channel value is from 0 to 255.
     *
     * When omitted, the PNG comparator uses its default blue fill color.
     */
    excludedAreaColor?: RgbColor;

    /**
     * Diff image path for this page.
     * When set, this path replaces the path from `diffsOutputFolder`.
     * When omitted, the library generates the path `<diffsOutputFolder>/diff_<pageName>`.
     * When diff image writing is enabled, the resolved path must stay in `diffsOutputFolder`.
     * If the path is not in that folder, `comparePdf` throws `ComparePdfConfigurationError`.
     */
    diffFilePath?: string;

    /**
     * Pixel threshold for this page only. This value replaces the document-level
     * `compareThreshold` for this page. Must be a finite non-negative integer.
     * When omitted, the document-level `compareThreshold` applies.
     */
    matchingThreshold?: number;

    /**
     * Percentage threshold for this page only. This value replaces the document-level
     * `compareThresholdPercent` for this page. Must be a finite number from 0 to 100.
     * When omitted, the document-level `compareThresholdPercent` applies. When you do not set
     * `matchingThresholdPercent` and you do not set `compareThresholdPercent`, the page has no
     * percentage threshold.
     */
    matchingThresholdPercent?: number;
};
