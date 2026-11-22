import { resolve } from 'node:path';
import { pdfToPng } from 'pdf-to-png-converter';
import { comparePng } from 'png-visual-compare';
import { beforeAll, expect, test } from 'vitest';
import { comparePdf } from '../src';

let largestPageMismatch: number;

beforeAll(async () => {
    // Font rasterization can change between renderers and platforms. Measure the fixture directly
    // so the boundary tests use an independent pixel count for the installed renderer.
    const actualPages = await pdfToPng('./test-data/pdf1.pdf', { viewportScale: 2 });
    const expectedPages = await pdfToPng('./test-data/pdf2.pdf', { viewportScale: 2 });
    expect(actualPages.map((page) => page.pageNumber)).toEqual(expectedPages.map((page) => page.pageNumber));
    const counts = actualPages.map((page, index) => {
        const expected = expectedPages[index];
        if (!page.content || !expected.content) {
            throw new Error('Expected rendered PNG content for both threshold fixtures.');
        }
        return comparePng(page.content, expected.content);
    });
    largestPageMismatch = Math.max(...counts);
    expect(largestPageMismatch).toBeGreaterThan(0);
});

test(`should return false for non equal PDF files with threshold less than specified`, async () => {
    const compareResult: boolean = await comparePdf('./test-data/pdf1.pdf', './test-data/pdf2.pdf', {
        excludedAreas: [],
        compareThreshold: largestPageMismatch - 1,
        diffsOutputFolder: resolve(`./test-results/compare/5-1`),
    });

    expect(compareResult).toBeFalsy();
});

test(`should return true for non equal PDF files with threshold equals to specified`, async () => {
    const compareResult: boolean = await comparePdf('./test-data/pdf1.pdf', './test-data/pdf2.pdf', {
        compareThreshold: largestPageMismatch,
        diffsOutputFolder: resolve(`./test-results/compare/5-2`),
    });

    expect(compareResult).toBeTruthy();
});

test(`should return true for non equal PDF files with threshold more than specified`, async () => {
    const compareResult: boolean = await comparePdf('./test-data/pdf1.pdf', './test-data/pdf2.pdf', {
        compareThreshold: largestPageMismatch + 1,
        diffsOutputFolder: resolve(`./test-results/compare/5-3`),
    });

    expect(compareResult).toBeTruthy();
});

test(`should return true for equal PDF files with threshold equals to specified`, async () => {
    const compareResult: boolean = await comparePdf('./test-data/pdf1.pdf', './test-data/pdf11.pdf', {
        compareThreshold: 0,
        diffsOutputFolder: resolve(`./test-results/compare/5-4`),
    });

    expect(compareResult).toBeTruthy();
});

test(`should return true for equal PDF files with threshold less than specified`, async () => {
    const compareResult: boolean = await comparePdf('./test-data/pdf1.pdf', './test-data/pdf11.pdf', {
        compareThreshold: 1,
        diffsOutputFolder: resolve(`./test-results/compare/5-5`),
    });

    expect(compareResult).toBeTruthy();
});
