import type { PageExclusion } from '../types/PageExclusion.js';
import type { PageComparisonPlanEntry } from './types.js';

export function buildPageNumberComparisonPlan(
    actualPageNumbers: readonly number[],
    expectedPageNumbers: readonly number[],
    excludedAreas: readonly PageExclusion[],
): PageComparisonPlanEntry[] {
    const exclusionsByPageNumber = indexPageExclusionsByNumber(excludedAreas);
    const pageNumbers = new Set<number>([...actualPageNumbers, ...expectedPageNumbers]);

    return Array.from(pageNumbers)
        .sort((leftPageNumber, rightPageNumber) => leftPageNumber - rightPageNumber)
        .map((pageNumber) => ({
            pageNumber,
            pageExclusion: exclusionsByPageNumber.get(pageNumber),
        }));
}

function indexPageExclusionsByNumber(excludedAreas: readonly PageExclusion[]): Map<number, PageExclusion> {
    const exclusionsByPageNumber = new Map<number, PageExclusion>();

    for (const excludedArea of excludedAreas) {
        if (!exclusionsByPageNumber.has(excludedArea.pageNumber)) {
            exclusionsByPageNumber.set(excludedArea.pageNumber, excludedArea);
        }
    }

    return exclusionsByPageNumber;
}
