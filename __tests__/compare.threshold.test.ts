import comparePdf from '../src/compare.pdf';

const actualDiffsAmount = 14109;

test(`should return false for non equal PDF files with threshold less than specified`, async () => {
  const compareResult: boolean = await comparePdf('./test-data/pdf1.pdf', './test-data/pdf2.pdf', {
    excludedAreas: [],
    compareThreshold: actualDiffsAmount - 1,
  });

  expect(compareResult).toBeFalsy();
});

test(`should return true for non equal PDF files with threshold equals to specified`, async () => {
  const compareResult: boolean = await comparePdf('./test-data/pdf1.pdf', './test-data/pdf2.pdf', {
    compareThreshold: actualDiffsAmount,
  });

  expect(compareResult).toBeTruthy();
});

test(`should return true for non equal PDF files with threshold more than specified`, async () => {
  const compareResult: boolean = await comparePdf('./test-data/pdf1.pdf', './test-data/pdf2.pdf', {
    compareThreshold: actualDiffsAmount + 1,
  });

  expect(compareResult).toBeTruthy();
});

test(`should return true for equal PDF files with threshold equals to specified`, async () => {
  const compareResult: boolean = await comparePdf('./test-data/pdf1.pdf', './test-data/pdf11.pdf', {
    compareThreshold: 0,
  });

  expect(compareResult).toBeTruthy();
});

test(`should return true for equal PDF files with threshold less than specified`, async () => {
  const compareResult: boolean = await comparePdf('./test-data/pdf1.pdf', './test-data/pdf11.pdf', {
    compareThreshold: 1,
  });

  expect(compareResult).toBeTruthy();
});
