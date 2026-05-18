import { mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { beforeEach, expect, test } from 'vitest';
import { ComparePdfConfigurationError } from '../src/errors/ComparePdfConfigurationError.js';
import { normalizeComparisonOptions } from '../src/internal/normalizeComparisonOptions.js';

const TEST_ROOT = resolve('./test-results/compare/19-render-output-folder-validation');

function ensureCleanRoot(subdir: string): string {
    const dir = resolve(TEST_ROOT, subdir);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    return dir;
}

beforeEach(() => {
    rmSync(TEST_ROOT, { recursive: true, force: true });
});

test('should pass through undefined outputFolder unchanged (in-memory render)', () => {
    const normalized = normalizeComparisonOptions({});
    expect(normalized.pdfToPngConvertOpts.outputFolder).toBeUndefined();
});

test.each([123, null, {}, [], true])('should reject non-string outputFolder %s', (value) => {
    expect(() =>
        normalizeComparisonOptions({
            pdfToPngConvertOptions: { outputFolder: value as never },
        }),
    ).toThrow(ComparePdfConfigurationError);
    expect(() =>
        normalizeComparisonOptions({
            pdfToPngConvertOptions: { outputFolder: value as never },
        }),
    ).toThrow('pdfToPngConvertOptions.outputFolder must be a non-empty string.');
});

test.each(['', '   ', '\t', '\n'])('should reject empty/whitespace outputFolder %j', (value) => {
    expect(() =>
        normalizeComparisonOptions({
            pdfToPngConvertOptions: { outputFolder: value },
        }),
    ).toThrow(ComparePdfConfigurationError);
    expect(() =>
        normalizeComparisonOptions({
            pdfToPngConvertOptions: { outputFolder: value },
        }),
    ).toThrow('pdfToPngConvertOptions.outputFolder must be a non-empty string.');
});

test('should reject outputFolder that exists as a regular file', () => {
    const baseDir = ensureCleanRoot('exists-as-file');
    const filePath = resolve(baseDir, 'not-a-dir.txt');
    writeFileSync(filePath, 'regular file');

    expect(() =>
        normalizeComparisonOptions({
            pdfToPngConvertOptions: { outputFolder: filePath },
        }),
    ).toThrow(ComparePdfConfigurationError);
    expect(() =>
        normalizeComparisonOptions({
            pdfToPngConvertOptions: { outputFolder: filePath },
        }),
    ).toThrow(`pdfToPngConvertOptions.outputFolder must point to a directory when it already exists: ${filePath}`);
});

test('should reject outputFolder that is itself a symbolic link', () => {
    const baseDir = ensureCleanRoot('leaf-symlink');
    const realTarget = resolve(baseDir, 'real-target');
    mkdirSync(realTarget);
    const symlinkPath = resolve(baseDir, 'planted-link');
    symlinkSync(realTarget, symlinkPath);

    expect(() =>
        normalizeComparisonOptions({
            pdfToPngConvertOptions: { outputFolder: symlinkPath },
        }),
    ).toThrow(ComparePdfConfigurationError);
    expect(() =>
        normalizeComparisonOptions({
            pdfToPngConvertOptions: { outputFolder: symlinkPath },
        }),
    ).toThrow(/pdfToPngConvertOptions.outputFolder must not traverse a symbolic link/);
});

test('should reject outputFolder when an existing ancestor is a symbolic link', () => {
    const baseDir = ensureCleanRoot('ancestor-symlink');
    const realParent = resolve(baseDir, 'real-parent');
    mkdirSync(realParent);
    const ancestorLink = resolve(baseDir, 'parent-link');
    symlinkSync(realParent, ancestorLink);

    // The leaf does not exist yet, but a parent in its chain is a symlink.
    const outputFolder = resolve(ancestorLink, 'render-output');

    expect(() =>
        normalizeComparisonOptions({
            pdfToPngConvertOptions: { outputFolder },
        }),
    ).toThrow(ComparePdfConfigurationError);
    expect(() =>
        normalizeComparisonOptions({
            pdfToPngConvertOptions: { outputFolder },
        }),
    ).toThrow(/pdfToPngConvertOptions.outputFolder must not traverse a symbolic link/);
});

test('should accept a valid existing directory and resolve it to an absolute path', () => {
    const baseDir = ensureCleanRoot('valid-existing');

    const normalized = normalizeComparisonOptions({
        pdfToPngConvertOptions: { outputFolder: baseDir },
    });

    expect(normalized.pdfToPngConvertOpts.outputFolder).toBe(resolve(baseDir));
});

test('should accept a non-existent path under an existing real parent so the renderer can create it', () => {
    const baseDir = ensureCleanRoot('valid-non-existent');
    const toBeCreated = resolve(baseDir, 'will-be-created-by-renderer');

    const normalized = normalizeComparisonOptions({
        pdfToPngConvertOptions: { outputFolder: toBeCreated },
    });

    expect(normalized.pdfToPngConvertOpts.outputFolder).toBe(resolve(toBeCreated));
});

test('should accept a relative outputFolder and resolve it to absolute', () => {
    const baseDir = ensureCleanRoot('relative-path');
    const cwdRelative = `./${relative(process.cwd(), baseDir)}`;

    const normalized = normalizeComparisonOptions({
        pdfToPngConvertOptions: { outputFolder: cwdRelative },
    });

    expect(normalized.pdfToPngConvertOpts.outputFolder).toBe(resolve(cwdRelative));
});
