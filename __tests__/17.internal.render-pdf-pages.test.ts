import { Buffer } from 'node:buffer';
import { expect, test, vi } from 'vitest';
import { ComparePdfRenderingError } from '../src/errors/ComparePdfRenderingError.js';
import { renderPdfPages } from '../src/internal/renderPdfPages.js';

const { pdfToPngMock } = vi.hoisted(() => ({
    pdfToPngMock: vi.fn(),
}));

vi.mock('pdf-to-png-converter', () => ({
    pdfToPng: pdfToPngMock,
}));

test(`should rethrow library rendering errors from non-array renderer output`, async () => {
    pdfToPngMock.mockResolvedValueOnce(undefined);
    const renderPromise = renderPdfPages(Buffer.from('dummy'), {}, 'actual');

    await expect(renderPromise).rejects.toThrow(ComparePdfRenderingError);
    await expect(renderPromise).rejects.toThrow('Failed to render actual PDF pages.');
});
