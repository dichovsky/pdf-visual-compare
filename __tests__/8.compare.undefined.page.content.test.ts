import { vi, expect, test } from 'vitest';

vi.mock('pdf-to-png-converter', () => ({
    pdfToPng: vi.fn().mockResolvedValue([{ name: 'comparePdf_1.png', content: undefined }]),
}));

test(`should throw when page content is undefined`, async () => {
    const { comparePdf } = await import('../src/comparePdf.js');
    await expect(comparePdf('./test-data/pdf1.pdf', './test-data/pdf1.pdf')).rejects.toThrow(
        'Page content is undefined for page: comparePdf_1.png',
    );
});
