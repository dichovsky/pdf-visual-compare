import { beforeEach, expect, test, vi } from 'vitest';

const { comparePngMock, pdfToPngMock } = vi.hoisted(() => ({
    comparePngMock: vi.fn(),
    pdfToPngMock: vi.fn(),
}));

vi.mock('pdf-to-png-converter', () => ({ pdfToPng: pdfToPngMock }));
vi.mock('png-visual-compare', () => ({ comparePng: comparePngMock }));

import { comparePdfDetailed } from '../src/comparePdf.js';

function renderedPage(name: string, pageNumber: number) {
    return { name, pageNumber, width: 100, height: 100, content: Buffer.from(name) };
}

beforeEach(() => {
    comparePngMock.mockReset();
    pdfToPngMock.mockReset();
});

test(`compares only the pages selected by a range spec, leaving page counts intact`, async () => {
    pdfToPngMock
        .mockResolvedValueOnce([renderedPage('a1', 1), renderedPage('a2', 2), renderedPage('a3', 3)])
        .mockResolvedValueOnce([renderedPage('e1', 1), renderedPage('e2', 2), renderedPage('e3', 3)]);
    comparePngMock.mockReturnValue(0);

    const result = await comparePdfDetailed(Buffer.from('a'), Buffer.from('e'), { pages: '1,3' });

    expect(result.actualPageCount).toBe(3);
    expect(result.expectedPageCount).toBe(3);
    expect(result.pages.map((page) => page.pageNumber)).toEqual([1, 3]);
    expect(result.summary.totalPages).toBe(2);
    expect(comparePngMock).toHaveBeenCalledTimes(2);
});

test(`accepts an explicit array of page numbers`, async () => {
    pdfToPngMock
        .mockResolvedValueOnce([renderedPage('a1', 1), renderedPage('a2', 2), renderedPage('a3', 3)])
        .mockResolvedValueOnce([renderedPage('e1', 1), renderedPage('e2', 2), renderedPage('e3', 3)]);
    comparePngMock.mockReturnValue(0);

    const result = await comparePdfDetailed(Buffer.from('a'), Buffer.from('e'), { pages: [2] });

    expect(result.pages.map((page) => page.pageNumber)).toEqual([2]);
    expect(comparePngMock).toHaveBeenCalledTimes(1);
});

test(`reports a selected page present in only one PDF as a missing counterpart`, async () => {
    pdfToPngMock
        .mockResolvedValueOnce([renderedPage('a1', 1), renderedPage('a2', 2)])
        .mockResolvedValueOnce([renderedPage('e1', 1)]);

    const result = await comparePdfDetailed(Buffer.from('a'), Buffer.from('e'), { pages: '2' });

    expect(result.pages).toHaveLength(1);
    expect(result.pages[0]).toMatchObject({ pageNumber: 2, status: 'missing-expected' });
    expect(comparePngMock).not.toHaveBeenCalled();
});

test(`throws when the selection matches no rendered page in either PDF`, async () => {
    pdfToPngMock.mockResolvedValueOnce([renderedPage('a1', 1)]).mockResolvedValueOnce([renderedPage('e1', 1)]);

    await expect(comparePdfDetailed(Buffer.from('a'), Buffer.from('e'), { pages: '5' })).rejects.toThrow(
        'pages selection matched no rendered page in either PDF.',
    );
    expect(comparePngMock).not.toHaveBeenCalled();
});

test(`ignores non-existent pages as long as the selection still matches at least one page`, async () => {
    pdfToPngMock
        .mockResolvedValueOnce([renderedPage('a1', 1), renderedPage('a2', 2)])
        .mockResolvedValueOnce([renderedPage('e1', 1), renderedPage('e2', 2)]);
    comparePngMock.mockReturnValue(0);

    const result = await comparePdfDetailed(Buffer.from('a'), Buffer.from('e'), { pages: '1,99' });

    expect(result.pages.map((page) => page.pageNumber)).toEqual([1]);
    expect(comparePngMock).toHaveBeenCalledTimes(1);
});
