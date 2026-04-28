import { existsSync, lstatSync, mkdirSync, realpathSync, statSync } from 'node:fs';
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
