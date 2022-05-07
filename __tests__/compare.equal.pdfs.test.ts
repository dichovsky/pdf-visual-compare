import comparePdf from '../src/compare.pdf';

test(`should return true for equal PDF files`, async () => {
  const compareResult: boolean = await comparePdf('./test-data/pdf1.pdf', './test-data/pdf11.pdf');

  expect(compareResult).toBeTruthy();
});
