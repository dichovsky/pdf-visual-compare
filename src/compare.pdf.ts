import { existsSync } from 'fs';
import { resolve } from 'path';
import { pdfToPng, PngPageOutput } from 'pdf-to-png-converter';
import comparePng, { ComparePngOptions } from 'png-visual-compare';
import { PNG, PNGWithMetadata } from 'pngjs';
import { DEFAULT_DIFFS_FOLDER } from './const';
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

  const pdfToPngConvertOpts: PdfToPngOptions = { ...opts?.pdfToPngConvertOptions };
  if (!pdfToPngConvertOpts.viewportScale) {
    pdfToPngConvertOpts.viewportScale = 2.0;
  }
  if (!pdfToPngConvertOpts.outputFileMask) {
    pdfToPngConvertOpts.outputFileMask = 'comparePdf';
  }

  const diffsOutputFolder: string = opts?.diffsOutputFolder 
    ? opts.diffsOutputFolder 
    : DEFAULT_DIFFS_FOLDER;
  const compareThreshold: number = opts?.compareThreshold 
    ? opts?.compareThreshold 
    : 0;
  const excludedAreas: ExcludedPageArea[] = opts?.excludedAreas 
    ? opts.excludedAreas 
    : [];

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
    const comparePngOpts: ComparePngOptions = { ...opts?.pdfToPngConvertOptions, ...excludedAreas[index] };
    comparePngOpts.diffFilePath = resolve(diffsOutputFolder, `diff_${pngPage.name}`);

    const pngPageOutputToCompareWith: PngPageOutput | undefined = expectedPdfPngPages.find(
      (p) => p.name === pngPage.name,
    );

    let bufferToCompareWith: Buffer;

    if (pngPageOutputToCompareWith) {
      bufferToCompareWith = pngPageOutputToCompareWith.content;
    } else {
      // Create a blank white page if there is no page to compare with
      const originalPngMetaData: PNGWithMetadata = PNG.sync.read(pngPage.content);
      bufferToCompareWith = getEmptyPngBuffer(originalPngMetaData.width, originalPngMetaData.height);
    }

    const pageCompareResult: number = comparePng(pngPage.content, bufferToCompareWith, comparePngOpts);

    if (pageCompareResult > compareThreshold) {
      documentCompareResult = false;
    }
  });

  return documentCompareResult;
}

function getEmptyPngBuffer(width: number, height: number): Buffer {
  const image = new PNG({ width, height });
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const position: number = (image.width * y + x) << 2;

      image.data[position + 0] = 255;
      image.data[position + 1] = 255;
      image.data[position + 2] = 255;
      image.data[position + 3] = 255;
    }
  }
  return PNG.sync.write(image);
}
