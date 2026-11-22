/**
 * pdf-visual-compare
 *
 * Visual regression testing library for PDFs in JavaScript/TypeScript.
 * The library renders PDF pages to PNG images and compares them pixel by pixel.
 * External system packages are not necessary. The current renderer uses prebuilt
 * native `@napi-rs/canvas` binaries from its dependency tree.
 *
 * @module pdf-visual-compare
 */
export { comparePdf, comparePdfDetailed } from './comparePdf.js';
export { toJsonReport } from './serialize/jsonReport.js';
export { toJUnitReport } from './serialize/junitReport.js';
export { ComparePdfComparisonError } from './errors/ComparePdfComparisonError.js';
export { ComparePdfConfigurationError } from './errors/ComparePdfConfigurationError.js';
export { ComparePdfError } from './errors/ComparePdfError.js';
export { ComparePdfInputError } from './errors/ComparePdfInputError.js';
export { ComparePdfRenderingError } from './errors/ComparePdfRenderingError.js';

export type { ComparePdfOptions } from './types/ComparePdfOptions.js';
export type { ComparePdfDetailedResult } from './types/ComparePdfDetailedResult.js';
export type { ComparePdfPageResult } from './types/ComparePdfPageResult.js';
export type { ComparePdfPageStatus } from './types/ComparePdfPageStatus.js';
export type { ComparePdfSummary } from './types/ComparePdfSummary.js';
export type { ExcludedPageArea } from './types/ExcludedPageArea.js';
export type { PageArea } from './types/PageArea.js';
export type { PageExclusion } from './types/PageExclusion.js';
export type { PdfInput } from './types/PdfInput.js';
export type { PdfRenderOptions } from './types/PdfRenderOptions.js';
export type { RgbColor } from './types/RgbColor.js';
