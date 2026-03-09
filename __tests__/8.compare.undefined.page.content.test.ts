import { vi, expect, test } from 'vitest';

vi.mock('pdf-to-png-converter', () => ({
    pdfToPng: vi
        .fn()
        .mockResolvedValueOnce([{ name: 'comparePdf_1.png', content: undefined }])
        .mockResolvedValueOnce([{ name: 'comparePdf_1.png', content: Buffer.from('dummy') }]),
}));

test(`should throw when page content is undefined`, async () => {
    const { comparePdf } = await import('../src/comparePdf.js');
    await expect(comparePdf('./test-data/pdf1.pdf', './test-data/pdf1.pdf')).rejects.toThrow(
        'Page content is undefined for page: comparePdf_1.png',
    );
});
