/**
 * Defines a rectangular region on a rendered PDF page by its pixel coordinates.
 */
export type PageArea = {
    /** X coordinate of the left edge (pixels from left). */
    x1: number;
    /** Y coordinate of the top edge (pixels from top). */
    y1: number;
    /** X coordinate of the right edge (pixels from left, inclusive). */
    x2: number;
    /** Y coordinate of the bottom edge (pixels from top, inclusive). */
    y2: number;
};
