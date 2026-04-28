import { comparePlannedPage } from './internal/comparePlannedPage.js';
import { buildPageNumberComparisonPlan } from './internal/pageComparisonPlan.js';
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
 * Compares two PDF inputs and returns a boolean indicating whether they are visually equivalent.
 *
 * Supported PDF inputs are file paths, `Buffer`, `ArrayBuffer`, and `SharedArrayBuffer`. String
 * paths are trusted caller-controlled inputs by default. To constrain them to a specific
 * workspace, set `options.allowedInputRoot`. `SharedArrayBuffer` inputs are normalized to
 * `ArrayBuffer` before rendering.
 *
 * Diff PNGs are not written unless `options.writeDiffs` is explicitly set to `true`. When enabled,
 * `options.diffsOutputFolder` acts as a trusted write root on a trusted local filesystem.
 *
 * Rendered pages are paired by renderer-reported `pageNumber`, not by generated PNG filename
 * or `excludedAreas` array position. If either PDF is missing a rendered counterpart for a
 * page number present in the comparison plan, the overall comparison returns `false`.
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
    const result = await comparePdfDetailed(
        actualPdf as PdfInput,
        expectedPdf as PdfInput,
        opts as ComparePdfOptions | undefined,
    );

    return result.isEqual;
}

/**
 * Compares two PDF inputs and returns structured page-level comparison details.
 *
 * Supported PDF inputs are file paths, `Buffer`, `ArrayBuffer`, and `SharedArrayBuffer`. String
 * paths are trusted caller-controlled inputs by default. To constrain them to a specific
 * workspace, set `options.allowedInputRoot`. `SharedArrayBuffer` inputs are normalized to
 * `ArrayBuffer` before rendering.
 *
 * Diff PNGs are not written unless `options.writeDiffs` is explicitly set to `true`.
 *
 * Rendered pages are paired by renderer-reported `pageNumber`, not by generated PNG filename
 * or `excludedAreas` array position. Missing rendered counterpart pages are surfaced in the
 * returned page results without requiring callers to inspect diff files on disk.
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
    const pages: ComparePdfPageResult[] = [];

    for (const planEntry of comparisonPlan) {
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
        diffsOutputFolder: normalizedOptions.writeDiffs ? normalizedOptions.diffsOutputFolder : null,
        pages,
        writeDiffs: normalizedOptions.writeDiffs,
    };
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
