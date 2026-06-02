import { rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pdfToPng } from 'pdf-to-png-converter';
import { ComparePdfConfigurationError } from '../errors/ComparePdfConfigurationError.js';
import { ComparePdfRenderingError } from '../errors/ComparePdfRenderingError.js';
import { isPathWithinRoot } from './securePath.js';
import type { PdfInput } from '../types/PdfInput.js';
import type { RenderedPngPageOutput } from './types.js';
import type { PdfToPngOptions, PngPageOutput } from 'pdf-to-png-converter';

export type PlannedPdfPages = {
    pageNumbers: number[];
    prefetchedPages: Map<number, PngPageOutput>;
};

export async function listRenderedPageNumbers(
    pdfFile: PdfInput,
    pdfToPngConvertOpts: PdfToPngOptions,
    sourceLabel: 'actual' | 'expected',
): Promise<PlannedPdfPages> {
    const metadataPages = await runPdfToPng(
        pdfFile,
        {
            ...pdfToPngConvertOpts,
            returnMetadataOnly: true,
            returnPageContent: false,
        },
        sourceLabel,
    );

    return {
        pageNumbers: metadataPages.map((page) => page.pageNumber),
        prefetchedPages: new Map(metadataPages.map((page) => [page.pageNumber, page])),
    };
}

export async function renderPdfPages(
    pdfFile: PdfInput,
    pdfToPngConvertOpts: PdfToPngOptions,
    sourceLabel: 'actual' | 'expected',
): Promise<RenderedPngPageOutput[]> {
    const renderedPages = await runPdfToPng(pdfFile, pdfToPngConvertOpts, sourceLabel);
    const missingContentPage = renderedPages.find((page) => !Buffer.isBuffer(page.content));

    if (missingContentPage) {
        throw new ComparePdfRenderingError(`Rendered page content is missing for page: ${missingContentPage.name}.`);
    }

    return renderedPages as RenderedPngPageOutput[];
}

export async function renderPdfPage(
    pdfFile: PdfInput,
    pdfToPngConvertOpts: PdfToPngOptions,
    pageNumber: number,
    sourceLabel: 'actual' | 'expected',
): Promise<RenderedPngPageOutput | undefined> {
    clearStaleRenderTarget(pdfToPngConvertOpts, pageNumber, sourceLabel);

    const renderedPages = await renderPdfPages(
        pdfFile,
        {
            ...pdfToPngConvertOpts,
            pagesToProcess: [pageNumber],
        },
        sourceLabel,
    );

    return renderedPages[0];
}

/**
 * Removes the exact PNG file this page render is about to (re)create when an
 * `outputFolder` is configured. The renderer opens output files with exclusive-create
 * (`'wx'`) and refuses to overwrite, so a prior run's PNG at the same name would otherwise
 * make re-rendering fail with `EEXIST`. This performs the "clear the output name before
 * re-running the same conversion" step the renderer documents for callers, scoped to the
 * single file the library owns and is regenerating.
 *
 * The removal is constrained to the library-owned render namespace: the resolved target must
 * stay inside `<outputFolder>/<sourceLabel>`. A mask that escapes that directory is left
 * untouched, so the renderer's own containment check (`savePNGfile`) remains the single
 * source of truth for rejecting it. `force: true` ignores a missing file and unlinks a leaf
 * symlink without following it. Any other filesystem failure (for example a non-writable
 * folder, or a directory occupying the target name) is surfaced as the library's typed
 * `ComparePdfConfigurationError` rather than leaking a raw `ErrnoException`.
 */
function clearStaleRenderTarget(
    pdfToPngConvertOpts: PdfToPngOptions,
    pageNumber: number,
    sourceLabel: 'actual' | 'expected',
): void {
    const { outputFolder, outputFileMaskFunc } = pdfToPngConvertOpts;
    if (!outputFolder || !outputFileMaskFunc) {
        return;
    }

    const renderNamespace = resolve(outputFolder, sourceLabel);
    const targetPath = resolve(renderNamespace, outputFileMaskFunc(pageNumber));
    if (!isPathWithinRoot(targetPath, renderNamespace)) {
        return;
    }

    try {
        rmSync(targetPath, { force: true });
    } catch (cause) {
        throw new ComparePdfConfigurationError(
            `pdfToPngConvertOptions.outputFolder must point to a writable directory: ${outputFolder}`,
            { cause },
        );
    }
}

function toRenderablePdfInput(pdfFile: PdfInput): string | Buffer | ArrayBuffer {
    if (typeof pdfFile === 'string' || Buffer.isBuffer(pdfFile)) {
        return pdfFile;
    }

    return Uint8Array.from(new Uint8Array(pdfFile)).buffer;
}

async function runPdfToPng(
    pdfFile: PdfInput,
    pdfToPngConvertOpts: PdfToPngOptions,
    sourceLabel: 'actual' | 'expected',
): Promise<PngPageOutput[]> {
    try {
        const renderedPages = await pdfToPng(toRenderablePdfInput(pdfFile), {
            ...pdfToPngConvertOpts,
            outputFolder: pdfToPngConvertOpts.outputFolder ? join(pdfToPngConvertOpts.outputFolder, sourceLabel) : undefined,
        });

        if (!Array.isArray(renderedPages)) {
            throw new ComparePdfRenderingError(`Failed to render ${sourceLabel} PDF pages.`);
        }

        return renderedPages;
    } catch (cause) {
        if (cause instanceof ComparePdfRenderingError) {
            throw cause;
        }

        throw new ComparePdfRenderingError(`Failed to render ${sourceLabel} PDF pages.`, { cause });
    }
}
