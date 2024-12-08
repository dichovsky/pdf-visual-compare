import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import comparePdf from '../src';

test(`should return true for equal PDF buffers`, async () => {
    expect(await comparePdf(readFileSync('./test-data/pdf1.pdf'), readFileSync('./test-data/pdf11.pdf'))).toBeTruthy();
});
