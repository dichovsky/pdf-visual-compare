import { existsSync, rmSync } from 'node:fs';
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

test(`should accept comparison-safe render options`, async () => {
    const outputFolder = resolve(`./test-results/compare/8-2/pages`);

    const compareResult: boolean = await comparePdf('./test-data/pdf1.pdf', './test-data/pdf11.pdf', {
        pdfToPngConvertOptions: {
            disableFontFace: false,
            useSystemFonts: true,
            enableXfa: true,
            outputFolder,
            outputFileMaskFunc: (pageNumber: number) => `accepted_${pageNumber}.png`,
            pagesToProcess: [1, 2],
            verbosityLevel: 0,
        },
        diffsOutputFolder: resolve(`./test-results/compare/8-2/diffs`),
    });

    expect(compareResult).toBeTruthy();
    expect(existsSync(resolve(outputFolder, 'actual/accepted_1.png'))).toBeTruthy();
    expect(existsSync(resolve(outputFolder, 'expected/accepted_1.png'))).toBeTruthy();
});

test(`should re-render to a reused outputFolder without an exclusive-create EEXIST failure`, async () => {
    const outputFolder = resolve(`./test-results/compare/8-rerun/pages`);

    // Start from a clean slate so the assertion is about re-running comparePdf itself, not
    // about leftover artifacts from a previous test invocation.
    rmSync(resolve(`./test-results/compare/8-rerun`), { recursive: true, force: true });

    const opts = {
        pdfToPngConvertOptions: {
            outputFolder,
            outputFileMaskFunc: (pageNumber: number) => `rerun_${pageNumber}.png`,
            viewportScale: 1.0,
        },
        diffsOutputFolder: resolve(`./test-results/compare/8-rerun/diffs`),
    };

    // First run populates the output folder. The renderer writes PNGs with an exclusive-create
    // open, so a second run against the same folder must clear the reused names itself.
    await expect(comparePdf('./test-data/pdf1.pdf', './test-data/pdf11.pdf', opts)).resolves.toBeTruthy();
    await expect(comparePdf('./test-data/pdf1.pdf', './test-data/pdf11.pdf', opts)).resolves.toBeTruthy();

    expect(existsSync(resolve(outputFolder, 'actual/rerun_1.png'))).toBeTruthy();
    expect(existsSync(resolve(outputFolder, 'expected/rerun_1.png'))).toBeTruthy();
});

test(`should match exclusions by source pageNumber when rendering selected pages`, async () => {
    const compareResult: boolean = await comparePdf('./test-data/pdf1.pdf', './test-data/pdf2.pdf', {
        pdfToPngConvertOptions: {
            pagesToProcess: [2],
        },
        excludedAreas: [
            {
                pageNumber: 2,
                excludedAreas: [
                    {
                        x1: 680,
                        y1: 240,
                        x2: 955,
                        y2: 465,
                    },
                ],
            },
        ],
        diffsOutputFolder: resolve(`./test-results/compare/8-3`),
    });

    expect(compareResult).toBeTruthy();
});
