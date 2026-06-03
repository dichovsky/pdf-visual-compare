import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { comparePdf, comparePdfDetailed } from '../src/index.js';

test(`should not write diff files unless writeDiffs is enabled`, async () => {
    const diffsOutputFolder = resolve('./test-results/compare/14-1');

    await expect(
        comparePdf('./test-data/pdf1.pdf', './test-data/pdf2.pdf', { diffsOutputFolder }),
    ).resolves.toBeFalsy();
    expect(existsSync(diffsOutputFolder)).toBeFalsy();
});

test(`should write diff files and expose paths when writeDiffs is enabled`, async () => {
    const diffsOutputFolder = resolve('./test-results/compare/14-2');

    const result = await comparePdfDetailed('./test-data/pdf1.pdf', './test-data/pdf2.pdf', {
        writeDiffs: true,
        diffsOutputFolder,
    });

    expect(result.writeDiffs).toBeTruthy();
    expect(result.diffsOutputFolder).toBe(diffsOutputFolder);
    expect(result.pages.some((page) => page.diffFilePath !== null)).toBeTruthy();
    expect(existsSync(diffsOutputFolder)).toBeTruthy();
});
