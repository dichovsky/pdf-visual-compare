import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

type NormalizePathModule = {
    normalizePath: (inputPath: string) => string;
};

const localRequire = createRequire(__filename);
let didPatchPdfToPngWindowsNormalizePath = false;

export function buildPdfJsFactoryUrl(normalizedPath: string, platform: NodeJS.Platform = process.platform): string {
    if (platform !== 'win32') {
        return normalizedPath;
    }

    const forwardSlashPath = normalizedPath.replaceAll('\\', '/');
    return forwardSlashPath.endsWith('/') ? forwardSlashPath : `${forwardSlashPath}/`;
}

export function patchPdfToPngNormalizePathForWindows(
    normalizePathModule: NormalizePathModule,
    platform: NodeJS.Platform = process.platform,
): boolean {
    if (platform !== 'win32') {
        return false;
    }

    const originalNormalizePath = normalizePathModule.normalizePath;
    normalizePathModule.normalizePath = (inputPath: string): string =>
        buildPdfJsFactoryUrl(originalNormalizePath(inputPath), platform);

    return true;
}

export function ensurePdfToPngWindowsCompat(platform: NodeJS.Platform = process.platform): void {
    if (platform !== 'win32' || didPatchPdfToPngWindowsNormalizePath) {
        return;
    }

    const packageEntryPath = localRequire.resolve('pdf-to-png-converter');
    const normalizePathModulePath = resolve(dirname(packageEntryPath), 'normalizePath.js');
    const normalizePathModule = localRequire(normalizePathModulePath) as Partial<NormalizePathModule>;

    if (typeof normalizePathModule.normalizePath !== 'function') {
        throw new Error('Unsupported pdf-to-png-converter internals: normalizePath export not found.');
    }

    patchPdfToPngNormalizePathForWindows(normalizePathModule as NormalizePathModule, platform);
    didPatchPdfToPngWindowsNormalizePath = true;
}
