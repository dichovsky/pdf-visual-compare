import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import comparePdf from '../src';

test(`should throw "Actual PDF file not found" exception`, async () => {
    await expect(async () => {
        await comparePdf('./test-data/NOT_actual.pdf', './test-data/pdf11.pdf');
    }).rejects.toThrow(Error);
});

test(`should throw "Expected PDF file not found" exception`, async () => {
    await expect(async () => {
        await comparePdf('./test-data/pdf1.pdf', './test-data/NOT_expected.pdf');
    }).rejects.toThrow(Error);
});

test(`should throw "Unknown input file type" exception for actual file`, async () => {
    await expect(async () => {
        await comparePdf({} as string, './test-data/pdf1.pdf', {
            diffsOutputFolder: resolve(`./test-results/compare/4-2`),
        });
    }).rejects.toThrow(Error);
});

test(`should throw "Unknown input file type" exception for expected file`, async () => {
    await expect(async () => {
        await comparePdf('./test-data/pdf1.pdf', {} as string);
    }).rejects.toThrow(Error);
});

test(`should throw "Compare Threshold cannot be less than 0" exception`, async () => {
    await expect(async () => {
        await comparePdf('./test-data/pdf1.pdf', './test-data/pdf11.pdf', {
            compareThreshold: -1,
        });
    }).rejects.toThrow(Error);
});
