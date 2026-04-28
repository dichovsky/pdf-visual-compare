import { expect, test, vi } from 'vitest';
import { ComparePdfRenderingError } from '../src/index.js';

vi.mock('pdf-to-png-converter', () => ({
    pdfToPng: vi
        .fn()
        .mockResolvedValueOnce([{ name: 'comparePdf_1.png', pageNumber: 1 }])
        .mockResolvedValueOnce([{ name: 'comparePdf_1.png', pageNumber: 1 }])
        .mockResolvedValueOnce([{ name: 'comparePdf_1.png', pageNumber: 1, content: undefined }]),
}));

test(`should throw when page content is undefined`, async () => {
    const { comparePdf } = await import('../src/comparePdf.js');
    const comparePromise = comparePdf('./test-data/pdf1.pdf', './test-data/pdf1.pdf');

    await expect(comparePromise).rejects.toThrow(ComparePdfRenderingError);
    await expect(comparePromise).rejects.toThrow('Rendered page content is missing for page: comparePdf_1.png.');
});
