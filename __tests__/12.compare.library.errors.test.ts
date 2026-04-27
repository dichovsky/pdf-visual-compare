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

import { comparePdf } from '../src/comparePdf.js';
import { ComparePdfComparisonError, ComparePdfRenderingError } from '../src/index.js';

beforeEach(() => {
    comparePngMock.mockReset();
    pdfToPngMock.mockReset();
});

test(`should wrap PDF renderer failures with ComparePdfRenderingError and cause`, async () => {
    const renderCause = new Error('renderer exploded');
    pdfToPngMock.mockRejectedValueOnce(renderCause);

    const comparePromise = comparePdf(Buffer.from('actual-pdf'), Buffer.from('expected-pdf'));

    await expect(comparePromise).rejects.toThrow(ComparePdfRenderingError);
    await expect(comparePromise).rejects.toThrow('Failed to render actual PDF pages.');
    await expect(comparePromise).rejects.toMatchObject({
        cause: renderCause,
        message: 'Failed to render actual PDF pages.',
        name: 'ComparePdfRenderingError',
    });
});

test(`should wrap PNG comparator failures with ComparePdfComparisonError and cause`, async () => {
    const comparisonCause = new Error('comparator exploded');
    pdfToPngMock
        .mockResolvedValueOnce([{ name: 'page-1.png', pageNumber: 1, content: Buffer.from('actual-page-1') }])
        .mockResolvedValueOnce([{ name: 'page-1.png', pageNumber: 1, content: Buffer.from('expected-page-1') }]);
    comparePngMock.mockImplementationOnce(() => {
        throw comparisonCause;
    });

    const comparePromise = comparePdf(Buffer.from('actual-pdf'), Buffer.from('expected-pdf'));

    await expect(comparePromise).rejects.toThrow(ComparePdfComparisonError);
    await expect(comparePromise).rejects.toThrow('Failed to compare rendered PDF page 1.');
    await expect(comparePromise).rejects.toMatchObject({
        cause: comparisonCause,
        message: 'Failed to compare rendered PDF page 1.',
        name: 'ComparePdfComparisonError',
    });
});
