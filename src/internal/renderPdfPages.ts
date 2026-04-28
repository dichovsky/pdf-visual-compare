import { join } from 'node:path';
import { pdfToPng } from 'pdf-to-png-converter';
import { ComparePdfRenderingError } from '../errors/ComparePdfRenderingError.js';
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
