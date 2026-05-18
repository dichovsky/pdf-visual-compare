import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { ComparePdfConfigurationError } from '../errors/ComparePdfConfigurationError.js';
import { assertPathAndAncestorsAreNotSymbolicLinks } from './securePath.js';
import type { PdfRenderOptions } from '../types/PdfRenderOptions.js';

/**
 * Validates `pdfToPngConvertOptions.outputFolder` with the same sandbox-parity contract
 * applied to `diffsOutputFolder` and `allowedInputRoot`:
 *
 * - rejects non-string / empty / whitespace-only values
 * - rejects a path that already exists as a non-directory
 * - rejects a path whose existing chain contains any symbolic link (closes CWE-59 /
 *   CWE-61 redirect attacks where an attacker pre-plants a symlink so the renderer
 *   writes intermediate PNGs to a target outside the intended workspace)
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

    return resolvedOutputFolder;
}
