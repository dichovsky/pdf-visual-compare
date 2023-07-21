import { readFileSync } from 'node:fs';
import comparePdf from '../src/compare.pdf';

test(`should return true for equal PDF buffers`, async () => {
  expect(await comparePdf(readFileSync('./test-data/pdf1.pdf'), readFileSync('./test-data/pdf11.pdf'))).toBeTruthy();
});
