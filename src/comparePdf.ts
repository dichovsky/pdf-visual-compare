import { ComparePdfConfigurationError } from './errors/ComparePdfConfigurationError.js';
import { comparePlannedPage } from './internal/comparePlannedPage.js';
import { buildPageNumberComparisonPlan } from './internal/pageComparisonPlan.js';
import { summarizePageResults } from './internal/mismatchStats.js';
import { normalizeComparisonOptions } from './internal/normalizeComparisonOptions.js';
import { normalizePdfInput } from './internal/normalizePdfInput.js';
import { listRenderedPageNumbers, PlannedPdfPages, renderPdfPage } from './internal/renderPdfPages.js';
import type { NormalizedComparePdfOptions, PageComparisonPlanEntry, RenderedPngPageOutput } from './internal/types.js';
import type { ComparePdfOptions } from './types/ComparePdfOptions.js';
import type { ComparePdfDetailedResult } from './types/ComparePdfDetailedResult.js';
import type { ComparePdfPageResult } from './types/ComparePdfPageResult.js';
import type { PdfInput } from './types/PdfInput.js';
import type { PdfToPngOptions, PngPageOutput } from 'pdf-to-png-converter';

/**
 * Compares two PDF inputs and returns a boolean. The boolean tells if the two PDFs are equal.
 *
 * The supported PDF inputs are file paths, `Buffer`, `ArrayBuffer`, and `SharedArrayBuffer`.
 * By default, string paths are trusted inputs that the caller controls. To keep them in a
 * specified folder, set `options.allowedInputRoot`. The library normalizes `SharedArrayBuffer`
 * inputs to `ArrayBuffer` before the renderer starts.
 *
 * The library writes diff images only when you set `options.writeDiffs` to `true`. When you enable
 * `options.writeDiffs`, `options.diffsOutputFolder` is a trusted folder on a trusted local file system.
 *
 * The library pairs rendered pages by the `pageNumber` that the renderer gives. It does not use
 * the generated PNG file name or the position in the `excludedAreas` array. If a page number in
 * the comparison plan has no rendered counterpart in one PDF, the comparison returns `false`.
 *
 * @param actualPdf - The file path or binary content of the actual PDF to compare.
 * @param expectedPdf - The file path or binary content of the expected PDF to compare against.
 * @param opts - Optional comparison options.
 * @returns A promise that resolves to `true` when every compared page stays within its
 * applicable threshold, otherwise `false`.
 * @throws {ComparePdfInputError} When a PDF input has an unsupported type or points to a missing file.
 * @throws {ComparePdfConfigurationError} When runtime comparison configuration is invalid.
 * @throws {ComparePdfRenderingError} When PDF rendering fails.
 * @throws {ComparePdfComparisonError} When PNG comparison fails.
 */
export function comparePdf(actualPdf: PdfInput, expectedPdf: PdfInput, opts?: ComparePdfOptions): Promise<boolean>;
export async function comparePdf(actualPdf: unknown, expectedPdf: unknown, opts?: unknown): Promise<boolean> {
    const result: ComparePdfDetailedResult = await comparePdfDetailed(
        actualPdf as PdfInput,
        expectedPdf as PdfInput,
        opts as ComparePdfOptions | undefined,
    );

    return result.isEqual;
}

/**
 * Compares two PDF inputs and returns the comparison details of each page.
 *
 * The supported PDF inputs are file paths, `Buffer`, `ArrayBuffer`, and `SharedArrayBuffer`.
 * By default, string paths are trusted inputs that the caller controls. To keep them in a
 * specified folder, set `options.allowedInputRoot`. The library normalizes `SharedArrayBuffer`
 * inputs to `ArrayBuffer` before the renderer starts.
 *
 * The library writes diff images only when you set `options.writeDiffs` to `true`.
 *
 * The library pairs rendered pages by the `pageNumber` that the renderer gives. It does not use
 * the generated PNG file name or the position in the `excludedAreas` array. The page results
 * show the pages that have no rendered counterpart. Callers do not have to examine diff images
 * on disk.
 *
 * @param actualPdf - The file path or binary content of the actual PDF to compare.
 * @param expectedPdf - The file path or binary content of the expected PDF to compare against.
 * @param opts - Optional comparison options.
 * @returns A promise that resolves to a structured comparison result.
 * @throws {ComparePdfInputError} When a PDF input has an unsupported type or points to a missing file.
 * @throws {ComparePdfConfigurationError} When runtime comparison configuration is invalid.
 * @throws {ComparePdfRenderingError} When PDF rendering fails.
 * @throws {ComparePdfComparisonError} When PNG comparison fails.
 */
