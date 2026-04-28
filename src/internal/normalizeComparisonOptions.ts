import { toComparePngOptions } from './adapters/comparePngOptions.js';
import { toPdfToPngOptions } from './adapters/pdfRenderOptions.js';
import { validateDiffsOutputFolder } from './diffOutputGuards.js';
import { validateAllowedInputRoot } from './normalizePdfInput.js';
import { ComparePdfConfigurationError } from '../errors/ComparePdfConfigurationError.js';
import type { ComparePdfOptions } from '../types/ComparePdfOptions.js';
import type { PageExclusion } from '../types/PageExclusion.js';
import type { NormalizedComparePdfOptions } from './types.js';

const UNSUPPORTED_PDF_RENDER_OPTIONS = [
    'returnPageContent',
    'returnMetadataOnly',
    'processPagesInParallel',
    'concurrencyLimit',
] as const;

export function normalizeComparisonOptions(opts: unknown): NormalizedComparePdfOptions {
    const compareOptions = validateComparePdfOptions(opts);
    const allowedInputRoot = validateAllowedInputRoot(compareOptions.allowedInputRoot);

    validatePdfRenderOptions(compareOptions.pdfToPngConvertOptions);

    const pdfToPngConvertOpts = toPdfToPngOptions(compareOptions.pdfToPngConvertOptions);
    if (!pdfToPngConvertOpts.viewportScale) {
        pdfToPngConvertOpts.viewportScale = 2.0;
    }
    if (!pdfToPngConvertOpts.outputFileMaskFunc) {
        pdfToPngConvertOpts.outputFileMaskFunc = (pageNumber: number) => `comparePdf_${pageNumber}.png`;
    }

    const writeDiffs = compareOptions.writeDiffs ?? false;
    const diffsOutputFolder = validateDiffsOutputFolder(compareOptions.diffsOutputFolder);
    const compareThreshold: number = compareOptions.compareThreshold ?? 0;
    const excludedAreas: readonly PageExclusion[] = validateExcludedAreas(compareOptions.excludedAreas);

    validateThreshold(compareThreshold, 'Compare Threshold');
    for (const pageExclusion of excludedAreas) {
        validatePageNumber(pageExclusion.pageNumber);
        validateThreshold(pageExclusion.matchingThreshold, 'Matching Threshold');
        if (pageExclusion.diffFilePath !== undefined) {
            validateDiffFilePath(pageExclusion.diffFilePath);
        }
        if (writeDiffs && pageExclusion.diffFilePath !== undefined) {
            toComparePngOptions(pageExclusion, diffsOutputFolder, `comparePdf_${pageExclusion.pageNumber}.png`, true);
        }
    }

    return {
        allowedInputRoot,
        compareThreshold,
        diffsOutputFolder,
        excludedAreas,
        pdfToPngConvertOpts,
        writeDiffs,
    };
}

function validateThreshold(value: number | undefined, thresholdName: 'Compare Threshold' | 'Matching Threshold'): void {
    if (value === undefined) {
        return;
    }

    if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
        throw new ComparePdfConfigurationError(`${thresholdName} must be a finite non-negative integer.`);
    }
}

function validatePageNumber(pageNumber: number): void {
    if (!Number.isFinite(pageNumber) || !Number.isInteger(pageNumber) || pageNumber <= 0) {
        throw new ComparePdfConfigurationError('Page Number must be a finite positive integer.');
    }
}

function validateComparePdfOptions(opts: unknown): ComparePdfOptions {
    if (opts === undefined) {
        return {};
    }

    if (opts === null || typeof opts !== 'object' || Array.isArray(opts)) {
        throw new ComparePdfConfigurationError('Options must be an object.');
    }

    return opts as ComparePdfOptions;
}

function validateExcludedAreas(excludedAreas: ComparePdfOptions['excludedAreas']): readonly PageExclusion[] {
    if (excludedAreas === undefined) {
        return [];
    }

    if (!Array.isArray(excludedAreas)) {
        throw new ComparePdfConfigurationError('excludedAreas must be an array.');
    }

    for (const pageExclusion of excludedAreas) {
        if (pageExclusion === null || typeof pageExclusion !== 'object' || Array.isArray(pageExclusion)) {
            throw new ComparePdfConfigurationError('Each excludedAreas entry must be an object.');
        }
    }

    return excludedAreas;
}

function validatePdfRenderOptions(pdfRenderOptions: ComparePdfOptions['pdfToPngConvertOptions']): void {
    if (pdfRenderOptions === undefined) {
        return;
    }

    if (pdfRenderOptions === null || typeof pdfRenderOptions !== 'object' || Array.isArray(pdfRenderOptions)) {
        throw new ComparePdfConfigurationError('pdfToPngConvertOptions must be an object.');
    }

    const unsupportedOptions = UNSUPPORTED_PDF_RENDER_OPTIONS.filter((optionName) => optionName in pdfRenderOptions);
    if (unsupportedOptions.length > 0) {
        throw new ComparePdfConfigurationError(
            `Unsupported pdfToPngConvertOptions properties: ${unsupportedOptions.join(', ')}. comparePdf always renders page content sequentially.`,
        );
    }
}

function validateDiffFilePath(diffFilePath: PageExclusion['diffFilePath']): void {
    if (typeof diffFilePath !== 'string' || diffFilePath.trim() === '') {
        throw new ComparePdfConfigurationError('diffFilePath must be a non-empty string.');
    }
}
