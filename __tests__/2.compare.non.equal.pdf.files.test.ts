import comparePdf from '../src/compare.pdf';
import { expect, test } from 'vitest';

test(`should return false for non equal PDF files`, async () => {
  expect(await comparePdf('./test-data/pdf1.pdf', './test-data/pdf2.pdf')).toBeFalsy();
});

test(`should return false for non equal PDF files, pages amount not match`, async () => {
  expect(await comparePdf('./test-data/pdf1.pdf', './test-data/pdf3.pdf')).toBeFalsy();
});
