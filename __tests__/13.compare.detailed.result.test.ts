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

import { comparePdf, comparePdfDetailed } from '../src/comparePdf.js';

beforeEach(() => {
    comparePngMock.mockReset();
    pdfToPngMock.mockReset();
});

test(`should return structured page results with thresholds, mismatches, and diff paths`, async () => {
    const diffsOutputFolder = resolve(`./test-results/compare/13-1`);
    const pageTwoDiffFilePath = resolve(diffsOutputFolder, 'page-2-custom.png');

    pdfToPngMock
        .mockResolvedValueOnce([
            { name: 'actual-page-1.png', pageNumber: 1, content: Buffer.from('actual-page-1') },
            { name: 'actual-page-2.png', pageNumber: 2, content: Buffer.from('actual-page-2') },
        ])
        .mockResolvedValueOnce([
            { name: 'expected-page-1.png', pageNumber: 1, content: Buffer.from('expected-page-1') },
            { name: 'expected-page-2.png', pageNumber: 2, content: Buffer.from('expected-page-2') },
        ]);
    comparePngMock.mockReturnValueOnce(0).mockReturnValueOnce(7);

    await expect(
        comparePdfDetailed(Buffer.from('actual-pdf'), Buffer.from('expected-pdf'), {
            compareThreshold: 5,
            writeDiffs: true,
            diffsOutputFolder,
            excludedAreas: [
                {
                    pageNumber: 2,
                    diffFilePath: pageTwoDiffFilePath,
                    matchingThreshold: 10,
                },
            ],
        }),
    ).resolves.toEqual({
        isEqual: true,
        actualPageCount: 2,
        expectedPageCount: 2,
        compareThreshold: 5,
        writeDiffs: true,
        diffsOutputFolder,
        pages: [
            {
                pageNumber: 1,
                status: 'matched',
                isEqual: true,
                threshold: 5,
                mismatchCount: 0,
                diffFilePath: resolve(diffsOutputFolder, 'diff_actual-page-1.png'),
                actualPageName: 'actual-page-1.png',
                expectedPageName: 'expected-page-1.png',
            },
            {
                pageNumber: 2,
                status: 'matched',
                isEqual: true,
                threshold: 10,
                mismatchCount: 7,
                diffFilePath: pageTwoDiffFilePath,
                actualPageName: 'actual-page-2.png',
                expectedPageName: 'expected-page-2.png',
            },
        ],
    });
});

test(`should report missing expected pages without invoking the PNG comparator`, async () => {
    pdfToPngMock
        .mockResolvedValueOnce([{ name: 'actual-page-2.png', pageNumber: 2, content: Buffer.from('actual-page-2') }])
        .mockResolvedValueOnce([]);

    await expect(comparePdfDetailed(Buffer.from('actual-pdf'), Buffer.from('expected-pdf'))).resolves.toEqual({
        isEqual: false,
        actualPageCount: 1,
        expectedPageCount: 0,
        compareThreshold: 0,
        writeDiffs: false,
        diffsOutputFolder: null,
        pages: [
            {
                pageNumber: 2,
                status: 'missing-expected',
                isEqual: false,
                threshold: 0,
                mismatchCount: null,
                diffFilePath: null,
                actualPageName: 'actual-page-2.png',
                expectedPageName: null,
            },
        ],
    });

    expect(comparePngMock).not.toHaveBeenCalled();
});

test(`should report missing actual pages deterministically`, async () => {
    pdfToPngMock
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
            { name: 'expected-page-4.png', pageNumber: 4, content: Buffer.from('expected-page-4') },
        ]);

    await expect(comparePdfDetailed(Buffer.from('actual-pdf'), Buffer.from('expected-pdf'))).resolves.toEqual({
        isEqual: false,
        actualPageCount: 0,
        expectedPageCount: 1,
        compareThreshold: 0,
        writeDiffs: false,
        diffsOutputFolder: null,
        pages: [
            {
                pageNumber: 4,
                status: 'missing-actual',
                isEqual: false,
                threshold: 0,
                mismatchCount: null,
                diffFilePath: null,
                actualPageName: null,
                expectedPageName: 'expected-page-4.png',
            },
        ],
    });
});

