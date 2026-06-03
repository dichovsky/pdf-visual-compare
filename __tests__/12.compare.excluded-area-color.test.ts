import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, vi } from 'vitest';

import { PNG } from 'pngjs';

const { pdfToPngMock } = vi.hoisted(() => ({
    pdfToPngMock: vi.fn(),
}));

vi.mock('pdf-to-png-converter', () => ({
    pdfToPng: pdfToPngMock,
}));

import { comparePdf } from '../src/comparePdf.js';

function createPngBuffer(
    width: number,
    height: number,
    pixelColor: (x: number, y: number) => { r: number; g: number; b: number; a?: number },
): Buffer {
    const png = new PNG({ width, height });

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const offset = (width * y + x) << 2;
            const color = pixelColor(x, y);

            png.data[offset] = color.r;
            png.data[offset + 1] = color.g;
            png.data[offset + 2] = color.b;
            png.data[offset + 3] = color.a ?? 255;
        }
    }

    return PNG.sync.write(png);
}

function getPixelColor(pngBuffer: Buffer, x: number, y: number): [number, number, number, number] {
    const png = PNG.sync.read(pngBuffer);
    const offset = (png.width * y + x) << 2;

    return [png.data[offset], png.data[offset + 1], png.data[offset + 2], png.data[offset + 3]];
}

test(`should change diff output when excludedAreaColor changes`, async () => {
    const actualPageContent = createPngBuffer(2, 1, () => ({ r: 255, g: 255, b: 255 }));
    const expectedPageContent = createPngBuffer(2, 1, () => ({ r: 0, g: 0, b: 0 }));

    pdfToPngMock.mockReset();
    pdfToPngMock
        .mockResolvedValueOnce([{ name: 'page-1.png', pageNumber: 1, content: actualPageContent }])
        .mockResolvedValueOnce([{ name: 'page-1.png', pageNumber: 1, content: expectedPageContent }])
        .mockResolvedValueOnce([{ name: 'page-1.png', pageNumber: 1, content: actualPageContent }])
        .mockResolvedValueOnce([{ name: 'page-1.png', pageNumber: 1, content: expectedPageContent }]);

    const defaultDiffsOutputFolder = resolve(`./test-results/compare/12-1/default`);
    const customDiffsOutputFolder = resolve(`./test-results/compare/12-1/custom`);

    await expect(
        comparePdf(Buffer.from('actual-pdf'), Buffer.from('expected-pdf'), {
            writeDiffs: true,
            excludedAreas: [
                {
                    pageNumber: 1,
                    excludedAreas: [{ x1: 0, y1: 0, x2: 0, y2: 0 }],
                },
            ],
            diffsOutputFolder: defaultDiffsOutputFolder,
        }),
    ).resolves.toBeFalsy();

    await expect(
        comparePdf(Buffer.from('actual-pdf'), Buffer.from('expected-pdf'), {
            writeDiffs: true,
            excludedAreas: [
                {
                    pageNumber: 1,
                    excludedAreas: [{ x1: 0, y1: 0, x2: 0, y2: 0 }],
                    excludedAreaColor: { r: 255, g: 255, b: 255 },
                },
            ],
            diffsOutputFolder: customDiffsOutputFolder,
        }),
    ).resolves.toBeFalsy();

    const defaultDiff = readFileSync(resolve(defaultDiffsOutputFolder, 'diff_page-1.png'));
    const customDiff = readFileSync(resolve(customDiffsOutputFolder, 'diff_page-1.png'));

    expect(defaultDiff.equals(customDiff)).toBeFalsy();
    expect(getPixelColor(defaultDiff, 0, 0)).not.toEqual(getPixelColor(customDiff, 0, 0));
    expect(getPixelColor(defaultDiff, 1, 0)).toEqual(getPixelColor(customDiff, 1, 0));
});
