import { ComparePdfError } from './ComparePdfError.js';

/**
 * The library throws this error when the PDF renderer fails before the visual comparison can start.
 */
export class ComparePdfRenderingError extends ComparePdfError {}
