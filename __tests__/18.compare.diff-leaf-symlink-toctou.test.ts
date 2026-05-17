import { lstatSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { platform } from 'node:process';
import { beforeEach, expect, test } from 'vitest';
import { ComparePdfConfigurationError, comparePdf, comparePdfDetailed } from '../src/index.js';

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

const DIFF_ROOT = resolve('./test-results/compare/18-diff-leaf-symlink-toctou');

function ensureCleanRoot(subdir: string): string {
    const dir = resolve(DIFF_ROOT, subdir);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    return dir;
}

beforeEach(() => {
    rmSync(DIFF_ROOT, { recursive: true, force: true });
});

test('should reject a pre-planted symlink at the auto-generated diff leaf via the path walker', async () => {
    const diffsOutputFolder = ensureCleanRoot('auto-leaf');
    const escapeTarget = resolve(DIFF_ROOT, 'auto-leaf-escape-target.png');
    rmSync(escapeTarget, { force: true });

    const plantedLeaf = resolve(diffsOutputFolder, 'diff_comparePdf_1.png');
    symlinkSync(escapeTarget, plantedLeaf);

    const comparePromise = comparePdfDetailed('./test-data/pdf1.pdf', './test-data/pdf2.pdf', {
        writeDiffs: true,
        diffsOutputFolder,
    });

    await expect(comparePromise).rejects.toThrow(ComparePdfConfigurationError);
    await expect(comparePromise).rejects.toThrow(/Diff output path must stay within diffsOutputFolder/);
    // Use lstat (not existsSync) so a dangling symlink at the escape target would still
    // register as "no file" while a live symlink would be detected.
    expect(leafExists(escapeTarget)).toBe(false);
    // The original symlink stays in place — the library refused to engage with the path at all.
    expect(isSymbolicLink(plantedLeaf)).toBe(true);
});

test('should reject a pre-planted symlink at a user-configured diffFilePath', async () => {
    const diffsOutputFolder = ensureCleanRoot('user-leaf');
    const escapeTarget = resolve(DIFF_ROOT, 'user-leaf-escape-target.png');
    rmSync(escapeTarget, { force: true });

    const userDiffPath = resolve(diffsOutputFolder, 'attacker-leaf.png');
    symlinkSync(escapeTarget, userDiffPath);

    const comparePromise = comparePdf('./test-data/pdf1.pdf', './test-data/pdf2.pdf', {
        writeDiffs: true,
        diffsOutputFolder,
        excludedAreas: [{ pageNumber: 1, diffFilePath: userDiffPath }],
    });

    await expect(comparePromise).rejects.toThrow(ComparePdfConfigurationError);
    await expect(comparePromise).rejects.toThrow(/Diff output path must stay within diffsOutputFolder/);
    expect(leafExists(escapeTarget)).toBe(false);
    expect(isSymbolicLink(userDiffPath)).toBe(true);
});

test('should still overwrite a stale regular-file diff leaf from a prior comparison run', async () => {
    const diffsOutputFolder = ensureCleanRoot('stale-leaf');
    const stalePath = resolve(diffsOutputFolder, 'diff_comparePdf_1.png');
    writeFileSync(stalePath, Buffer.from('stale-contents-from-previous-run'));

    const result = await comparePdfDetailed('./test-data/pdf1.pdf', './test-data/pdf2.pdf', {
        writeDiffs: true,
        diffsOutputFolder,
    });

    expect(result.isEqual).toBe(false);
    // Stale bytes must be gone; a fresh diff PNG should now be on disk.
    expect(readFileSync(stalePath).equals(Buffer.from('stale-contents-from-previous-run'))).toBe(false);
});

test('should NOT leave an empty placeholder file when pages match (writeDiffs=true)', async () => {
    const diffsOutputFolder = ensureCleanRoot('matched-pages');

    const result = await comparePdfDetailed('./test-data/pdf1.pdf', './test-data/pdf11.pdf', {
        writeDiffs: true,
        diffsOutputFolder,
    });

    expect(result.isEqual).toBe(true);
    // Neither the staged tempfile nor a published leaf may remain — consumers expect "no
    // diff file" when there is no diff. Use lstat-based checks so a dangling symlink would
    // also be caught (existsSync would silently return false on a broken symlink).
    const publishedLeaf = resolve(diffsOutputFolder, 'diff_comparePdf_1.png');
    expect(leafExists(publishedLeaf)).toBe(false);
});

// POSIX-only: mode 0o500 is ignored on Windows (NTFS uses ACLs rather than mode bits), so
// the directory would remain writable and the assertion would never trip. The published
// package's `os` field already excludes win32, but skip explicitly to be self-documenting.
test.skipIf(platform === 'win32')(
    'should surface ComparePdfConfigurationError when the diff folder is read-only',
    async () => {
        const diffsOutputFolder = ensureCleanRoot('readonly');

        try {
            // 0o500 = r-x------; readable + executable but not writable for the owner.
            rmSync(diffsOutputFolder, { recursive: true, force: true });
            mkdirSync(diffsOutputFolder, { recursive: true, mode: 0o500 });

            await expect(
                comparePdfDetailed('./test-data/pdf1.pdf', './test-data/pdf2.pdf', {
                    writeDiffs: true,
                    diffsOutputFolder,
                }),
            ).rejects.toThrow(ComparePdfConfigurationError);
        } finally {
            // Restore mode so cleanup in subsequent runs can remove the directory.
            rmSync(diffsOutputFolder, { recursive: true, force: true });
        }
    },
);
