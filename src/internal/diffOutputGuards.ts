import {
    closeSync,
    constants,
    existsSync,
    lstatSync,
    mkdirSync,
    openSync,
    realpathSync,
    renameSync,
    statSync,
    unlinkSync,
} from 'node:fs';
import { randomBytes } from 'node:crypto';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { ComparePdfConfigurationError } from '../errors/ComparePdfConfigurationError.js';
import { getDefaultDiffsFolder } from '../const.js';
import type { ComparePdfOptions } from '../types/ComparePdfOptions.js';

export function validateDiffsOutputFolder(diffsOutputFolder: ComparePdfOptions['diffsOutputFolder']): string {
    const outputFolder = diffsOutputFolder === undefined ? getDefaultDiffsFolder() : diffsOutputFolder;

    if (typeof outputFolder !== 'string' || outputFolder.trim() === '') {
        throw new ComparePdfConfigurationError('diffsOutputFolder must be a non-empty string.');
    }

    const resolvedOutputFolder = resolve(outputFolder);
    if (existsSync(resolvedOutputFolder) && !statSync(resolvedOutputFolder).isDirectory()) {
        throw new ComparePdfConfigurationError(
            `diffsOutputFolder must point to a directory when it already exists: ${outputFolder}`,
        );
    }

    assertPathAndExistingAncestorsAreNotSymbolicLinks(resolvedOutputFolder, outputFolder);

    return resolvedOutputFolder;
}

export function ensureDiffOutputDirectory(outputPath: string, diffsOutputFolder: string): void {
    try {
        mkdirSync(dirname(outputPath), { recursive: true });
    } catch (cause) {
        throw new ComparePdfConfigurationError(
            `diffsOutputFolder must point to a writable directory: ${diffsOutputFolder}`,
            { cause },
        );
    }
}

export function assertDiffOutputPathUsesRealFilesystemEntries(diffFilePath: string, diffsOutputFolder: string): void {
    const resolvedDiffsOutputFolder = resolve(diffsOutputFolder);

    if (pathExistsWithoutFollowingSymlinks(resolvedDiffsOutputFolder)) {
        assertPathIsNotSymbolicLink(resolvedDiffsOutputFolder, diffsOutputFolder);
    }

    const relativeDiffPath = relative(resolvedDiffsOutputFolder, resolve(diffFilePath));
    if (relativeDiffPath === '' || isAbsolute(relativeDiffPath) || relativeDiffPath.startsWith('..')) {
        return;
    }

    let currentPath = resolvedDiffsOutputFolder;
    for (const segment of relativeDiffPath.split(sep)) {
        currentPath = resolve(currentPath, segment);

        if (!pathExistsWithoutFollowingSymlinks(currentPath)) {
            return;
        }

        assertPathIsNotSymbolicLink(currentPath, diffsOutputFolder);
    }
}

/**
 * Atomically creates a fresh, randomly-named tempfile in the same directory as the diff leaf
 * and returns its path. The third-party comparator is then directed at this tempfile, and the
 * result is later promoted into `diffFilePath` via {@link publishDiffOutputTempfile}.
 *
 * This two-step "stage then rename" pattern is materially stronger than writing directly to
 * `diffFilePath`:
 * - The tempfile name carries an unpredictable random suffix, so an attacker with write
 *   access in `diffsOutputFolder` cannot pre-plant a symlink at the future tempfile path.
 * - The tempfile is opened with `O_CREAT | O_EXCL | O_NOFOLLOW`, so any racing attempt to
 *   pre-create a regular file or symlink at the same path during the open is rejected
 *   (CWE-61 / CWE-367).
 * - The eventual atomic `renameSync` (see {@link publishDiffOutputTempfile}) replaces any
 *   pre-existing entry at `diffFilePath` — including a symlink planted there during the
 *   write window — without ever following the destination's symlink.
 */
export function createSecureDiffOutputTempfile(diffFilePath: string, diffsOutputFolder: string): string {
    const tempfilePath = buildSecureTempfilePath(diffFilePath);
    let fileDescriptor: number | undefined;
    try {
        fileDescriptor = openSync(
            tempfilePath,
            constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
            0o600,
        );
    } catch (cause) {
        if (isSymbolicLinkAtLeafError(cause) || isExistingLeafError(cause)) {
            throw new ComparePdfConfigurationError(
                `Diff output path must stay within diffsOutputFolder: ${resolve(diffsOutputFolder)}`,
                { cause },
            );
        }
        throw new ComparePdfConfigurationError(
            `diffsOutputFolder must point to a writable directory: ${diffsOutputFolder}`,
            { cause },
        );
    } finally {
        if (fileDescriptor !== undefined) {
            closeSync(fileDescriptor);
        }
    }
    return tempfilePath;
}

function buildSecureTempfilePath(diffFilePath: string): string {
    const parentDir = dirname(diffFilePath);
    const leafName = basename(diffFilePath);
    // 128 bits of randomness make pre-planting the tempfile path infeasible even for an
    // attacker who can race writes inside the diffs folder.
    const randomSuffix = randomBytes(16).toString('hex');
    return resolve(parentDir, `.${leafName}.${randomSuffix}.tmp`);
}

export type PublishDiffOutputTempfileOptions = {
    /**
     * `true` when the comparator was expected to produce a diff PNG (mismatched pages above
     * threshold). A missing or empty tempfile in that case becomes a
     * `ComparePdfConfigurationError` because the diff bytes must already be on disk; their
     * absence implies attacker deletion, a symlink-redirected write, or a silent comparator
     * failure that callers must surface.
     *
     * `false` when the comparator was expected to skip writing (matching pages). Missing or
     * empty tempfile is then the normal "no diff to report" case; any stale leaf at the final
     * path is removed so on-disk state matches the pre-fix behavior.
     */
    expectDiffWritten: boolean;
};

