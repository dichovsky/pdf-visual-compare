import { beforeEach, expect, test, vi } from 'vitest';

const { comparePngMock, pdfToPngMock } = vi.hoisted(() => ({
    comparePngMock: vi.fn(),
    pdfToPngMock: vi.fn(),
}));

vi.mock('pdf-to-png-converter', () => ({ pdfToPng: pdfToPngMock }));
vi.mock('png-visual-compare', () => ({ comparePng: comparePngMock }));

import { comparePdf, comparePdfDetailed } from '../src/comparePdf.js';

// 100 x 100 = 10000 pixels, so a mismatch count of N renders as N/100 percent.
function renderedPage(name: string, pageNumber: number) {
    return { name, pageNumber, width: 100, height: 100, content: Buffer.from(name) };
}

beforeEach(() => {
    comparePngMock.mockReset();
    pdfToPngMock.mockReset();
});

test(`a page over the pixel threshold passes when within the percentage threshold`, async () => {
    pdfToPngMock.mockResolvedValueOnce([renderedPage('a1', 1)]).mockResolvedValueOnce([renderedPage('e1', 1)]);
    comparePngMock.mockReturnValueOnce(50); // 0.5%

    const result = await comparePdfDetailed(Buffer.from('a'), Buffer.from('e'), {
        compareThreshold: 0,
        compareThresholdPercent: 1,
    });

    expect(result.isEqual).toBe(true);
    expect(result.compareThresholdPercent).toBe(1);
    expect(result.pages[0]).toMatchObject({
        status: 'matched',
        isEqual: true,
        threshold: 0,
        thresholdPercent: 1,
        mismatchCount: 50,
        mismatchPercent: 0.5,
    });
});

test(`a page over both the pixel and percentage thresholds is reported as mismatched`, async () => {
    pdfToPngMock.mockResolvedValueOnce([renderedPage('a1', 1)]).mockResolvedValueOnce([renderedPage('e1', 1)]);
    comparePngMock.mockReturnValueOnce(200); // 2%

    const result = await comparePdfDetailed(Buffer.from('a'), Buffer.from('e'), {
        compareThreshold: 0,
        compareThresholdPercent: 1,
    });

    expect(result.isEqual).toBe(false);
    expect(result.pages[0]).toMatchObject({ status: 'mismatched', isEqual: false, mismatchPercent: 2 });
});

test(`per-page matchingThresholdPercent overrides the document percentage threshold`, async () => {
    pdfToPngMock
        .mockResolvedValueOnce([renderedPage('a1', 1), renderedPage('a2', 2)])
        .mockResolvedValueOnce([renderedPage('e1', 1), renderedPage('e2', 2)]);
    comparePngMock.mockReturnValueOnce(50).mockReturnValueOnce(50); // both 0.5%

    const result = await comparePdfDetailed(Buffer.from('a'), Buffer.from('e'), {
        compareThreshold: 0,
        compareThresholdPercent: 0.1, // page 1 fails: 0.5 > 0.1
        excludedAreas: [{ pageNumber: 2, matchingThresholdPercent: 5 }], // page 2 passes: 0.5 <= 5
    });

    expect(result.isEqual).toBe(false);
    expect(result.pages[0]).toMatchObject({ pageNumber: 1, status: 'mismatched', thresholdPercent: 0.1 });
    expect(result.pages[1]).toMatchObject({ pageNumber: 2, status: 'matched', thresholdPercent: 5 });
});

test(`compareThresholdPercent: 0 cannot tighten a permissive pixel threshold (OR semantics)`, async () => {
    pdfToPngMock.mockResolvedValueOnce([renderedPage('a1', 1)]).mockResolvedValueOnce([renderedPage('e1', 1)]);
    comparePngMock.mockReturnValueOnce(50); // 0.5%

    const result = await comparePdfDetailed(Buffer.from('a'), Buffer.from('e'), {
        compareThreshold: 100, // 50 <= 100 -> withinPixels true
        compareThresholdPercent: 0, // 0.5 > 0 -> withinPercent false
    });

    // withinPixels wins via OR: the page passes even though mismatchPercent > compareThresholdPercent.
    expect(result.isEqual).toBe(true);
    expect(result.pages[0]).toMatchObject({ isEqual: true, mismatchPercent: 0.5, thresholdPercent: 0 });
});

test(`the comparePdf boolean reflects percentage-threshold passing`, async () => {
    pdfToPngMock.mockResolvedValueOnce([renderedPage('a1', 1)]).mockResolvedValueOnce([renderedPage('e1', 1)]);
    comparePngMock.mockReturnValueOnce(50);

    await expect(
        comparePdf(Buffer.from('a'), Buffer.from('e'), { compareThreshold: 0, compareThresholdPercent: 1 }),
    ).resolves.toBe(true);
});