test(`should order selected subset pages by pageNumber and surface missing counterparts deterministically`, async () => {
    pdfToPngMock
        .mockResolvedValueOnce([{ name: 'actual-page-4.png', pageNumber: 4, content: Buffer.from('actual-page-4') }])
        .mockResolvedValueOnce([
            { name: 'expected-page-2.png', pageNumber: 2, content: Buffer.from('expected-page-2') },
        ]);

    await expect(
        comparePdfDetailed(Buffer.from('actual-pdf'), Buffer.from('expected-pdf'), {
            pdfToPngConvertOptions: {
                pagesToProcess: [4, 2],
            },
        }),
    ).resolves.toEqual({
        isEqual: false,
        actualPageCount: 1,
        expectedPageCount: 1,
        compareThreshold: 0,
        writeDiffs: false,
        diffsOutputFolder: null,
        pages: [
            {
                pageNumber: 2,
                status: 'missing-actual',
                isEqual: false,
                threshold: 0,
                mismatchCount: null,
                diffFilePath: null,
                actualPageName: null,
                expectedPageName: 'expected-page-2.png',
            },
            {
                pageNumber: 4,
                status: 'missing-expected',
                isEqual: false,
                threshold: 0,
                mismatchCount: null,
                diffFilePath: null,
                actualPageName: 'actual-page-4.png',
                expectedPageName: null,
            },
        ],
    });

    expect(comparePngMock).not.toHaveBeenCalled();
});

test(`should keep comparePdf as a boolean wrapper over the detailed result`, async () => {
    const actualPages = [{ name: 'actual-page-1.png', pageNumber: 1, content: Buffer.from('actual-page-1') }];
    const expectedPages = [{ name: 'expected-page-1.png', pageNumber: 1, content: Buffer.from('expected-page-1') }];

    pdfToPngMock.mockResolvedValueOnce(actualPages).mockResolvedValueOnce(expectedPages);
    comparePngMock.mockReturnValueOnce(3);

    const detailedResult = await comparePdfDetailed(Buffer.from('actual-pdf'), Buffer.from('expected-pdf'), {
        compareThreshold: 2,
    });

    pdfToPngMock.mockReset();
    comparePngMock.mockReset();
    pdfToPngMock.mockResolvedValueOnce(actualPages).mockResolvedValueOnce(expectedPages);
    comparePngMock.mockReturnValueOnce(3);

    await expect(
        comparePdf(Buffer.from('actual-pdf'), Buffer.from('expected-pdf'), {
            compareThreshold: 2,
        }),
    ).resolves.toBe(detailedResult.isEqual);
});

test(`should render metadata first and then compare one page at a time`, async () => {
    pdfToPngMock
        .mockResolvedValueOnce([
            { name: 'actual-page-1.png', pageNumber: 1, content: undefined },
            { name: 'actual-page-2.png', pageNumber: 2, content: undefined },
        ])
        .mockResolvedValueOnce([
            { name: 'expected-page-1.png', pageNumber: 1, content: undefined },
            { name: 'expected-page-2.png', pageNumber: 2, content: undefined },
        ])
        .mockResolvedValueOnce([{ name: 'actual-page-1.png', pageNumber: 1, content: Buffer.from('actual-1') }])
        .mockResolvedValueOnce([{ name: 'expected-page-1.png', pageNumber: 1, content: Buffer.from('expected-1') }])
        .mockResolvedValueOnce([{ name: 'actual-page-2.png', pageNumber: 2, content: Buffer.from('actual-2') }])
        .mockResolvedValueOnce([{ name: 'expected-page-2.png', pageNumber: 2, content: Buffer.from('expected-2') }]);
    comparePngMock.mockReturnValue(0);

    await expect(comparePdfDetailed(Buffer.from('actual-pdf'), Buffer.from('expected-pdf'))).resolves.toMatchObject({
        isEqual: true,
        actualPageCount: 2,
        expectedPageCount: 2,
    });

    expect(pdfToPngMock).toHaveBeenCalledTimes(6);
    expect(pdfToPngMock).toHaveBeenNthCalledWith(
        1,
        Buffer.from('actual-pdf'),
        expect.objectContaining({ returnMetadataOnly: true, returnPageContent: false }),
    );
    expect(pdfToPngMock).toHaveBeenNthCalledWith(
        2,
        Buffer.from('expected-pdf'),
        expect.objectContaining({ returnMetadataOnly: true, returnPageContent: false }),
    );
    expect(pdfToPngMock).toHaveBeenNthCalledWith(
        3,
        Buffer.from('actual-pdf'),
        expect.objectContaining({ pagesToProcess: [1] }),
    );
    expect(pdfToPngMock).toHaveBeenNthCalledWith(
        4,
        Buffer.from('expected-pdf'),
        expect.objectContaining({ pagesToProcess: [1] }),
    );
    expect(pdfToPngMock).toHaveBeenNthCalledWith(
        5,
        Buffer.from('actual-pdf'),
        expect.objectContaining({ pagesToProcess: [2] }),
    );
    expect(pdfToPngMock).toHaveBeenNthCalledWith(
        6,
        Buffer.from('expected-pdf'),
        expect.objectContaining({ pagesToProcess: [2] }),
    );
});
