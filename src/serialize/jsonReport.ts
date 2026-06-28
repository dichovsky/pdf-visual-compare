import type { ComparePdfDetailedResult } from '../types/ComparePdfDetailedResult.js';

/**
 * Serializes a {@link ComparePdfDetailedResult} as pretty-printed JSON.
 *
 * The output is a faithful, loss-free representation of the result object (the same public
 * type), so it round-trips back via `JSON.parse`. Useful for CI artifacts and tooling that
 * consumes the comparison outcome programmatically.
 */
export function toJsonReport(result: ComparePdfDetailedResult): string {
    return JSON.stringify(result, null, 2);
}
