import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pdfToPng, PngPageOutput, PdfToPngOptions } from 'pdf-to-png-converter';
import { comparePng, ComparePngOptions } from 'png-visual-compare';
import { DEFAULT_DIFFS_FOLDER } from './const.js';
import { ComparePdfOptions } from './types/ComparePdfOptions.js';
import { ExcludedPageArea } from './types/ExcludedPageArea.js';

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
    actualPdf: string | Buffer,
    expectedPdf: string | Buffer,
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

    const diffsOutputFolder: string = opts?.diffsOutputFolder ?? DEFAULT_DIFFS_FOLDER;
    const compareThreshold: number = opts?.compareThreshold ?? 0;
    const excludedAreas: readonly ExcludedPageArea[] = opts?.excludedAreas ?? [];

    if (compareThreshold < 0) {
        throw Error('Compare Threshold cannot be less than 0.');
    }

    // Convert PDFs to PNGs
    let [actualPdfPngPages, expectedPdfPngPages] = await Promise.all([
        pdfToPng(actualPdf, pdfToPngConvertOpts),
        pdfToPng(expectedPdf, pdfToPngConvertOpts),
    ]);

    // Ensure actualPdfPngPages is always the longer array to avoid index out of bounds errors
    if (actualPdfPngPages.length < expectedPdfPngPages.length) {
        [actualPdfPngPages, expectedPdfPngPages] = [expectedPdfPngPages, actualPdfPngPages];
    }

    let documentCompareResult = true;
    actualPdfPngPages.forEach((pngPage, index) => {
        const comparePngOpts: ComparePngOptions = {
            ...opts?.pdfToPngConvertOptions,
            ...excludedAreas[index],
            throwErrorOnInvalidInputData: false,
        };
        comparePngOpts.diffFilePath = resolve(diffsOutputFolder, `diff_${pngPage.name}`);

        const pngPageOutputToCompareWith: PngPageOutput | undefined = expectedPdfPngPages.find(
            (p) => p.name === pngPage.name,
        );

        const pageCompareResult: number = comparePng(
            pngPage.content,
            pngPageOutputToCompareWith?.content ?? '',
            comparePngOpts,
        );

        if (pageCompareResult > compareThreshold) {
            documentCompareResult = false;
        }
    });

    return documentCompareResult;
}

/**
 * Validates the type of the input file. The input file can either be a Buffer or a string representing a file path.
 * If the input file is a Buffer, the function returns without any error.
 * If the input file is a string, the function checks if the file exists at the given path.
 * If the file does not exist, an error is thrown.
 * If the input file is neither a Buffer nor a string, an error is thrown.
 *
 * @param inputFile - The input file to validate. It can be a Buffer or a string representing a file path.
 * @throws {Error} If the input file is a string and the file does not exist.
 * @throws {Error} If the input file is neither a Buffer nor a string.
 */
function validateInputFileType(inputFile: any): void {
    if (Buffer.isBuffer(inputFile)) {
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
