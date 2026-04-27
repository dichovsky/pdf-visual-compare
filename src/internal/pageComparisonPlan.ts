import type { PageExclusion } from '../types/PageExclusion.js';
import type { PageComparisonPlanEntry, RenderedPngPageOutput } from './types.js';

export function buildPageComparisonPlan(
    actualPdfPngPages: readonly RenderedPngPageOutput[],
    expectedPdfPngPages: readonly RenderedPngPageOutput[],
    excludedAreas: readonly PageExclusion[],
): PageComparisonPlanEntry[] {
    const actualPagesByNumber = indexPagesByNumber(actualPdfPngPages);
    const expectedPagesByNumber = indexPagesByNumber(expectedPdfPngPages);
    return buildPageNumberComparisonPlan([...actualPagesByNumber.keys()], [...expectedPagesByNumber.keys()], excludedAreas).map(
        (entry) => ({
            ...entry,
            actualPage: actualPagesByNumber.get(entry.pageNumber),
            expectedPage: expectedPagesByNumber.get(entry.pageNumber),
        }),
    );
}

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

function indexPagesByNumber(pages: readonly RenderedPngPageOutput[]): Map<number, RenderedPngPageOutput> {
    return new Map(pages.map((page) => [page.pageNumber, page]));
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
