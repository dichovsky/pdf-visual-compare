import { lstatSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { ComparePdfConfigurationError } from '../errors/ComparePdfConfigurationError.js';

/**
 * Shared path-containment and symlink-rejection primitives used by every code path that
 * lets a caller name a filesystem location. Two adapters were drifting before this seam
 * existed (`src/internal/normalizePdfInput.ts` for `allowedInputRoot` and
 * `src/internal/diffOutputGuards.ts` for `diffsOutputFolder`), and a third caller has
 * since landed for `pdfToPngConvertOptions.outputFolder`. Centralizing the symlink-swap
 * defense here keeps the CWE-59 / CWE-61 fix in one place.
 */

/**
 * Returns `true` when `pathToCheck` is `rootPath` itself or a descendant of it. The
 * comparison is purely lexical and operates on already-resolved absolute paths — callers
 * resolve and (when relevant) canonicalize before calling.
 */
export function isPathWithinRoot(pathToCheck: string, rootPath: string): boolean {
    const relativePath = relative(rootPath, pathToCheck);
    return relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath));
}

/**
 * Reports whether a filesystem entry exists at `pathToCheck` without following symbolic
 * links. Returning `true` does not imply the entry is a regular file or directory —
 * callers must inspect the lstat result separately.
 */
export function pathExistsWithoutFollowingSymlinks(pathToCheck: string): boolean {
    try {
        lstatSync(pathToCheck);
        return true;
    } catch {
        return false;
    }
}

/**
 * Throws `ComparePdfConfigurationError` when `pathToCheck` itself is a symbolic link.
 * The path must already exist — callers are expected to have established existence via
 * {@link pathExistsWithoutFollowingSymlinks}.
 */
export function assertPathIsNotSymbolicLink(pathToCheck: string, errorMessage: string): void {
    if (!lstatSync(pathToCheck).isSymbolicLink()) {
        return;
    }

    throw new ComparePdfConfigurationError(errorMessage);
}

/**
 * Walks from `pathToCheck` up to the filesystem root and throws
 * `ComparePdfConfigurationError` if any existing ancestor (or `pathToCheck` itself) is a
 * symbolic link. Non-existent ancestors are skipped because they cannot redirect a write
 * before they are created — and the leaf-creation paths in each caller separately defend
 * against symlink swaps at creation time.
 */
export function assertPathAndAncestorsAreNotSymbolicLinks(pathToCheck: string, errorMessage: string): void {
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
        assertPathIsNotSymbolicLink(existingPath, errorMessage);
    }
}
