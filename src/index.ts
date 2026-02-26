/**
 * pdf-visual-compare
 *
 * Visual regression testing library for PDFs in JavaScript/TypeScript.
 * Converts PDF pages to PNG images and performs pixel-level comparison,
 * requiring no native binaries or OS-level dependencies.
 *
 * @module pdf-visual-compare
 */
export { comparePdf } from './comparePdf.js';

export type { ComparePdfOptions } from './types/ComparePdfOptions.js';
export type { ExcludedPageArea } from './types/ExcludedPageArea.js';
