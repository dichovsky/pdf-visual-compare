import { existsSync } from 'fs';
import { parse, resolve } from 'path';
import { pdfToPng, PngPageOutput } from 'pdf-to-png-converter';
import comparePng, { ComparePngOptions } from 'png-visual-compare';
import { ComparePdfOptions, PdfToPngOptions } from './types';

export default async function comparePdf(actualPdfFilePath: string, expectedPdfFilePath: string, opts?: ComparePdfOptions): Promise<boolean> {
    const actualPdfFilePathResolved: string = resolve(actualPdfFilePath);
    if (!existsSync(actualPdfFilePathResolved)) {
        throw Error('Actual PDF file not found.');
    }

    const expectedPdfFilePathResolved: string = resolve(expectedPdfFilePath);
    if (!existsSync(expectedPdfFilePathResolved)) {
        throw Error('Expected PDF file not found.');
    }

    const pdfToPngConvertOpts: PdfToPngOptions = opts?.pdfToPngConvertOptions ?? {};
    pdfToPngConvertOpts.viewportScale = pdfToPngConvertOpts.viewportScale ?? 2.0;
    pdfToPngConvertOpts.outputFileMask = pdfToPngConvertOpts.outputFileMask ?? 'comparePdf';

    const [actualPdfPngPages, expectedPdfPngPages] = await Promise.all([
        pdfToPng(actualPdfFilePathResolved, pdfToPngConvertOpts),
        pdfToPng(resolve(expectedPdfFilePath), pdfToPngConvertOpts),
    ]);

    if (actualPdfPngPages.length !== expectedPdfPngPages.length) {
        return false;
    }

    let overallCompareResult = true;

    const diffsOutputFolder: string =
        opts?.diffsOutputFolder ?? resolve(`./test-results/comparePdf/${parse(actualPdfFilePathResolved).base}_vs_${parse(expectedPdfFilePath).base}`);

    actualPdfPngPages.forEach((actualPdfPngPage, index) => {
        let comparePngOpts: ComparePngOptions = {};

        if (opts?.excludedAreas && opts.excludedAreas[index].excludedAreas) {
            comparePngOpts = { ...opts.excludedAreas[index] };
        }
        comparePngOpts.diffFilePath = comparePngOpts.diffFilePath ?? resolve(diffsOutputFolder, `diff_${actualPdfPngPage.name}`);

        const compareResult: number = comparePng(
            actualPdfPngPage.content,
            (expectedPdfPngPages.find((expectedPdfPngPage) => expectedPdfPngPage.name === actualPdfPngPage.name) as PngPageOutput).content,
            comparePngOpts,
        );

        if (compareResult > 0) {
            overallCompareResult = false;
        }
    });

    return overallCompareResult;
}
