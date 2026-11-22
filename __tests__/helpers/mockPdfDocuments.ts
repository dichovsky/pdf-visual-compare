import type { Mock } from 'vitest';
import type { PdfToPngOptions } from 'pdf-to-png-converter';

type FixturePage = {
    pageNumber: number;
    name: string;
    content: Buffer;
    width?: number;
    height?: number;
};

// A metadata-only request never returns image bytes. Resolve individual render requests from the same fixtures.
export function mockPdfDocuments(renderer: Mock, actualPages: FixturePage[], expectedPages: FixturePage[]): void {
    let actualInput: Buffer;
    renderer
        .mockImplementationOnce((input: Buffer) => {
            actualInput = input;
            return actualPages.map(({ pageNumber, name }) => ({ kind: 'metadata', pageNumber, name }));
        })
        .mockResolvedValueOnce(expectedPages.map(({ pageNumber, name }) => ({ kind: 'metadata', pageNumber, name })))
        .mockImplementation((input: Buffer, options: PdfToPngOptions) => {
            const pages = input === actualInput ? actualPages : expectedPages;
            return pages.filter((page) => options.pagesToProcess?.includes(page.pageNumber));
        });
}
