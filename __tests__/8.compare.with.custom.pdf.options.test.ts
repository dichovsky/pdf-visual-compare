import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { comparePdf } from '../src';

test(`should return true for equal PDF files with custom outputFileMaskFunc`, async () => {
    const compareResult: boolean = await comparePdf('./test-data/pdf1.pdf', './test-data/pdf11.pdf', {
        pdfToPngConvertOptions: {
            outputFileMaskFunc: (pageNumber: number) => `custom_${pageNumber}.png`,
            viewportScale: 1.0,
        },
        diffsOutputFolder: resolve(`./test-results/compare/8-1`),
    });

    expect(compareResult).toBeTruthy();
});
