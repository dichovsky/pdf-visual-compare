import { toJsonReport } from '../serialize/jsonReport.js';
import { toJUnitReport } from '../serialize/junitReport.js';
import type { ComparePdfDetailedResult } from '../types/ComparePdfDetailedResult.js';
import type { ComparePdfPageResult } from '../types/ComparePdfPageResult.js';
import type { CliOutputFormat } from './parseArgs.js';

/** Renders a comparison result in the requested CLI output format. */
export function formatReport(result: ComparePdfDetailedResult, format: CliOutputFormat): string {
    switch (format) {
        case 'json':
            return toJsonReport(result);
        case 'junit':
            return toJUnitReport(result);
        default:
            return toTextReport(result);
    }
}

/** Human-readable summary of a comparison result. */
export function toTextReport(result: ComparePdfDetailedResult): string {
    const { summary } = result;
    const lines = [
        `PDF comparison: ${result.isEqual ? 'PASS' : 'FAIL'}`,
        `Pages: ${summary.totalPages} total, ${summary.matchedPages} matched, ` +
            `${summary.mismatchedPages} mismatched, ${summary.missingPages} missing`,
        `Max change: ${summary.maxMismatchPercent}% (${summary.totalMismatchCount} mismatched pixels total)`,
    ];

    for (const page of result.pages) {
        lines.push(`  ${describePage(page)}`);
    }

    return lines.join('\n');
}

function describePage(page: ComparePdfPageResult): string {
    if (page.mismatchCount === null) {
        return `page ${page.pageNumber}: ${page.status}`;
    }
    return `page ${page.pageNumber}: ${page.status} (${page.mismatchCount} px, ${page.mismatchPercent}%)`;
}