/**
 * Promotes the staged tempfile to `diffFilePath` via atomic `renameSync`. This is the
 * core anti-TOCTOU primitive: `rename()` replaces any pre-existing file or symlink at
 * the destination as a single directory-entry operation without ever following the
 * destination. A symlink planted at `diffFilePath` during the write window is therefore
 * harmlessly overwritten — the attacker's chosen target is never opened by this library.
 *
 * Throws `ComparePdfConfigurationError` when:
 * - the tempfile is no longer a regular file (symlink swap during the comparator's write
 *   — bytes may have leaked through the swapped symlink to an attacker-chosen target);
 * - a diff was expected but the tempfile is missing or zero bytes;
 * - the tempfile cannot be inspected, or rename fails for reasons other than absence.
 */
export function publishDiffOutputTempfile(
    tempfilePath: string,
    diffFilePath: string,
    diffsOutputFolder: string,
    options: PublishDiffOutputTempfileOptions,
): void {
    let tempStats: ReturnType<typeof lstatSync>;
    try {
        tempStats = lstatSync(tempfilePath);
    } catch (cause) {
        if (isMissingLeafError(cause)) {
            if (options.expectDiffWritten) {
                throw new ComparePdfConfigurationError(
                    `Diff output was expected but is missing: ${resolve(diffFilePath)}`,
                    { cause },
                );
            }
            // Comparator skipped writing AND there is no tempfile — also drop any stale
            // leaf at the published path so the on-disk shape matches pre-fix behavior.
            discardDiffOutputLeaf(diffFilePath);
            return;
        }
        throw new ComparePdfConfigurationError(
            `Diff output path must stay within diffsOutputFolder: ${resolve(diffsOutputFolder)}`,
            { cause },
        );
    }

    if (!tempStats.isFile()) {
        discardDiffOutputLeaf(tempfilePath);
        throw new ComparePdfConfigurationError(
            `Diff output tempfile was replaced during the write window: ${resolve(tempfilePath)}`,
        );
    }

    if (tempStats.size === 0) {
        discardDiffOutputLeaf(tempfilePath);
        if (options.expectDiffWritten) {
            throw new ComparePdfConfigurationError(`Diff output was expected but is empty: ${resolve(diffFilePath)}`);
        }
        discardDiffOutputLeaf(diffFilePath);
        return;
    }

    try {
        renameSync(tempfilePath, diffFilePath);
    } catch (cause) {
        discardDiffOutputLeaf(tempfilePath);
        throw new ComparePdfConfigurationError(`Failed to publish diff output to ${resolve(diffFilePath)}`, { cause });
    }
}

/**
 * Best-effort removal of a diff output file. Callers use this to roll back the staged
 * tempfile when the third-party comparator throws before writing, and to clear stale
 * leaves at the published path when no diff was produced for matching pages.
 */
export function discardDiffOutputLeaf(diffFilePath: string): void {
    try {
        unlinkSync(diffFilePath);
    } catch {
        // Best-effort cleanup only.
    }
}

function isSymbolicLinkAtLeafError(cause: unknown): cause is NodeJS.ErrnoException {
    return cause instanceof Error && 'code' in cause && (cause.code === 'ELOOP' || cause.code === 'EMLINK');
}

function isExistingLeafError(cause: unknown): cause is NodeJS.ErrnoException {
    return cause instanceof Error && 'code' in cause && cause.code === 'EEXIST';
}

function isMissingLeafError(cause: unknown): cause is NodeJS.ErrnoException {
    return cause instanceof Error && 'code' in cause && cause.code === 'ENOENT';
}

export function assertCanonicalDiffOutputPath(diffFilePath: string, diffsOutputFolder: string): void {
    const canonicalDiffsOutputFolder = realpathSync(diffsOutputFolder);
    const canonicalDiffFileParent = realpathSync(dirname(diffFilePath));

    if (!isPathWithinRoot(canonicalDiffFileParent, canonicalDiffsOutputFolder)) {
        throw new ComparePdfConfigurationError(
            `Diff output path must stay within diffsOutputFolder: ${resolve(diffsOutputFolder)}`,
        );
    }
}

function assertPathAndExistingAncestorsAreNotSymbolicLinks(pathToCheck: string, diffsOutputFolder: string): void {
    const existingAncestorPaths: string[] = [];
    let currentPath = resolve(pathToCheck);

    while (true) {
        if (pathExistsWithoutFollowingSymlinks(currentPath)) {
            existingAncestorPaths.push(currentPath);
        }

        const parentPath = dirname(currentPath);
        if (parentPath === currentPath) {
            break;
        }

        currentPath = parentPath;
    }

    for (const existingPath of existingAncestorPaths.reverse()) {
        assertPathIsNotSymbolicLink(existingPath, diffsOutputFolder);
    }
}

function assertPathIsNotSymbolicLink(pathToCheck: string, diffsOutputFolder: string): void {
    if (!lstatSync(pathToCheck).isSymbolicLink()) {
        return;
    }

    throw new ComparePdfConfigurationError(
        `Diff output path must stay within diffsOutputFolder: ${resolve(diffsOutputFolder)}`,
    );
}

function pathExistsWithoutFollowingSymlinks(pathToCheck: string): boolean {
    try {
        lstatSync(pathToCheck);
        return true;
    } catch {
        return false;
    }
}

function isPathWithinRoot(pathToCheck: string, rootPath: string): boolean {
    const relativePath = relative(rootPath, pathToCheck);
    return relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath));
}
