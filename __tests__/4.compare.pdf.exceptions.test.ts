import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { comparePdf } from '../src';

test(`should throw "Actual PDF file not found" exception`, async () => {
    await expect(comparePdf('./test-data/NOT_actual.pdf', './test-data/pdf11.pdf')).rejects.toThrow(
        'PDF file not found: ./test-data/NOT_actual.pdf',
    );
});

test(`should throw "Expected PDF file not found" exception`, async () => {
    await expect(comparePdf('./test-data/pdf1.pdf', './test-data/NOT_expected.pdf')).rejects.toThrow(
        'PDF file not found: ./test-data/NOT_expected.pdf',
    );
});

test(`should throw "Unknown input file type" exception for actual file`, async () => {
    await expect(
        comparePdf({} as string, './test-data/pdf1.pdf', {
            diffsOutputFolder: resolve(`./test-results/compare/4-2`),
        }),
    ).rejects.toThrow('Unknown input file type.');
});

test(`should throw "Unknown input file type" exception for expected file`, async () => {
    await expect(comparePdf('./test-data/pdf1.pdf', {} as string)).rejects.toThrow('Unknown input file type.');
});

test(`should throw "Compare Threshold cannot be less than 0" exception`, async () => {
    await expect(
        comparePdf('./test-data/pdf1.pdf', './test-data/pdf11.pdf', {
            compareThreshold: -1,
        }),
    ).rejects.toThrow('Compare Threshold cannot be less than 0.');
});
