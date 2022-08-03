import { existsSync } from 'fs';
import { resolve } from 'path';
import { pdfToPng, PngPageOutput } from 'pdf-to-png-converter';
import comparePng, { ComparePngOptions } from 'png-visual-compare';
import { ComparePdfOptions, ExcludedPageArea, PdfToPngOptions } from './types';

export default async function comparePdf(
  actualPdfFilePathOrBuffer: string | ArrayBufferLike,
  expectedPdfFilePathOrBuffer: string | ArrayBufferLike,
  opts?: ComparePdfOptions,
): Promise<boolean> {
  if (!Buffer.isBuffer(actualPdfFilePathOrBuffer) && !existsSync(actualPdfFilePathOrBuffer as string)) {
    throw Error('Actual PDF file not found.');
  }

  if (!Buffer.isBuffer(expectedPdfFilePathOrBuffer) && !existsSync(expectedPdfFilePathOrBuffer as string)) {
    throw Error('Expected PDF file not found.');
  }

  const pdfToPngConvertOpts: PdfToPngOptions = {...opts?.pdfToPngConvertOptions };
  if (!pdfToPngConvertOpts.viewportScale) {
    pdfToPngConvertOpts.viewportScale = 2.0
  }
  if (!pdfToPngConvertOpts.outputFileMask) {
    pdfToPngConvertOpts.outputFileMask = 'comparePdf'
  }

  const diffsOutputFolder: string = opts?.diffsOutputFolder 
    ? opts.diffsOutputFolder 
    : resolve(`./comparePdfOutput`);
  const compareThreshold: number = opts?.compareThreshold 
    ? opts?.compareThreshold 
    : 0;
  const excludedAreas: ExcludedPageArea[] = opts?.excludedAreas 
    ? opts.excludedAreas 
    : [];
  if (compareThreshold < 0) {
    throw Error('Compare Threshold cannot be less than 0.');
  }

  const [actualPdfPngPages, expectedPdfPngPages] = await Promise.all([
    pdfToPng(actualPdfFilePathOrBuffer, pdfToPngConvertOpts),
    pdfToPng(expectedPdfFilePathOrBuffer, pdfToPngConvertOpts),
  ]);

  if (actualPdfPngPages.length !== expectedPdfPngPages.length) {
    return false;
  }

  let documentCompareResult = true;
  actualPdfPngPages.forEach((actualPdfPngPage, index) => {
    const comparePngOpts: ComparePngOptions = { ...opts?.pdfToPngConvertOptions, ...excludedAreas[index] };
    comparePngOpts.diffFilePath = resolve(diffsOutputFolder, `diff_${actualPdfPngPage.name}`);

    const expectedPngPageOutput: PngPageOutput = expectedPdfPngPages.find((p) => p.name === actualPdfPngPage.name) as PngPageOutput;
    const pageCompareResult: number = comparePng(actualPdfPngPage.content, expectedPngPageOutput.content, comparePngOpts);

    if (pageCompareResult > compareThreshold) {
      documentCompareResult = false;
    }
  });

  return documentCompareResult;
}
