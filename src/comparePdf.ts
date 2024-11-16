import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pdfToPng, PngPageOutput, PdfToPngOptions } from 'pdf-to-png-converter';
import comparePng, { ComparePngOptions } from 'png-visual-compare';
import { DEFAULT_DIFFS_FOLDER } from './const.js';
import { ComparePdfOptions } from './types/ComparePdfOptions.js';
import { ExcludedPageArea } from './types/ExcludedPageArea.js';

/**
 * Compares two PDF files or buffers and returns a boolean indicating whether they are similar.
 *
 * @param actualPdfFilePathOrBuffer - The file path or buffer of the actual PDF to compare.
 * @param expectedPdfFilePathOrBuffer - The file path or buffer of the expected PDF to compare against.
 * @param opts - Optional comparison options.
 * @returns A promise that resolves to a boolean indicating whether the PDFs are similar.
 * @throws Will throw an error if the compare threshold is less than 0.
 */
export async function comparePdf(
  actualPdfFilePathOrBuffer: string | ArrayBufferLike,
  expectedPdfFilePathOrBuffer: string | ArrayBufferLike,
  opts?: ComparePdfOptions,
): Promise<boolean> {
  inputFileTypeGuard(actualPdfFilePathOrBuffer);
  inputFileTypeGuard(expectedPdfFilePathOrBuffer);

  const pdfToPngConvertOpts: PdfToPngOptions = { ...opts?.pdfToPngConvertOptions };
  if (!pdfToPngConvertOpts.viewportScale) {
    pdfToPngConvertOpts.viewportScale = 2.0;
  }
  if (!pdfToPngConvertOpts.outputFileMaskFunc) {
    pdfToPngConvertOpts!.outputFileMaskFunc = (pageNumber: number) => `comparePdf_${pageNumber}.png`;
  }

  const diffsOutputFolder: string = opts?.diffsOutputFolder ?? DEFAULT_DIFFS_FOLDER;
  const compareThreshold: number = opts?.compareThreshold ?? 0;
  const excludedAreas: readonly ExcludedPageArea[] = opts?.excludedAreas ?? [];

  if (compareThreshold < 0) {
    throw Error('Compare Threshold cannot be less than 0.');
  }

  let [actualPdfPngPages, expectedPdfPngPages] = await Promise.all([
    pdfToPng(actualPdfFilePathOrBuffer, pdfToPngConvertOpts),
    pdfToPng(expectedPdfFilePathOrBuffer, pdfToPngConvertOpts),
  ]);

  if (actualPdfPngPages.length < expectedPdfPngPages.length) {
    [actualPdfPngPages, expectedPdfPngPages] = [expectedPdfPngPages, actualPdfPngPages];
  }

  let documentCompareResult = true;
  actualPdfPngPages.forEach((pngPage, index) => {
    const comparePngOpts: ComparePngOptions = { ...opts?.pdfToPngConvertOptions, ...excludedAreas[index], throwErrorOnInvalidInputData: false };
    comparePngOpts.diffFilePath = resolve(diffsOutputFolder, `diff_${pngPage.name}`);

    const pngPageOutputToCompareWith: PngPageOutput | undefined = expectedPdfPngPages.find(
      (p) => p.name === pngPage.name,
    );

    const pageCompareResult: number = comparePng(pngPage.content, pngPageOutputToCompareWith?.content ?? '', comparePngOpts);

    if (pageCompareResult > compareThreshold) {
      documentCompareResult = false;
    }
  });

  return documentCompareResult;
}

function inputFileTypeGuard(inputFile: any): void {
  if (Buffer.isBuffer(inputFile)) {
    return;
  }
  if (typeof inputFile === 'string') {
    if (existsSync(inputFile)) {
      return;
    } else {
      throw Error(`PDF file not found.`);
    }
  }
  throw Error(`Unknown input file type.`);
}
