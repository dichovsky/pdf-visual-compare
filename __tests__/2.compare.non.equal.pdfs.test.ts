import { existsSync, rmSync } from 'fs';
import { resolve } from 'path';
import { ComparePdfOptions } from '../src';
import comparePdf from '../src/compare.pdf';
import { DEFAULT_DIFFS_FOLDER } from '../src/const';

const opts: ComparePdfOptions = {
  diffsOutputFolder: resolve(`./test-results/compare/2-1`),
};

beforeEach(async () => {
  rmSync(opts.diffsOutputFolder as string, { recursive: true, force: true });
  rmSync(DEFAULT_DIFFS_FOLDER, { recursive: true, force: true });
});

test(`should return false for non equal PDF files`, async () => {
  const compareResult: boolean = await comparePdf('./test-data/pdf1.pdf', './test-data/pdf2.pdf');

  expect(existsSync(DEFAULT_DIFFS_FOLDER)).toBeTruthy();
  expect(compareResult).toBeFalsy();
});

test(`should return false for non equal PDF files with different pages amount`, async () => {
  const compareResult: boolean = await comparePdf('./test-data/pdf1.pdf', './test-data/pdf3.pdf', opts);

  expect(existsSync(opts.diffsOutputFolder as string)).toBeTruthy();
  expect(compareResult).toBeFalsy();
});