export function comparePdfDetailed(
    actualPdf: PdfInput,
    expectedPdf: PdfInput,
    opts?: ComparePdfOptions,
): Promise<ComparePdfDetailedResult>;
export async function comparePdfDetailed(
    actualPdf: unknown,
    expectedPdf: unknown,
    opts?: unknown,
): Promise<ComparePdfDetailedResult> {
    const normalizedOptions: NormalizedComparePdfOptions = normalizeComparisonOptions(opts);
    const normalizedActualPdf: PdfInput = normalizePdfInput(actualPdf, 'actualPdf', normalizedOptions.allowedInputRoot);
    const normalizedExpectedPdf: PdfInput = normalizePdfInput(
        expectedPdf,
        'expectedPdf',
        normalizedOptions.allowedInputRoot,
    );

    const actualPlanningPages: PlannedPdfPages = await listRenderedPageNumbers(
        normalizedActualPdf,
        normalizedOptions.pdfToPngConvertOpts,
        'actual',
    );
    const expectedPlanningPages: PlannedPdfPages = await listRenderedPageNumbers(
        normalizedExpectedPdf,
        normalizedOptions.pdfToPngConvertOpts,
        'expected',
    );

    const actualPageNumberSet = new Set(actualPlanningPages.pageNumbers);
    const expectedPageNumberSet = new Set(expectedPlanningPages.pageNumbers);
    const comparisonPlan: PageComparisonPlanEntry[] = buildPageNumberComparisonPlan(
        actualPlanningPages.pageNumbers,
        expectedPlanningPages.pageNumbers,
        normalizedOptions.excludedAreas,
    );
    const selectedComparisonPlan = selectPlanPages(comparisonPlan, normalizedOptions.selectedPageNumbers);
    const pages: ComparePdfPageResult[] = [];

    for (const planEntry of selectedComparisonPlan) {
        const actualPage = actualPageNumberSet.has(planEntry.pageNumber)
            ? await resolvePlannedPage(
                  actualPlanningPages.prefetchedPages.get(planEntry.pageNumber),
                  normalizedActualPdf,
                  normalizedOptions.pdfToPngConvertOpts,
                  planEntry.pageNumber,
                  'actual',
              )
            : undefined;
        const expectedPage = expectedPageNumberSet.has(planEntry.pageNumber)
            ? await resolvePlannedPage(
                  expectedPlanningPages.prefetchedPages.get(planEntry.pageNumber),
                  normalizedExpectedPdf,
                  normalizedOptions.pdfToPngConvertOpts,
                  planEntry.pageNumber,
                  'expected',
              )
            : undefined;

        pages.push(comparePlannedPage({ ...planEntry, actualPage, expectedPage }, normalizedOptions));
    }

    return {
        isEqual: pages.every((page) => page.isEqual),
        actualPageCount: actualPlanningPages.pageNumbers.length,
        expectedPageCount: expectedPlanningPages.pageNumbers.length,
        compareThreshold: normalizedOptions.compareThreshold,
        compareThresholdPercent: normalizedOptions.compareThresholdPercent ?? null,
        diffsOutputFolder: normalizedOptions.writeDiffs ? normalizedOptions.diffsOutputFolder : null,
        pages,
        summary: summarizePageResults(pages),
        writeDiffs: normalizedOptions.writeDiffs,
    };
}

/**
 * Restricts a comparison plan to the explicitly selected page numbers, preserving order.
 * Returns the plan unchanged when no selection was provided. Selected page numbers absent
 * from the plan (present in neither PDF) are not compared.
 *
 * Throws when a selection was provided but matches no rendered page in either PDF: returning
 * an empty plan would make the comparison pass vacuously (`[].every(...)` is `true`), silently
 * hiding a typo'd or stale page selection from CI.
 */
function selectPlanPages(
    plan: readonly PageComparisonPlanEntry[],
    selectedPageNumbers: ReadonlySet<number> | undefined,
): PageComparisonPlanEntry[] {
    if (selectedPageNumbers === undefined) {
        return [...plan];
    }

    const selectedPlan = plan.filter((planEntry) => selectedPageNumbers.has(planEntry.pageNumber));
    if (selectedPlan.length === 0) {
        throw new ComparePdfConfigurationError('pages selection matched no rendered page in either PDF.');
    }

    return selectedPlan;
}

async function resolvePlannedPage(
    prefetchedPage: PngPageOutput | undefined,
    pdfInput: PdfInput,
    pdfToPngConvertOpts: PdfToPngOptions,
    pageNumber: number,
    sourceLabel: 'actual' | 'expected',
): Promise<RenderedPngPageOutput | undefined> {
    if (prefetchedPage && isRenderedPngPageOutput(prefetchedPage)) {
        return prefetchedPage;
    }

    return renderPdfPage(pdfInput, pdfToPngConvertOpts, pageNumber, sourceLabel);
}

function isRenderedPngPageOutput(page: PngPageOutput): page is RenderedPngPageOutput {
    return page.kind !== 'metadata' && Buffer.isBuffer(page.content);
}
