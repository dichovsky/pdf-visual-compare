import { existsSync, mkdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, expect, test } from 'vitest';
import { ComparePdfConfigurationError, comparePdf, comparePdfDetailed } from '../src/index.js';

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

test('should refuse to write through a symlink planted at the auto-generated diff leaf', async () => {
    const diffsOutputFolder = ensureCleanRoot('auto-leaf');
    const escapeTarget = resolve(DIFF_ROOT, 'auto-leaf-escape-target.png');
    rmSync(escapeTarget, { force: true });

    const plantedLeaf = resolve(diffsOutputFolder, 'diff_comparePdf_1.png');
    symlinkSync(escapeTarget, plantedLeaf);

    const comparePromise = comparePdfDetailed('./test-data/pdf1.pdf', './test-data/pdf2.pdf', {
        writeDiffs: true,
        diffsOutputFolder,
    });

    // Either the symlink is rejected (preferred path) or the planted leaf is removed and
    // replaced with a real regular file pointing nowhere outside the diffs root.
    await comparePromise.catch(() => undefined);

    expect(existsSync(escapeTarget)).toBe(false);
    // The leaf must no longer be a symlink — either deleted or replaced with a real file.
    if (existsSync(plantedLeaf)) {
        expect(statSync(plantedLeaf).isFile()).toBe(true);
    }
});

test('should refuse a user-configured diffFilePath that already exists as a symlink', async () => {
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

    await comparePromise.catch(() => undefined);

    expect(existsSync(escapeTarget)).toBe(false);
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
    // The placeholder created by preCreateDiffOutputLeaf must be removed when comparePng
    // wrote nothing — otherwise consumers would see misleading zero-byte diff files.
    const placeholderPath = resolve(diffsOutputFolder, 'diff_comparePdf_1.png');
    expect(existsSync(placeholderPath)).toBe(false);
});

test('should surface ComparePdfConfigurationError when the diff folder is read-only', async () => {
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
});
