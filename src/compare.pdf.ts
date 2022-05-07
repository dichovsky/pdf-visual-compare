import { existsSync } from 'fs';
import { resolve } from 'path';
import { pdfToPng, PngPageOutput } from 'pdf-to-png-converter';
import comparePng, { ComparePngOptions } from 'png-visual-compare';
import { ComparePdfOptions, PdfToPngOptions } from './types';

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

  const pdfToPngConvertOpts: PdfToPngOptions = opts?.pdfToPngConvertOptions ?? {
    viewportScale: 2.0,
    outputFileMask: 'comparePdf',
  };
  const diffsOutputFolder: string = opts?.diffsOutputFolder 
    ? opts.diffsOutputFolder 
    : resolve(`./comparePdfOutput`);
  const compareThreshold: number = opts?.compareThreshold 
    ? opts?.compareThreshold 
    : 0;
  const excludedAreas = opts?.excludedAreas 
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

  let overallCompareResult = true;
  actualPdfPngPages.forEach((actualPdfPngPage, index) => {
    const comparePngOpts: ComparePngOptions = { ...opts?.pdfToPngConvertOptions, ...excludedAreas[index] };
    comparePngOpts.diffFilePath = resolve(diffsOutputFolder, `diff_${actualPdfPngPage.name}`);

    const expectedPdfPngPage = expectedPdfPngPages.find(
      (expectedPdfPngPage) => expectedPdfPngPage.name === actualPdfPngPage.name,
    ) as PngPageOutput;
    const compareResult: number = comparePng(actualPdfPngPage.content, expectedPdfPngPage.content, comparePngOpts);

    if (compareResult > compareThreshold) {
      overallCompareResult = false;
    }
  });

  return overallCompareResult;
}
