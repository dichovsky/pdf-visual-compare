import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pdfToPng, type PngPageOutput, type PdfToPngOptions } from 'pdf-to-png-converter';
import { comparePng, type ComparePngOptions } from 'png-visual-compare';
import { DEFAULT_DIFFS_FOLDER } from './const.js';
import type { ComparePdfOptions } from './types/ComparePdfOptions.js';
import type { ExcludedPageArea } from './types/ExcludedPageArea.js';

/**
 * Compares two PDF files or buffers and returns a boolean indicating whether they are similar.
 *
 * @param actualPdf - The file path or buffer of the actual PDF to compare.
 * @param expectedPdf - The file path or buffer of the expected PDF to compare against.
 * @param opts - Optional comparison options.
 * @returns A promise that resolves to a boolean indicating whether the PDFs are similar.
 * @throws Will throw an error if the compare threshold is less than 0.
 */
export async function comparePdf(
    actualPdf: string | ArrayBufferLike,
    expectedPdf: string | ArrayBufferLike,
    opts: ComparePdfOptions = {},
): Promise<boolean> {
    // Validate input file types
    validateInputFileType(actualPdf);
    validateInputFileType(expectedPdf);

    // Set default options
    const pdfToPngConvertOpts: PdfToPngOptions = { ...opts.pdfToPngConvertOptions };
    if (!pdfToPngConvertOpts.viewportScale) {
        pdfToPngConvertOpts.viewportScale = 2.0;
    }
    if (!pdfToPngConvertOpts.outputFileMaskFunc) {
        pdfToPngConvertOpts.outputFileMaskFunc = (pageNumber: number) => `comparePdf_${pageNumber}.png`;
    }

    const diffsOutputFolder: string = opts.diffsOutputFolder ?? DEFAULT_DIFFS_FOLDER;
    const compareThreshold: number = opts.compareThreshold ?? 0;
    const excludedAreas: readonly ExcludedPageArea[] = opts.excludedAreas ?? [];

    if (compareThreshold < 0) {
        throw Error('Compare Threshold cannot be less than 0.');
    }

    // Convert PDFs to PNGs sequentially to avoid PDF.js worker state corruption.
    // When two pdfToPng calls run concurrently via Promise.all, the pdfDocument.cleanup()
    // in one call can corrupt the shared PDF.js worker state for the other call, causing
    // "Invalid page request" errors — particularly when the two PDFs have different page counts.
    const actualPdfPngPages = await pdfToPng(actualPdf, { ...pdfToPngConvertOpts });
    const expectedPdfPngPages = await pdfToPng(expectedPdf, { ...pdfToPngConvertOpts });

    let documentCompareResult = true;

    for (const [index, pngPage] of actualPdfPngPages.entries()) {
        // Look up the exclusion zone for this page by 1-based page number.
        const pageExcludedArea = excludedAreas.find((area) => area.pageNumber === index + 1);

        if (!pngPage.content) {
            throw new Error(`Page content is undefined for page: ${pngPage.name}`);
        }

        // Only forward the fields that ComparePngOptions actually recognises.
        // The per-page diffFilePath override takes precedence over the auto-generated path.
        const comparePngOpts: ComparePngOptions = {
            excludedAreas: pageExcludedArea?.excludedAreas,
            diffFilePath: pageExcludedArea?.diffFilePath ?? resolve(diffsOutputFolder, `diff_${pngPage.name}`),
            throwErrorOnInvalidInputData: false,
        };

        const pngPageOutputToCompareWith: PngPageOutput | undefined = expectedPdfPngPages.find(
            (p) => p.name === pngPage.name,
        );

        const pageCompareResult: number = comparePng(
            pngPage.content,
            pngPageOutputToCompareWith?.content ?? '',
            comparePngOpts,
        );

        // Per-page matchingThreshold overrides the document-level compareThreshold when set.
        const pageThreshold = pageExcludedArea?.matchingThreshold ?? compareThreshold;
        if (pageCompareResult > pageThreshold) {
            documentCompareResult = false;
        }
    }

    // Extra pages present in expected but absent from actual are always a mismatch.
    if (expectedPdfPngPages.length > actualPdfPngPages.length) {
        documentCompareResult = false;
    }

    return documentCompareResult;
}

/**
 * Validates the type of the input file.
 *
 * Accepts a `Buffer`, any `ArrayBufferLike` (`ArrayBuffer` / `SharedArrayBuffer`), or a
 * string path that points to an existing file. Throws for any other input.
 *
 * @param inputFile - The input to validate.
 * @throws {Error} If the input is a string path that does not exist.
 * @throws {Error} If the input is neither a recognised buffer type nor a string.
 */
function validateInputFileType(inputFile: unknown): void {
    if (Buffer.isBuffer(inputFile) || inputFile instanceof ArrayBuffer || inputFile instanceof SharedArrayBuffer) {
        return;
    }
    if (typeof inputFile === 'string') {
        if (existsSync(inputFile)) {
            return;
        } else {
            throw Error(`PDF file not found: ${inputFile}`);
        }
    }
    throw Error(`Unknown input file type.`);
}
