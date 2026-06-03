import {
    comparePdf,
    comparePdfDetailed,
    type ComparePdfDetailedResult,
    type ComparePdfOptions,
    type ComparePdfPageStatus,
    type ExcludedPageArea,
    type PageExclusion,
    type PdfInput,
    type RgbColor,
} from 'pdf-visual-compare';

const bufferInput = Buffer.from('%PDF-consumer-typecheck');
const arrayBufferInput = bufferInput.buffer.slice(
    bufferInput.byteOffset,
    bufferInput.byteOffset + bufferInput.byteLength,
);

const highlightColor: RgbColor = {
    r: 16,
    g: 32,
    b: 48,
};

const pageExclusion: PageExclusion = {
    pageNumber: 1,
    excludedAreas: [{ x1: 10, y1: 20, x2: 30, y2: 40 }],
    excludedAreaColor: highlightColor,
    matchingThreshold: 0,
};

const legacyPageExclusion: ExcludedPageArea = pageExclusion;

const options: ComparePdfOptions = {
    allowedInputRoot: 'test-data',
    compareThreshold: 0,
    diffsOutputFolder: 'test-results/published-artifacts/typecheck',
    excludedAreas: [legacyPageExclusion],
    pdfToPngConvertOptions: {
        viewportScale: 2,
        outputFileMaskFunc: (pageNumber) => `typecheck-page-${pageNumber}.png`,
    },
};

const actualPdf: PdfInput = bufferInput;
const expectedPdf: PdfInput = arrayBufferInput;

export async function verifyConsumerTypes(): Promise<void> {
    const isEqual: boolean = await comparePdf(actualPdf, expectedPdf, options);
    const result: ComparePdfDetailedResult = await comparePdfDetailed(
        './test-data/pdf1.pdf',
        './test-data/pdf11.pdf',
        options,
    );
    const firstPageStatus: ComparePdfPageStatus | undefined = result.pages[0]?.status;

    void isEqual;
    void firstPageStatus;
}
