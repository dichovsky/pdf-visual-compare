import comparePdf from '../src/index';

test(`Should throw "Actual PDF file not found" exception`, async () => {
    await expect(async() => { await comparePdf('./test-data/NOT_actual.pdf', './test-data/pdf11.pdf') }).rejects.toThrow(Error);
});

test(`Should throw "Expected PDF file not found" exception`, async () => { 
    await expect(async() => { await comparePdf('./test-data/pdf1.pdf', './test-data/NOT_expected.pdf') }).rejects.toThrow(Error);
});
