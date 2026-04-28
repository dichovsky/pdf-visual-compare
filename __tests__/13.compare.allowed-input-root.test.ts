import { readFileSync } from 'node:fs';
import { cp, mkdir, rm, symlink } from 'node:fs/promises';
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

import { comparePdf, ComparePdfConfigurationError } from '../src/index.js';

beforeEach(() => {
    comparePngMock.mockReset();
    pdfToPngMock.mockReset();
});

test('should allow in-root string PDF paths when allowedInputRoot is configured', async () => {
    pdfToPngMock
        .mockResolvedValueOnce([{ name: 'page-1.png', pageNumber: 1, content: Buffer.from('actual-page-1') }])
        .mockResolvedValueOnce([{ name: 'page-1.png', pageNumber: 1, content: Buffer.from('expected-page-1') }]);
    comparePngMock.mockReturnValueOnce(0);

    await expect(
        comparePdf('./test-data/pdf1.pdf', './test-data/pdf11.pdf', {
            allowedInputRoot: './test-data',
        }),
    ).resolves.toBe(true);

    expect(pdfToPngMock).toHaveBeenNthCalledWith(1, readFileSync(resolve('./test-data/pdf1.pdf')), expect.any(Object));
    expect(pdfToPngMock).toHaveBeenNthCalledWith(2, readFileSync(resolve('./test-data/pdf11.pdf')), expect.any(Object));
});

test('should reject actual string PDF paths outside allowedInputRoot', async () => {
    const comparePromise = comparePdf('./README.md', './test-data/pdf11.pdf', {
        allowedInputRoot: './test-data',
    });

    await expect(comparePromise).rejects.toThrow(ComparePdfConfigurationError);
    await expect(comparePromise).rejects.toThrow('actualPdf must resolve within allowedInputRoot: ./test-data');
});

test('should reject expected string PDF paths outside allowedInputRoot', async () => {
    const comparePromise = comparePdf('./test-data/pdf1.pdf', './README.md', {
        allowedInputRoot: './test-data',
    });

    await expect(comparePromise).rejects.toThrow(ComparePdfConfigurationError);
    await expect(comparePromise).rejects.toThrow('expectedPdf must resolve within allowedInputRoot: ./test-data');
});

test.each([null, false, 0, ''])('should reject invalid allowedInputRoot value %s', async (allowedInputRoot) => {
    const comparePromise = comparePdf('./test-data/pdf1.pdf', './test-data/pdf11.pdf', {
        allowedInputRoot: allowedInputRoot as never,
    });

    await expect(comparePromise).rejects.toThrow(ComparePdfConfigurationError);
    await expect(comparePromise).rejects.toThrow('allowedInputRoot must be a non-empty string.');
});

test('should reject missing allowedInputRoot directories', async () => {
    const comparePromise = comparePdf('./test-data/pdf1.pdf', './test-data/pdf11.pdf', {
        allowedInputRoot: './test-data/missing-root',
    });

    await expect(comparePromise).rejects.toThrow(ComparePdfConfigurationError);
    await expect(comparePromise).rejects.toThrow('allowedInputRoot does not exist: ./test-data/missing-root');
});

test('should reject allowedInputRoot values that point to a file', async () => {
    const comparePromise = comparePdf('./test-data/pdf1.pdf', './test-data/pdf11.pdf', {
        allowedInputRoot: './README.md',
    });

    await expect(comparePromise).rejects.toThrow(ComparePdfConfigurationError);
    await expect(comparePromise).rejects.toThrow('allowedInputRoot must point to an existing directory: ./README.md');
});

test('should still throw file-not-found for missing in-root paths', async () => {
    const comparePromise = comparePdf('./test-data/missing.pdf', './test-data/pdf11.pdf', {
        allowedInputRoot: './test-data',
    });

    await expect(comparePromise).rejects.toThrow('PDF file not found: ./test-data/missing.pdf');
});

test('should reject symlinked string PDF paths that escape allowedInputRoot', async () => {
    const root = resolve('./test-results/allowed-input-root');
    const expectedPdfPath = resolve(root, 'expected.pdf');
    const escapedActualPath = resolve(root, 'escaped-actual.pdf');

    await rm(root, { recursive: true, force: true });
    await mkdir(root, { recursive: true });
    await cp('./test-data/pdf11.pdf', expectedPdfPath);
    await symlink(resolve('./README.md'), escapedActualPath);

    try {
        const comparePromise = comparePdf(escapedActualPath, expectedPdfPath, {
            allowedInputRoot: root,
        });

        await expect(comparePromise).rejects.toThrow(ComparePdfConfigurationError);
        await expect(comparePromise).rejects.toThrow(`actualPdf must resolve within allowedInputRoot: ${root}`);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test('should reject blank per-page diffFilePath values before PNG comparison', async () => {
    pdfToPngMock
        .mockResolvedValueOnce([{ name: 'page-1.png', pageNumber: 1, content: Buffer.from('actual-page-1') }])
        .mockResolvedValueOnce([{ name: 'page-1.png', pageNumber: 1, content: Buffer.from('expected-page-1') }]);

    const comparePromise = comparePdf(Buffer.from('actual-pdf'), Buffer.from('expected-pdf'), {
        excludedAreas: [{ pageNumber: 1, diffFilePath: '   ' }],
    });

    await expect(comparePromise).rejects.toThrow(ComparePdfConfigurationError);
    await expect(comparePromise).rejects.toThrow('diffFilePath must be a non-empty string.');
    expect(pdfToPngMock).not.toHaveBeenCalled();
});
