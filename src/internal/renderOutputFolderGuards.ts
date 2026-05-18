import { existsSync, lstatSync, mkdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ComparePdfConfigurationError } from '../errors/ComparePdfConfigurationError.js';
import { assertPathAndAncestorsAreNotSymbolicLinks } from './securePath.js';
import type { PdfRenderOptions } from '../types/PdfRenderOptions.js';

/**
 * `renderPdfPages` namespaces the renderer output under these subdirectories so the
 * actual and expected PDFs cannot collide on a shared `outputFileMaskFunc`. The validator
 * pre-creates and lstat-verifies both leaves so the future write destinations cannot be
 * replaced by symbolic links between validation and the renderer's first write.
 */
const RENDER_OUTPUT_NAMESPACES = ['actual', 'expected'] as const;

/**
 * Validates `pdfToPngConvertOptions.outputFolder` with the same sandbox-parity contract
 * applied to `diffsOutputFolder` and `allowedInputRoot`:
 *
 * - rejects non-string / empty / whitespace-only values
 * - rejects a path that already exists as a non-directory
 * - rejects a path whose existing chain contains any symbolic link (closes CWE-59 /
 *   CWE-61 redirect attacks where an attacker pre-plants a symlink so the renderer
 *   writes intermediate PNGs to a target outside the intended workspace)
 * - takes library ownership of leaf-directory creation for the resolved path AND the
 *   `actual/` / `expected/` namespaces that `renderPdfPages` writes into, then re-asserts
 *   each leaf is a real (non-symlink) directory. This closes the residual validate→render
 *   TOCTOU window that the path walker cannot cover on its own: once a non-symlink
 *   directory exists at every future write destination, an attacker can no longer plant a
 *   symlink there between validation and the renderer's first write (CWE-367 / CWE-61).
 *
 * Returns the resolved absolute path so downstream renderer calls operate on a stable
 * location, regardless of process cwd changes between configuration and render time.
 * Returns `undefined` when no `outputFolder` was supplied (in-memory render).
 */
export function validateRenderOutputFolder(outputFolder: PdfRenderOptions['outputFolder']): string | undefined {
    if (outputFolder === undefined) {
        return undefined;
    }

    if (typeof outputFolder !== 'string' || outputFolder.trim() === '') {
        throw new ComparePdfConfigurationError('pdfToPngConvertOptions.outputFolder must be a non-empty string.');
    }

    const resolvedOutputFolder = resolve(outputFolder);

    if (existsSync(resolvedOutputFolder) && !statSync(resolvedOutputFolder).isDirectory()) {
        throw new ComparePdfConfigurationError(
            `pdfToPngConvertOptions.outputFolder must point to a directory when it already exists: ${outputFolder}`,
        );
    }

    assertPathAndAncestorsAreNotSymbolicLinks(
        resolvedOutputFolder,
        `pdfToPngConvertOptions.outputFolder must not traverse a symbolic link: ${resolve(outputFolder)}`,
    );

    ensureRealDirectory(resolvedOutputFolder);
    for (const namespace of RENDER_OUTPUT_NAMESPACES) {
        ensureRealDirectory(join(resolvedOutputFolder, namespace));
    }

    return resolvedOutputFolder;
}

/**
 * Creates `pathToCheck` as a real directory and re-asserts the on-disk entry is not a
 * symbolic link. `mkdirSync({ recursive: true })` is a no-op when the target already
 * exists, and crucially it follows existing symlinks-to-directories silently — the
 * post-mkdir `lstat` is what catches a pre-planted symlink at this exact location.
 */
function ensureRealDirectory(pathToCheck: string): void {
    try {
        mkdirSync(pathToCheck, { recursive: true });
    } catch (cause) {
        throw new ComparePdfConfigurationError(
            `pdfToPngConvertOptions.outputFolder must point to a writable directory: ${pathToCheck}`,
            { cause },
        );
    }

    const stats = lstatSync(pathToCheck);
    if (stats.isSymbolicLink() || !stats.isDirectory()) {
        throw new ComparePdfConfigurationError(
            `pdfToPngConvertOptions.outputFolder must not traverse a symbolic link: ${pathToCheck}`,
        );
    }
}
