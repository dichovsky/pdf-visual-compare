import { lstatSync, mkdirSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, expect, test, vi } from 'vitest';

const { comparePngMock, pdfToPngMock } = vi.hoisted(() => ({
    comparePngMock: vi.fn(),
    pdfToPngMock: vi.fn(),
}));

vi.mock('pdf-to-png-converter', () => ({
    pdfToPng: pdfToPngMock,
}));

vi.mock('png-visual-compare', () => ({
    comparePng: comparePngMock,
}));

import { ComparePdfComparisonError, comparePdf } from '../src/index.js';

const TEST_ROOT = resolve('./test-results/compare/18-placeholder-cleanup');

function leafExists(path: string): boolean {
    try {
        lstatSync(path);
        return true;
    } catch {
        return false;
    }
}

function isSymbolicLink(path: string): boolean {
    try {
        return lstatSync(path).isSymbolicLink();
    } catch {
        return false;
    }
}

beforeEach(() => {
    comparePngMock.mockReset();
    pdfToPngMock.mockReset();
    rmSync(TEST_ROOT, { recursive: true, force: true });
    mkdirSync(TEST_ROOT, { recursive: true });
});

test('should discard the staged tempfile when comparePng throws (writeDiffs=true)', async () => {
    const diffsOutputFolder = resolve(TEST_ROOT, 'comparator-throw');
    mkdirSync(diffsOutputFolder, { recursive: true });

    pdfToPngMock
        // First call: metadata-only listing for actual PDF.
        .mockResolvedValueOnce([{ name: 'page-1.png', pageNumber: 1, kind: 'metadata' }])
        // Second call: metadata-only listing for expected PDF.
        .mockResolvedValueOnce([{ name: 'page-1.png', pageNumber: 1, kind: 'metadata' }])
        // Third call: actual page 1 content render.
        .mockResolvedValueOnce([
            { name: 'page-1.png', pageNumber: 1, content: Buffer.from('actual-bytes'), kind: 'content' },
        ])
        // Fourth call: expected page 1 content render.
        .mockResolvedValueOnce([
            { name: 'page-1.png', pageNumber: 1, content: Buffer.from('expected-bytes'), kind: 'content' },
        ]);

    comparePngMock.mockImplementationOnce(() => {
        throw new Error('comparator detonated mid-write');
    });

    const finalLeaf = resolve(diffsOutputFolder, 'diff_page-1.png');

    await expect(
        comparePdf(Buffer.from('actual-pdf'), Buffer.from('expected-pdf'), {
            writeDiffs: true,
            diffsOutputFolder,
        }),
    ).rejects.toThrow(ComparePdfComparisonError);

    // Neither the final published path nor any leftover staged tempfile may remain — the
    // diffs folder must be empty when the comparator throws (no zero-byte artifacts to
    // confuse CI). Use lstat so a dangling symlink would not slip past existsSync.
    expect(leafExists(finalLeaf)).toBe(false);
    expect(readdirSync(diffsOutputFolder)).toEqual([]);
});

test('should atomically overwrite a symlink planted at diffFilePath DURING the write window', async () => {
    // This is the precise TOCTOU window the rename-based strategy is designed to close:
    // the path guards have already validated the final path and the comparator has been
    // handed a staged tempfile. An attacker with write access in the diffs folder now
    // plants a symlink at the *final* diff path before our atomic rename runs. Without
    // the tempfile+rename approach, the comparator's open-by-pathname write would follow
    // the symlink and leak bytes to the attacker's target. With atomic rename, the
    // symlink entry is simply overwritten — its target file is never opened by us.
    const diffsOutputFolder = resolve(TEST_ROOT, 'in-flight-symlink');
    mkdirSync(diffsOutputFolder, { recursive: true });

    const escapeTarget = resolve(TEST_ROOT, 'in-flight-escape-target.png');
    rmSync(escapeTarget, { force: true });
    const finalLeaf = resolve(diffsOutputFolder, 'diff_page-1.png');

    pdfToPngMock
        .mockResolvedValueOnce([{ name: 'page-1.png', pageNumber: 1, kind: 'metadata' }])
        .mockResolvedValueOnce([{ name: 'page-1.png', pageNumber: 1, kind: 'metadata' }])
        .mockResolvedValueOnce([
            { name: 'page-1.png', pageNumber: 1, content: Buffer.from('actual-bytes'), kind: 'content' },
        ])
        .mockResolvedValueOnce([
            { name: 'page-1.png', pageNumber: 1, content: Buffer.from('expected-bytes'), kind: 'content' },
        ]);

    comparePngMock.mockImplementationOnce((_actual, _expected, opts: { diffFilePath?: string }) => {
        // 1) Simulate the attacker racing in a symlink at the final published path right now,
        //    after our guards have already validated the path is safe.
        symlinkSync(escapeTarget, finalLeaf);
        // 2) Write the diff bytes to the *staged tempfile* the library directed us at. A
        //    legitimate comparator would do exactly this; the attacker has no influence over
        //    the tempfile path (random 128-bit suffix).
        writeFileSync(opts.diffFilePath ?? '', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
        // 3) Report a mismatch so the library expects a diff to have been written.
        return 999;
    });

    await comparePdf(Buffer.from('actual-pdf'), Buffer.from('expected-pdf'), {
        writeDiffs: true,
        diffsOutputFolder,
    });

    // The escape target must NOT have been opened — renameSync replaces the directory entry
    // at finalLeaf without ever following the planted symlink.
    expect(leafExists(escapeTarget)).toBe(false);
    // The published leaf is the comparator's bytes via the staged tempfile, NOT the symlink.
    expect(isSymbolicLink(finalLeaf)).toBe(false);
    expect(lstatSync(finalLeaf).isFile()).toBe(true);
});
