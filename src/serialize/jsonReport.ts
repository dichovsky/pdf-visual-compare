import type { ComparePdfDetailedResult } from '../types/ComparePdfDetailedResult.js';

/**
 * Serializes a {@link ComparePdfDetailedResult} as formatted JSON.
 *
 * The output contains all data of the result object (the same public type). Thus, `JSON.parse`
 * returns an object with the same field values. Use the output for CI artifacts and for tools that read
 * the comparison result.
 */
export function toJsonReport(result: ComparePdfDetailedResult): string {
    return JSON.stringify(result, null, 2);
}
