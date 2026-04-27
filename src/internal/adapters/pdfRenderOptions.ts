import type { PdfToPngOptions } from 'pdf-to-png-converter';
import type { PdfRenderOptions } from '../../types/PdfRenderOptions.js';

export function toPdfToPngOptions(options: PdfRenderOptions | undefined): PdfToPngOptions {
    return {
        viewportScale: options?.viewportScale,
        disableFontFace: options?.disableFontFace,
        useSystemFonts: options?.useSystemFonts,
        enableXfa: options?.enableXfa,
        pdfFilePassword: options?.pdfFilePassword,
        outputFolder: options?.outputFolder,
        outputFileMaskFunc: options?.outputFileMaskFunc,
        pagesToProcess: options?.pagesToProcess,
        verbosityLevel: options?.verbosityLevel,
        returnPageContent: true,
        returnMetadataOnly: false,
        processPagesInParallel: false,
    };
}
