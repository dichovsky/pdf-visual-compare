import { readFileSync } from 'node:fs';
import comparePdf from '../src/compare.pdf';

test(`should return false for non equal PDF buffers`, async () => {
  expect(await comparePdf(readFileSync('./test-data/pdf1.pdf'), readFileSync('./test-data/pdf2.pdf'))).toBeFalsy();
});

test(`should return false for non equal PDF buffers, pages amount not match`, async () => {
  expect(await comparePdf(readFileSync('./test-data/pdf1.pdf'), readFileSync('./test-data/pdf3.pdf'))).toBeFalsy();
});