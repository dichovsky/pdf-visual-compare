import { resolve } from 'node:path';
import comparePdf from '../src/compare.pdf';
import { expect, test } from 'vitest';

const actualDiffsAmount = 14102;

test(`should return false for non equal PDF files with threshold less than specified`, async () => {
  const compareResult: boolean = await comparePdf('./test-data/pdf1.pdf', './test-data/pdf2.pdf', {
    excludedAreas: [],
    compareThreshold: actualDiffsAmount - 1,
    diffsOutputFolder: resolve(`./test-results/compare/5-1`),
  });

  expect(compareResult).toBeFalsy();
});

test(`should return true for non equal PDF files with threshold equals to specified`, async () => {
  const compareResult: boolean = await comparePdf('./test-data/pdf1.pdf', './test-data/pdf2.pdf', {
    compareThreshold: actualDiffsAmount,
    diffsOutputFolder: resolve(`./test-results/compare/5-2`),
  });

  expect(compareResult).toBeTruthy();
});

test(`should return true for non equal PDF files with threshold more than specified`, async () => {
  const compareResult: boolean = await comparePdf('./test-data/pdf1.pdf', './test-data/pdf2.pdf', {
    compareThreshold: actualDiffsAmount + 1,
    diffsOutputFolder: resolve(`./test-results/compare/5-3`),
  });

  expect(compareResult).toBeTruthy();
});

test(`should return true for equal PDF files with threshold equals to specified`, async () => {
  const compareResult: boolean = await comparePdf('./test-data/pdf1.pdf', './test-data/pdf11.pdf', {
    compareThreshold: 0,
    diffsOutputFolder: resolve(`./test-results/compare/5-4`),
  });

  expect(compareResult).toBeTruthy();
});

test(`should return true for equal PDF files with threshold less than specified`, async () => {
  const compareResult: boolean = await comparePdf('./test-data/pdf1.pdf', './test-data/pdf11.pdf', {
    compareThreshold: 1,
    diffsOutputFolder: resolve(`./test-results/compare/5-5`),
  });

  expect(compareResult).toBeTruthy();
});
