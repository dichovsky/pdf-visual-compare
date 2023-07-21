import comparePdf from '../src/compare.pdf';

test(`should return true for equal PDF files`, async () => {
  expect(await comparePdf('./test-data/pdf1.pdf', './test-data/pdf11.pdf')).toBeTruthy();
});
