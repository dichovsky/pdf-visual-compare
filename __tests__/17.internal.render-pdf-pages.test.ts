import { Buffer } from 'node:buffer';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, vi } from 'vitest';
import { ComparePdfConfigurationError } from '../src/errors/ComparePdfConfigurationError.js';
import { ComparePdfRenderingError } from '../src/errors/ComparePdfRenderingError.js';
import { renderPdfPage, renderPdfPages } from '../src/internal/renderPdfPages.js';

const { pdfToPngMock } = vi.hoisted(() => ({
    pdfToPngMock: vi.fn(),
}));

vi.mock('pdf-to-png-converter', () => ({
    pdfToPng: pdfToPngMock,
}));

test(`should rethrow library rendering errors from non-array renderer output`, async () => {
    pdfToPngMock.mockReset();
    pdfToPngMock.mockResolvedValueOnce(undefined);
    const renderPromise = renderPdfPages(Buffer.from('dummy'), {}, 'actual');

    await expect(renderPromise).rejects.toThrow(ComparePdfRenderingError);
    await expect(renderPromise).rejects.toThrow('Failed to render actual PDF pages.');
});

test(`should not clear a stale render target whose mask escapes the output namespace`, async () => {
    const outputFolder = resolve(`./test-results/internal/17-escape/pages`);
    const escapedFile = resolve(`./test-results/internal/17-escape/escaped.png`);

    rmSync(resolve(`./test-results/internal/17-escape`), { recursive: true, force: true });
    mkdirSync(outputFolder, { recursive: true });
    // A bystander file two levels above the render namespace must never be removed.
    writeFileSync(escapedFile, 'do-not-delete');

    pdfToPngMock.mockReset();
    pdfToPngMock.mockResolvedValueOnce([{ name: 'escaped.png', pageNumber: 1, content: Buffer.from('rendered') }]);

    await expect(
        renderPdfPage(
            Buffer.from('dummy'),
            { outputFolder, outputFileMaskFunc: () => '../../escaped.png' },
            1,
            'actual',
        ),
    ).resolves.toMatchObject({ pageNumber: 1 });

    expect(existsSync(escapedFile)).toBeTruthy();
});

test(`should surface a typed configuration error when clearing the stale render target fails`, async () => {
    const outputFolder = resolve(`./test-results/internal/17-unwritable/pages`);
    const namespace = resolve(outputFolder, 'actual');

    rmSync(resolve(`./test-results/internal/17-unwritable`), { recursive: true, force: true });
    // Occupy the exact target name with a directory so the file-only rmSync fails (EISDIR)
    // instead of leaking a raw ErrnoException out of the typed public surface.
    mkdirSync(resolve(namespace, 'render_1.png'), { recursive: true });

    pdfToPngMock.mockReset();

    const renderPromise = renderPdfPage(
        Buffer.from('dummy'),
        { outputFolder, outputFileMaskFunc: () => 'render_1.png' },
        1,
        'actual',
    );

    await expect(renderPromise).rejects.toThrow(ComparePdfConfigurationError);
    await expect(renderPromise).rejects.toThrow(
        `pdfToPngConvertOptions.outputFolder must point to a writable directory: ${outputFolder}`,
    );
    expect(pdfToPngMock).not.toHaveBeenCalled();
});
