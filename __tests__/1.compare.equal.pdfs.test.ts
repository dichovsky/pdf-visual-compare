import { existsSync, rmSync } from 'fs';
import { resolve } from 'path';
import { ComparePdfOptions } from '../src';
import comparePdf from '../src/compare.pdf';
import { DEFAULT_DIFFS_FOLDER } from '../src/const';

const opts: ComparePdfOptions = {
  diffsOutputFolder: resolve(`./test-results/compare/1-1`),
};

let compareResult: boolean;

beforeAll(async () => {
  rmSync(opts.diffsOutputFolder as string, { recursive: true, force: true });
  rmSync(DEFAULT_DIFFS_FOLDER, { recursive: true, force: true });
  compareResult = await comparePdf('./test-data/pdf1.pdf', './test-data/pdf11.pdf');
});

test(`should return true for equal PDF files`, async () => {
  expect(compareResult).toBeTruthy();
});

test(`should not create diffs folder for equal PDF files, custom diff folder`, async () => {
  expect(existsSync(opts.diffsOutputFolder as string)).toBeFalsy();
});

test(`should not create diffs folder for equal PDF files, default diff folder`, async () => {
  expect(existsSync(DEFAULT_DIFFS_FOLDER)).toBeFalsy();
});
