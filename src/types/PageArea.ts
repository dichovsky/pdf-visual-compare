/**
 * A rectangle on a rendered PDF page, with pixel coordinates.
 */
export type PageArea = {
    /** X coordinate of the left edge (pixels from the left). */
    x1: number;
    /** Y coordinate of the top edge (pixels from the top). */
    y1: number;
    /** X coordinate of the right edge (pixels from the left, inclusive). */
    x2: number;
    /** Y coordinate of the bottom edge (pixels from the top, inclusive). */
    y2: number;
};
