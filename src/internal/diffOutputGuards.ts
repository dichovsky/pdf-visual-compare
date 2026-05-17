import {
    closeSync,
    constants,
    existsSync,
    lstatSync,
    mkdirSync,
    openSync,
    realpathSync,
    statSync,
    unlinkSync,
} from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
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
 * Atomically pre-creates the diff leaf file so the subsequent third-party write cannot follow
 * a symlink that was planted between the path validation and the actual write.
 *
 * Any stale regular file or symlink from a prior run is removed first so the existing
 * "overwrite previous diff" behavior is preserved. The new leaf is then opened with
 * `O_CREAT | O_EXCL | O_NOFOLLOW`, which:
 * - fails if any file appears at the leaf between the unlink and this open (CWE-367);
 * - fails if the leaf is or becomes a symbolic link before this open completes (CWE-61);
 * - never traverses an existing symlink at the leaf component.
 */
export function preCreateDiffOutputLeaf(diffFilePath: string, diffsOutputFolder: string): void {
    removeStaleDiffLeaf(diffFilePath, diffsOutputFolder);

    let fileDescriptor: number | undefined;
    try {
        fileDescriptor = openSync(
            diffFilePath,
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
}

function removeStaleDiffLeaf(diffFilePath: string, diffsOutputFolder: string): void {
    try {
        unlinkSync(diffFilePath);
    } catch (cause) {
        if (isMissingLeafError(cause)) {
            return;
        }
        throw new ComparePdfConfigurationError(
            `diffsOutputFolder must point to a writable directory: ${diffsOutputFolder}`,
            { cause },
        );
    }
}

export type VerifyDiffOutputLeafOptions = {
    /**
     * `true` when the comparator was expected to produce a diff PNG (mismatched pages above
     * threshold). A missing or empty leaf in that case becomes a `ComparePdfConfigurationError`
     * because the diff bytes must already be on disk; their absence implies attacker deletion
     * or a silent failure that callers must surface.
     *
     * `false` when the comparator was expected to skip writing (matching pages). Missing or
     * empty leaf is then the normal "no diff to report" case and the placeholder is cleaned up.
     */
    expectDiffWritten: boolean;
};

/**
 * After the third-party comparator returns, confirm the diff leaf matches the expected state:
 * a real regular file when a diff was expected, or no file (placeholder cleaned up) when not.
 *
 * Throws `ComparePdfConfigurationError` when:
 * - the leaf is no longer a regular file (symlink swap during the write window — diff bytes
 *   may have leaked through to an attacker-chosen target);
 * - a diff was expected but the leaf is missing or zero bytes (attacker deletion or silent
 *   comparator failure);
 * - the leaf cannot be inspected for reasons other than absence.
 */
export function verifyDiffOutputLeafAfterWrite(
    diffFilePath: string,
    diffsOutputFolder: string,
    options: VerifyDiffOutputLeafOptions,
): void {
    let leafStats;
    try {
        leafStats = lstatSync(diffFilePath);
    } catch (cause) {
        if (isMissingLeafError(cause)) {
            // Absence is only acceptable when the comparator was expected to skip writing.
            // Otherwise the placeholder we pre-created was removed during the write window
            // (attacker deletion, racing process, or comparator silently failing).
            if (options.expectDiffWritten) {
                throw new ComparePdfConfigurationError(
                    `Diff output was expected but is missing: ${resolve(diffFilePath)}`,
                    { cause },
                );
            }
            return;
        }
        throw new ComparePdfConfigurationError(
            `Diff output path must stay within diffsOutputFolder: ${resolve(diffsOutputFolder)}`,
            { cause },
        );
    }

    if (!leafStats.isFile()) {
        discardDiffOutputLeaf(diffFilePath);
        throw new ComparePdfConfigurationError(
            `Diff output path was replaced during the write window: ${resolve(diffFilePath)}`,
        );
    }

    if (leafStats.size === 0) {
        // Empty file: comparator did not write. Always remove the placeholder so the on-disk
        // shape matches pre-fix behavior; surface an error when bytes were expected.
        discardDiffOutputLeaf(diffFilePath);
        if (options.expectDiffWritten) {
            throw new ComparePdfConfigurationError(`Diff output was expected but is empty: ${resolve(diffFilePath)}`);
        }
    }
}

/**
 * Best-effort removal of the pre-created diff leaf. Callers use this to roll back the
 * placeholder when the third-party comparator throws before writing — otherwise the
 * zero-byte placeholder leaks into the diffs folder and confuses CI artifact pipelines.
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
