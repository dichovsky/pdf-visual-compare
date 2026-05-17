import { existsSync, mkdirSync, rmSync } from 'node:fs';
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

import { ComparePdfComparisonError, comparePdf } from '../src/index.js';

const TEST_ROOT = resolve('./test-results/compare/18-placeholder-cleanup');

beforeEach(() => {
    comparePngMock.mockReset();
    pdfToPngMock.mockReset();
    rmSync(TEST_ROOT, { recursive: true, force: true });
    mkdirSync(TEST_ROOT, { recursive: true });
});

test('should discard the pre-created placeholder when comparePng throws (writeDiffs=true)', async () => {
    const diffsOutputFolder = resolve(TEST_ROOT, 'comparator-throw');
    mkdirSync(diffsOutputFolder, { recursive: true });

    pdfToPngMock
        // First call: metadata-only listing for actual PDF.
        .mockResolvedValueOnce([{ name: 'page-1.png', pageNumber: 1, kind: 'metadata' }])
        // Second call: metadata-only listing for expected PDF.
        .mockResolvedValueOnce([{ name: 'page-1.png', pageNumber: 1, kind: 'metadata' }])
        // Third call: actual page 1 content render.
        .mockResolvedValueOnce([
            { name: 'page-1.png', pageNumber: 1, content: Buffer.from('actual-bytes'), kind: 'content' },
        ])
        // Fourth call: expected page 1 content render.
        .mockResolvedValueOnce([
            { name: 'page-1.png', pageNumber: 1, content: Buffer.from('expected-bytes'), kind: 'content' },
        ]);

    comparePngMock.mockImplementationOnce(() => {
        throw new Error('comparator detonated mid-write');
    });

    const expectedPlaceholder = resolve(diffsOutputFolder, 'diff_page-1.png');

    await expect(
        comparePdf(Buffer.from('actual-pdf'), Buffer.from('expected-pdf'), {
            writeDiffs: true,
            diffsOutputFolder,
        }),
    ).rejects.toThrow(ComparePdfComparisonError);

    // The pre-created placeholder must NOT leak into the diffs folder when the comparator
    // throws — otherwise CI artifact pipelines see a zero-byte file that looks like a real diff.
    expect(existsSync(expectedPlaceholder)).toBe(false);
});
