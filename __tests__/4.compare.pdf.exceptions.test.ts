import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { comparePdf, ComparePdfConfigurationError, ComparePdfInputError } from '../src';
import type { PdfInput } from '../src';

async function expectTypedError(comparePromise: Promise<unknown>, errorClass: ErrorConstructor, message: string): Promise<void> {
    await expect(comparePromise).rejects.toThrow(errorClass);
    await expect(comparePromise).rejects.toThrow(message);
    await expect(comparePromise).rejects.toMatchObject({
        message,
        name: errorClass.name,
    });
}

test(`should throw "Actual PDF file not found" exception`, async () => {
    const comparePromise = comparePdf('./test-data/NOT_actual.pdf', './test-data/pdf11.pdf');

    await expectTypedError(
        comparePromise,
        ComparePdfInputError,
        'PDF file not found: ./test-data/NOT_actual.pdf',
    );
});

test(`should throw "Expected PDF file not found" exception`, async () => {
    const comparePromise = comparePdf('./test-data/pdf1.pdf', './test-data/NOT_expected.pdf');

    await expectTypedError(
        comparePromise,
        ComparePdfInputError,
        'PDF file not found: ./test-data/NOT_expected.pdf',
    );
});

test(`should reject directory paths for actual PDF input`, async () => {
    const comparePromise = comparePdf('./test-data', './test-data/pdf11.pdf');

    await expectTypedError(comparePromise, ComparePdfInputError, 'PDF path is not a file: ./test-data');
});

test(`should throw "Unknown input file type" exception for actual file`, async () => {
    const comparePromise = comparePdf({} as unknown as PdfInput, './test-data/pdf1.pdf', {
        diffsOutputFolder: resolve(`./test-results/compare/4-2`),
    });

    await expectTypedError(comparePromise, ComparePdfInputError, 'Unknown input file type.');
});

test(`should throw "Unknown input file type" exception for expected file`, async () => {
    const comparePromise = comparePdf('./test-data/pdf1.pdf', {} as unknown as PdfInput);

    await expectTypedError(comparePromise, ComparePdfInputError, 'Unknown input file type.');
});

test(`should throw "Unknown input file type" exception for Uint8Array input`, async () => {
    const comparePromise = comparePdf(new Uint8Array([1, 2, 3]) as unknown as PdfInput, './test-data/pdf1.pdf');

    await expectTypedError(comparePromise, ComparePdfInputError, 'Unknown input file type.');
});

test(`should accept SharedArrayBuffer input`, async () => {
    const actualBuffer = await readFile('./test-data/pdf1.pdf');
    const expectedBuffer = await readFile('./test-data/pdf11.pdf');
    const actualSharedBuffer = new SharedArrayBuffer(actualBuffer.byteLength);
    const expectedSharedBuffer = new SharedArrayBuffer(expectedBuffer.byteLength);

    new Uint8Array(actualSharedBuffer).set(actualBuffer);
    new Uint8Array(expectedSharedBuffer).set(expectedBuffer);

    await expect(comparePdf(actualSharedBuffer, expectedSharedBuffer)).resolves.toBeTruthy();
});

test.each([null, false, 0, []])('should reject non-object options value %s', async (value) => {
    const comparePromise = comparePdf('./test-data/pdf1.pdf', './test-data/pdf11.pdf', value as never);

    await expectTypedError(comparePromise, ComparePdfConfigurationError, 'Options must be an object.');
});

test.each([null, false, 0, {}])('should reject invalid diffsOutputFolder value %s', async (value) => {
    const comparePromise = comparePdf('./test-data/pdf1.pdf', './test-data/pdf11.pdf', {
        diffsOutputFolder: value as never,
    });

    await expectTypedError(comparePromise, ComparePdfConfigurationError, 'diffsOutputFolder must be a non-empty string.');
});

test('should reject empty diffsOutputFolder before comparison', async () => {
    const comparePromise = comparePdf('./test-data/pdf1.pdf', './test-data/pdf11.pdf', {
        diffsOutputFolder: '   ',
    });

    await expectTypedError(comparePromise, ComparePdfConfigurationError, 'diffsOutputFolder must be a non-empty string.');
});

test('should reject diffsOutputFolder values that point to an existing file', async () => {
    const comparePromise = comparePdf('./test-data/pdf1.pdf', './test-data/pdf11.pdf', {
        diffsOutputFolder: './README.md',
    });

    await expectTypedError(
        comparePromise,
        ComparePdfConfigurationError,
        'diffsOutputFolder must point to a directory when it already exists: ./README.md',
    );
});

test.each([null, false, 0, {}])('should reject non-array excludedAreas value %s', async (value) => {
    const comparePromise = comparePdf('./test-data/pdf1.pdf', './test-data/pdf11.pdf', {
        excludedAreas: value as never,
    });

    await expectTypedError(comparePromise, ComparePdfConfigurationError, 'excludedAreas must be an array.');
});

test.each([null, false, 0, []])('should reject non-object excludedAreas entry %s', async (value) => {
    const comparePromise = comparePdf('./test-data/pdf1.pdf', './test-data/pdf11.pdf', {
        excludedAreas: [value] as never,
    });

    await expectTypedError(comparePromise, ComparePdfConfigurationError, 'Each excludedAreas entry must be an object.');
});

test.each([Number.NaN, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, -1, 0.5])(
    'should reject invalid compareThreshold value %s before comparison',
    async (compareThreshold) => {
        const comparePromise = comparePdf('./test-data/pdf1.pdf', './test-data/pdf2.pdf', { compareThreshold });

        await expectTypedError(
            comparePromise,
            ComparePdfConfigurationError,
            'Compare Threshold must be a finite non-negative integer.',
        );
    },
);

test.each([Number.NaN, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, -1, 0.5])(
    'should reject invalid matchingThreshold value %s before comparison',
    async (matchingThreshold) => {
        const comparePromise = comparePdf('./test-data/pdf1.pdf', './test-data/pdf2.pdf', {
            excludedAreas: [{ pageNumber: 1, matchingThreshold }],
        });

        await expectTypedError(
            comparePromise,
            ComparePdfConfigurationError,
            'Matching Threshold must be a finite non-negative integer.',
        );
    },
);

test.each([0, -1, 1.5, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, Number.NaN])(
    'should reject invalid pageNumber value %s before comparison',
    async (pageNumber) => {
        const comparePromise = comparePdf('./test-data/pdf1.pdf', './test-data/pdf2.pdf', {
            excludedAreas: [{ pageNumber, matchingThreshold: 0 }],
        });

        await expectTypedError(
            comparePromise,
            ComparePdfConfigurationError,
            'Page Number must be a finite positive integer.',
        );
    },
);
