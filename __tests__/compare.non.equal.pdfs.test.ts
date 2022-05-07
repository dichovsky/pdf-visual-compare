import { resolve } from 'path';
import comparePdf from '../src/compare.pdf';

test(`should return false for non equal PDF files`, async () => {
  const compareResult: boolean = await comparePdf('./test-data/pdf1.pdf', './test-data/pdf2.pdf', {
    diffsOutputFolder: resolve(`./comparePdfOutput`),
  });

  expect(compareResult).toBeFalsy();
});

test(`should return false for non equal PDF files with different pages amount`, async () => {
  const compareResult: boolean = await comparePdf('./test-data/pdf1.pdf', './test-data/pdf3.pdf');

  expect(compareResult).toBeFalsy();
});
