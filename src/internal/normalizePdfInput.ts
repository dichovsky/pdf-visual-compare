import { closeSync, existsSync, fstatSync, openSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { ComparePdfConfigurationError } from '../errors/ComparePdfConfigurationError.js';
import { ComparePdfInputError } from '../errors/ComparePdfInputError.js';
import type { ComparePdfOptions } from '../types/ComparePdfOptions.js';
import type { PdfInput } from '../types/PdfInput.js';
import type { AllowedInputRoot } from './types.js';

/**
 * Validates the type of the input file.
 *
 * Accepts a `Buffer`, `ArrayBuffer`, `SharedArrayBuffer`, or a string path. When
 * `allowedInputRoot` is configured, string paths must also resolve within that directory.
 * String paths are resolved and read directly so downstream filesystem errors become the
 * single source of truth for file access failures. Throws for any other input.
 */
export function normalizePdfInput(
    inputFile: unknown,
    inputLabel: 'actualPdf' | 'expectedPdf',
    allowedInputRoot?: AllowedInputRoot,
): PdfInput {
    if (Buffer.isBuffer(inputFile) || inputFile instanceof ArrayBuffer || inputFile instanceof SharedArrayBuffer) {
        return inputFile;
    }
    if (typeof inputFile === 'string') {
        const resolvedInputPath = resolve(inputFile);
        assertStringPathWithinAllowedInputRoot(resolvedInputPath, inputLabel, allowedInputRoot);
        let inputFileDescriptor: number | undefined;

        try {
            const canonicalInputPath = realpathSync(resolvedInputPath);
            assertStringPathWithinAllowedInputRoot(canonicalInputPath, inputLabel, allowedInputRoot);
            const canonicalInputStats = statSync(canonicalInputPath);
            if (!canonicalInputStats.isFile()) {
                throw new ComparePdfInputError(`PDF path is not a file: ${inputFile}`);
            }
            inputFileDescriptor = openSync(canonicalInputPath, 'r');

            if (allowedInputRoot) {
                const openedInputStats = fstatSync(inputFileDescriptor);
                if (openedInputStats.dev !== canonicalInputStats.dev || openedInputStats.ino !== canonicalInputStats.ino) {
                    throw new ComparePdfConfigurationError(
                        `${inputLabel} must resolve within allowedInputRoot: ${allowedInputRoot.displayPath}`,
                    );
                }
            }

            return readFileSync(inputFileDescriptor);
        } catch (cause) {
            throw wrapPdfInputReadError(cause, inputFile);
        } finally {
            if (inputFileDescriptor !== undefined) {
                closeSync(inputFileDescriptor);
            }
        }
    }
    throw new ComparePdfInputError('Unknown input file type.');
}

export function validateAllowedInputRoot(
    allowedInputRoot: ComparePdfOptions['allowedInputRoot'],
): AllowedInputRoot | undefined {
    if (allowedInputRoot === undefined) {
        return undefined;
    }

    if (typeof allowedInputRoot !== 'string' || allowedInputRoot.trim().length === 0) {
        throw new ComparePdfConfigurationError('allowedInputRoot must be a non-empty string.');
    }

    const resolvedRootPath = resolve(allowedInputRoot);
    if (!existsSync(resolvedRootPath)) {
        throw new ComparePdfConfigurationError(`allowedInputRoot does not exist: ${allowedInputRoot}`);
    }
    const canonicalRootPath = realpathSync(resolvedRootPath);

    if (!statSync(canonicalRootPath).isDirectory()) {
        throw new ComparePdfConfigurationError(`allowedInputRoot must point to an existing directory: ${allowedInputRoot}`);
    }

    return {
        displayPath: allowedInputRoot,
        resolvedPath: resolvedRootPath,
        canonicalPath: canonicalRootPath,
    };
}

function wrapPdfInputReadError(cause: unknown, inputFile: string): ComparePdfInputError {
    if (cause instanceof ComparePdfInputError) {
        throw cause;
    }
    if (cause instanceof ComparePdfConfigurationError) {
        throw cause;
    }
    if (isMissingPdfInputError(cause)) {
        return new ComparePdfInputError(`PDF file not found: ${inputFile}`, { cause });
    }

    return new ComparePdfInputError(`Failed to read PDF file: ${inputFile}`, { cause });
}

function isMissingPdfInputError(cause: unknown): cause is NodeJS.ErrnoException {
    return cause instanceof Error && 'code' in cause && (cause.code === 'ENOENT' || cause.code === 'ENOTDIR');
}

function assertStringPathWithinAllowedInputRoot(
    inputPath: string,
    inputLabel: 'actualPdf' | 'expectedPdf',
    allowedInputRoot?: AllowedInputRoot,
): void {
    if (!allowedInputRoot) {
        return;
    }

    if (
        !isPathWithinRoot(inputPath, allowedInputRoot.resolvedPath) &&
        !isPathWithinRoot(inputPath, allowedInputRoot.canonicalPath)
    ) {
        throw new ComparePdfConfigurationError(
            `${inputLabel} must resolve within allowedInputRoot: ${allowedInputRoot.displayPath}`,
        );
    }
}

function isPathWithinRoot(pathToCheck: string, rootPath: string): boolean {
    const relativePath = relative(rootPath, pathToCheck);
    return relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath));
}
