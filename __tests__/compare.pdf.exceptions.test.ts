import comparePdf from '../src/index';

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

test(`should throw "Compare Threshold cannot be less than 0" exception`, async () => {
  await expect(async () => {
    await comparePdf('./test-data/pdf1.pdf', './test-data/pdf11.pdf', { compareThreshold: -1 });
  }).rejects.toThrow(Error);
});
