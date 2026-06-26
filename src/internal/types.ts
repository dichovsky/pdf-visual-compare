import type { PdfToPngOptions, PngPageOutput } from 'pdf-to-png-converter';
import type { PageExclusion } from '../types/PageExclusion.js';

export type RenderedPngPageOutput = Extract<PngPageOutput, { kind: 'content' | 'file' }> & { content: Buffer };

export type AllowedInputRoot = {
    displayPath: string;
    resolvedPath: string;
    canonicalPath: string;
};

export type PageComparisonPlanEntry = {
    pageNumber: number;
    actualPage?: RenderedPngPageOutput;
    expectedPage?: RenderedPngPageOutput;
    pageExclusion?: PageExclusion;
};

export type NormalizedComparePdfOptions = {
    allowedInputRoot?: AllowedInputRoot;
    compareThreshold: number;
    compareThresholdPercent?: number;
    diffsOutputFolder: string;
    excludedAreas: readonly PageExclusion[];
    pdfToPngConvertOpts: PdfToPngOptions;
    selectedPageNumbers?: ReadonlySet<number>;
    writeDiffs: boolean;
};
