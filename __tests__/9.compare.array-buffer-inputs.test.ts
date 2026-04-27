import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { comparePdf } from '../src';

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

test(`should return true for equal PDF ArrayBuffers`, async () => {
    expect(
        await comparePdf(toArrayBuffer(readFileSync('./test-data/pdf1.pdf')), toArrayBuffer(readFileSync('./test-data/pdf11.pdf'))),
    ).toBeTruthy();
});

test(`should return false for non equal PDF ArrayBuffers`, async () => {
    expect(
        await comparePdf(toArrayBuffer(readFileSync('./test-data/pdf1.pdf')), toArrayBuffer(readFileSync('./test-data/pdf2.pdf'))),
    ).toBeFalsy();
});
