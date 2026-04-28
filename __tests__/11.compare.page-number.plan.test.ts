import { existsSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { beforeEach, expect, test, vi } from 'vitest';

const { comparePngMock, pdfToPngMock } = vi.hoisted(() => ({
    comparePngMock: vi.fn(),
    pdfToPngMock: vi.fn(),
}));

vi.mock('pdf-to-png-converter', () => ({
    pdfToPng: pdfToPngMock,
}));

vi.mock('png-visual-compare', () => ({
    comparePng: comparePngMock,
}));

import { ComparePdfConfigurationError, comparePdf } from '../src';

beforeEach(() => {
    comparePngMock.mockReset();
    pdfToPngMock.mockReset();
});

test(`should apply exclusions and thresholds by pageNumber when rendering selected pages`, async () => {
    const actualPageContent = Buffer.from('actual-page-2');
    const expectedPageContent = Buffer.from('expected-page-2');

    pdfToPngMock
        .mockResolvedValueOnce([{ name: 'actual-selected-page.png', pageNumber: 2, content: actualPageContent }])
        .mockResolvedValueOnce([{ name: 'expected-selected-page.png', pageNumber: 2, content: expectedPageContent }]);
    comparePngMock.mockReturnValueOnce(5);

    await expect(
        comparePdf(Buffer.from('actual-pdf'), Buffer.from('expected-pdf'), {
            compareThreshold: 0,
            writeDiffs: true,
            diffsOutputFolder: resolve(`./test-results/compare/11-1`),
            pdfToPngConvertOptions: {
                pagesToProcess: [2],
            },
            excludedAreas: [
                {
                    pageNumber: 2,
                    excludedAreas: [{ x1: 1, y1: 2, x2: 3, y2: 4 }],
                    excludedAreaColor: { r: 255, g: 255, b: 255 },
                    matchingThreshold: 5,
                },
            ],
        }),
    ).resolves.toBeTruthy();

    expect(comparePngMock).toHaveBeenCalledTimes(1);
    expect(comparePngMock).toHaveBeenCalledWith(
        actualPageContent,
        expectedPageContent,
        expect.objectContaining({
            excludedAreas: [{ x1: 1, y1: 2, x2: 3, y2: 4 }],
            excludedAreaColor: { r: 255, g: 255, b: 255 },
            diffFilePath: resolve(`./test-results/compare/11-1`, 'diff_actual-selected-page.png'),
            throwErrorOnInvalidInputData: true,
        }),
    );
});

test(`should use the first matching exclusion deterministically for selected subset pages`, async () => {
    const actualPageContent = Buffer.from('actual-page-2');
    const expectedPageContent = Buffer.from('expected-page-2');
    const diffsOutputFolder = resolve(`./test-results/compare/11-1b`);
    const firstDiffFilePath = resolve(diffsOutputFolder, 'first-page-2.png');

    pdfToPngMock
        .mockResolvedValueOnce([{ name: 'actual-selected-page.png', pageNumber: 2, content: actualPageContent }])
        .mockResolvedValueOnce([{ name: 'expected-selected-page.png', pageNumber: 2, content: expectedPageContent }]);
    comparePngMock.mockReturnValueOnce(1);

    await expect(
        comparePdf(Buffer.from('actual-pdf'), Buffer.from('expected-pdf'), {
            compareThreshold: 0,
            writeDiffs: true,
            diffsOutputFolder,
            pdfToPngConvertOptions: {
                pagesToProcess: [2],
            },
            excludedAreas: [
                {
                    pageNumber: 2,
                    excludedAreas: [{ x1: 1, y1: 2, x2: 3, y2: 4 }],
                    matchingThreshold: 1,
                    diffFilePath: firstDiffFilePath,
                },
                {
                    pageNumber: 2,
                    excludedAreas: [{ x1: 10, y1: 20, x2: 30, y2: 40 }],
                    matchingThreshold: 0,
                    diffFilePath: resolve(diffsOutputFolder, 'second-page-2.png'),
                },
            ],
        }),
    ).resolves.toBeTruthy();

    expect(comparePngMock).toHaveBeenCalledTimes(1);
    expect(comparePngMock).toHaveBeenCalledWith(
        actualPageContent,
        expectedPageContent,
        expect.objectContaining({
            excludedAreas: [{ x1: 1, y1: 2, x2: 3, y2: 4 }],
            diffFilePath: firstDiffFilePath,
            throwErrorOnInvalidInputData: true,
        }),
    );
});

test(`should pair rendered pages by pageNumber instead of rendered file name`, async () => {
    const actualPageContent = Buffer.from('actual-page-1');
    const expectedPageContent = Buffer.from('expected-page-1');

    pdfToPngMock
        .mockResolvedValueOnce([{ name: 'custom-actual-mask.png', pageNumber: 1, content: actualPageContent }])
        .mockResolvedValueOnce([{ name: 'totally-different-expected-mask.png', pageNumber: 1, content: expectedPageContent }]);
    comparePngMock.mockReturnValueOnce(0);

    await expect(
        comparePdf(Buffer.from('actual-pdf'), Buffer.from('expected-pdf'), {
            writeDiffs: true,
            diffsOutputFolder: resolve(`./test-results/compare/11-2`),
            pdfToPngConvertOptions: {
                outputFileMaskFunc: (pageNumber: number) => `custom_${pageNumber}.png`,
            },
        }),
    ).resolves.toBeTruthy();

    expect(comparePngMock).toHaveBeenCalledTimes(1);
    expect(comparePngMock).toHaveBeenCalledWith(
        actualPageContent,
        expectedPageContent,
        expect.objectContaining({
            diffFilePath: resolve(`./test-results/compare/11-2`, 'diff_custom-actual-mask.png'),
        }),
    );
});

test(`should return false for missing counterpart pages without invoking the PNG comparator`, async () => {
    pdfToPngMock
        .mockResolvedValueOnce([{ name: 'page-2.png', pageNumber: 2, content: Buffer.from('actual-page-2') }])
        .mockResolvedValueOnce([]);

    await expect(comparePdf(Buffer.from('actual-pdf'), Buffer.from('expected-pdf'))).resolves.toBeFalsy();

    expect(comparePngMock).not.toHaveBeenCalled();
});

test(`should allow per-page diffFilePath overrides inside diffsOutputFolder`, async () => {
    const actualPageContent = Buffer.from('actual-page-1');
    const expectedPageContent = Buffer.from('expected-page-1');
    const diffsOutputFolder = resolve(`./test-results/compare/11-3`);
    const diffFilePath = resolve(diffsOutputFolder, 'nested', 'diff_page-1.png');

    pdfToPngMock
        .mockResolvedValueOnce([{ name: 'page-1.png', pageNumber: 1, content: actualPageContent }])
        .mockResolvedValueOnce([{ name: 'page-1-expected.png', pageNumber: 1, content: expectedPageContent }]);
    comparePngMock.mockReturnValueOnce(0);

    await expect(
        comparePdf(Buffer.from('actual-pdf'), Buffer.from('expected-pdf'), {
            writeDiffs: true,
            diffsOutputFolder,
            excludedAreas: [{ pageNumber: 1, diffFilePath }],
        }),
    ).resolves.toBeTruthy();

    expect(comparePngMock).toHaveBeenCalledWith(
        actualPageContent,
        expectedPageContent,
        expect.objectContaining({ diffFilePath }),
    );
});

test(`should reject per-page diffFilePath overrides that escape diffsOutputFolder`, async () => {
    const actualPageContent = Buffer.from('actual-page-1');
    const expectedPageContent = Buffer.from('expected-page-1');
    const diffsOutputFolder = resolve(`./test-results/compare/11-4`);

    pdfToPngMock
        .mockResolvedValueOnce([{ name: 'page-1.png', pageNumber: 1, content: actualPageContent }])
        .mockResolvedValueOnce([{ name: 'page-1-expected.png', pageNumber: 1, content: expectedPageContent }]);

    const comparePromise = comparePdf(Buffer.from('actual-pdf'), Buffer.from('expected-pdf'), {
        writeDiffs: true,
        diffsOutputFolder,
        excludedAreas: [
            {
                pageNumber: 1,
                diffFilePath: resolve(diffsOutputFolder, '..', 'escaped.png'),
            },
        ],
    });

    await expect(comparePromise).rejects.toThrow(ComparePdfConfigurationError);
    await expect(comparePromise).rejects.toThrow(
        `Diff output path must stay within diffsOutputFolder: ${diffsOutputFolder}`,
    );

    expect(pdfToPngMock).not.toHaveBeenCalled();
    expect(comparePngMock).not.toHaveBeenCalled();
});

test(`should reject generated diff paths that escape diffsOutputFolder`, async () => {
    const actualPageContent = Buffer.from('actual-page-1');
    const expectedPageContent = Buffer.from('expected-page-1');
    const diffsOutputFolder = resolve(`./test-results/compare/11-5`);

    pdfToPngMock
        .mockResolvedValueOnce([{ name: '../escaped.png', pageNumber: 1, content: actualPageContent }])
        .mockResolvedValueOnce([{ name: 'expected-page-1.png', pageNumber: 1, content: expectedPageContent }]);

    const comparePromise = comparePdf(Buffer.from('actual-pdf'), Buffer.from('expected-pdf'), {
        writeDiffs: true,
        diffsOutputFolder,
    });

    await expect(comparePromise).rejects.toThrow(ComparePdfConfigurationError);
    await expect(comparePromise).rejects.toThrow(
        `Diff output path must stay within diffsOutputFolder: ${diffsOutputFolder}`,
    );

    expect(comparePngMock).not.toHaveBeenCalled();
});

test(`should wrap diff output directory creation failures`, async () => {
    const actualPageContent = Buffer.from('actual-page-1');
    const expectedPageContent = Buffer.from('expected-page-1');
    const diffsOutputFolder = resolve(`./test-results/compare/11-6`);
    const blockingPath = resolve(diffsOutputFolder, 'blocking-file');
    const diffFilePath = resolve(blockingPath, 'diff_page-1.png');

    await rm(diffsOutputFolder, { recursive: true, force: true });
    await mkdir(diffsOutputFolder, { recursive: true });
    await writeFile(blockingPath, 'not-a-directory');

    pdfToPngMock
        .mockResolvedValueOnce([{ name: 'page-1.png', pageNumber: 1, content: actualPageContent }])
        .mockResolvedValueOnce([{ name: 'page-1-expected.png', pageNumber: 1, content: expectedPageContent }]);

    try {
        const comparePromise = comparePdf(Buffer.from('actual-pdf'), Buffer.from('expected-pdf'), {
            writeDiffs: true,
            diffsOutputFolder,
            excludedAreas: [{ pageNumber: 1, diffFilePath }],
        });

        await expect(comparePromise).rejects.toThrow(ComparePdfConfigurationError);
        await expect(comparePromise).rejects.toThrow(
            `diffsOutputFolder must point to a writable directory: ${diffsOutputFolder}`,
        );

        expect(comparePngMock).not.toHaveBeenCalled();
    } finally {
        await rm(diffsOutputFolder, { recursive: true, force: true });
    }
});

test(`should reject symlinked ancestor directories in diffsOutputFolder`, async () => {
    const symlinkBase = resolve(`./test-results/compare/11-7-link`);
    const symlinkTarget = resolve(`./test-results/compare/11-7-target`);
    const diffsOutputFolder = resolve(symlinkBase, 'nested');

    await rm(symlinkBase, { recursive: true, force: true });
    await rm(symlinkTarget, { recursive: true, force: true });
    await mkdir(symlinkTarget, { recursive: true });
    await symlink(symlinkTarget, symlinkBase);

    try {
        const comparePromise = comparePdf(Buffer.from('actual-pdf'), Buffer.from('expected-pdf'), {
            writeDiffs: true,
            diffsOutputFolder,
        });

        await expect(comparePromise).rejects.toThrow(ComparePdfConfigurationError);
        await expect(comparePromise).rejects.toThrow(
            `Diff output path must stay within diffsOutputFolder: ${diffsOutputFolder}`,
        );

        expect(pdfToPngMock).not.toHaveBeenCalled();
        expect(comparePngMock).not.toHaveBeenCalled();
    } finally {
        await rm(symlinkBase, { recursive: true, force: true });
        await rm(symlinkTarget, { recursive: true, force: true });
    }
});

test(`should reject symlinked diff paths that escape diffsOutputFolder`, async () => {
    const actualPageContent = Buffer.from('actual-page-1');
    const expectedPageContent = Buffer.from('expected-page-1');
    const diffsOutputFolder = resolve(`./test-results/compare/11-6-root`);
    const outsideFolder = resolve(`./test-results/compare/11-6-outside`);
    const symlinkPath = resolve(diffsOutputFolder, 'linked');
    const escapedDirectory = resolve(outsideFolder, 'nested');

    rmSync(diffsOutputFolder, { force: true, recursive: true });
    rmSync(outsideFolder, { force: true, recursive: true });
    mkdirSync(diffsOutputFolder, { recursive: true });
    mkdirSync(outsideFolder, { recursive: true });
    symlinkSync(outsideFolder, symlinkPath);

    pdfToPngMock
        .mockResolvedValueOnce([{ name: 'page-1.png', pageNumber: 1, content: actualPageContent }])
        .mockResolvedValueOnce([{ name: 'page-1-expected.png', pageNumber: 1, content: expectedPageContent }]);

    const comparePromise = comparePdf(Buffer.from('actual-pdf'), Buffer.from('expected-pdf'), {
        writeDiffs: true,
        diffsOutputFolder,
        excludedAreas: [
            {
                pageNumber: 1,
                diffFilePath: resolve(symlinkPath, 'nested', 'escaped.png'),
            },
        ],
    });

    await expect(comparePromise).rejects.toThrow(ComparePdfConfigurationError);
    await expect(comparePromise).rejects.toThrow(
        `Diff output path must stay within diffsOutputFolder: ${diffsOutputFolder}`,
    );

    expect(comparePngMock).not.toHaveBeenCalled();
    expect(existsSync(escapedDirectory)).toBeFalsy();
});

test(`should reject diff output paths that target a symlinked file inside diffsOutputFolder`, async () => {
    const actualPageContent = Buffer.from('actual-page-1');
    const expectedPageContent = Buffer.from('expected-page-1');
    const diffsOutputFolder = resolve(`./test-results/compare/11-7-root`);
    const outsideFolder = resolve(`./test-results/compare/11-7-outside`);
    const symlinkedFilePath = resolve(diffsOutputFolder, 'diff_page-1.png');

    rmSync(diffsOutputFolder, { force: true, recursive: true });
    rmSync(outsideFolder, { force: true, recursive: true });
    mkdirSync(diffsOutputFolder, { recursive: true });
    mkdirSync(outsideFolder, { recursive: true });
    symlinkSync(resolve(outsideFolder, 'escaped.png'), symlinkedFilePath);

    pdfToPngMock
        .mockResolvedValueOnce([{ name: 'page-1.png', pageNumber: 1, content: actualPageContent }])
        .mockResolvedValueOnce([{ name: 'page-1-expected.png', pageNumber: 1, content: expectedPageContent }]);

    const comparePromise = comparePdf(Buffer.from('actual-pdf'), Buffer.from('expected-pdf'), {
        writeDiffs: true,
        diffsOutputFolder,
        excludedAreas: [
            {
                pageNumber: 1,
                diffFilePath: symlinkedFilePath,
            },
        ],
    });

    await expect(comparePromise).rejects.toThrow(ComparePdfConfigurationError);
    await expect(comparePromise).rejects.toThrow(
        `Diff output path must stay within diffsOutputFolder: ${diffsOutputFolder}`,
    );

    expect(comparePngMock).not.toHaveBeenCalled();
});

test(`should ignore exclusions for pages that were not rendered`, async () => {
    const actualPageContent = Buffer.from('actual-page-2');
    const expectedPageContent = Buffer.from('expected-page-2');

    pdfToPngMock
        .mockResolvedValueOnce([{ name: 'selected-page-2.png', pageNumber: 2, content: actualPageContent }])
        .mockResolvedValueOnce([{ name: 'selected-page-2-expected.png', pageNumber: 2, content: expectedPageContent }]);
    comparePngMock.mockReturnValueOnce(0);

    await expect(
        comparePdf(Buffer.from('actual-pdf'), Buffer.from('expected-pdf'), {
            pdfToPngConvertOptions: {
                pagesToProcess: [2],
            },
            excludedAreas: [
                {
                    pageNumber: 1,
                    excludedAreas: [{ x1: 10, y1: 20, x2: 30, y2: 40 }],
                },
            ],
        }),
    ).resolves.toBeTruthy();

    expect(comparePngMock).toHaveBeenCalledTimes(1);
});
