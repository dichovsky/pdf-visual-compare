import { ComparePdfError } from './ComparePdfError.js';

/**
 * The library throws this error when it cannot compare rendered PDF pages reliably.
 */
export class ComparePdfComparisonError extends ComparePdfError {}
