import { expect, test } from 'vitest';
import { comparePdf, ComparePdfConfigurationError } from '../src';

test.each(['invalid', 0, false, null])(`should reject non-object render option configuration %s`, async (value) => {
    const comparePromise = comparePdf('./test-data/pdf1.pdf', './test-data/pdf11.pdf', {
        pdfToPngConvertOptions: value as never,
    });

    await expect(comparePromise).rejects.toThrow(ComparePdfConfigurationError);
    await expect(comparePromise).rejects.toThrow('pdfToPngConvertOptions must be an object.');
});

test.each([
    [{ returnMetadataOnly: true }, 'returnMetadataOnly'],
    [{ returnPageContent: false }, 'returnPageContent'],
    [{ processPagesInParallel: true }, 'processPagesInParallel'],
    [{ concurrencyLimit: 2 }, 'concurrencyLimit'],
    [
        { returnMetadataOnly: true, processPagesInParallel: true, concurrencyLimit: 2 },
        'returnMetadataOnly, processPagesInParallel, concurrencyLimit',
    ],
])(`should reject unsupported render option configuration %s`, async (pdfToPngConvertOptions, unsupportedOptions) => {
    const comparePromise = comparePdf('./test-data/pdf1.pdf', './test-data/pdf11.pdf', {
        pdfToPngConvertOptions: pdfToPngConvertOptions as never,
    });

    await expect(comparePromise).rejects.toThrow(ComparePdfConfigurationError);
    await expect(comparePromise).rejects.toThrow(
        `Unsupported pdfToPngConvertOptions properties: ${unsupportedOptions}. comparePdf always renders page content sequentially.`,
    );
});
