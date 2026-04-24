import { expect, test, vi } from 'vitest';
import {
    buildPdfJsFactoryUrl,
    patchPdfToPngNormalizePathForWindows,
} from '../src/pdfToPngWindowsCompat.js';

test(`should keep POSIX factory paths unchanged`, () => {
    expect(buildPdfJsFactoryUrl('/tmp/pdfjs-dist/cmaps/', 'linux')).toBe('/tmp/pdfjs-dist/cmaps/');
});

test(`should convert Windows factory paths to forward-slash URLs`, () => {
    expect(buildPdfJsFactoryUrl('D:\\a\\pdf-visual-compare\\node_modules\\pdfjs-dist\\cmaps\\', 'win32')).toBe(
        'D:/a/pdf-visual-compare/node_modules/pdfjs-dist/cmaps/',
    );
});

test(`should patch dependency normalizePath only on Windows`, () => {
    const originalNormalizePath = vi
        .fn()
        .mockReturnValue('D:\\a\\pdf-visual-compare\\node_modules\\pdfjs-dist\\cmaps\\');
    const normalizePathModule = {
        normalizePath: originalNormalizePath,
    };

    expect(patchPdfToPngNormalizePathForWindows(normalizePathModule, 'win32')).toBeTruthy();
    expect(normalizePathModule.normalizePath('./node_modules/pdfjs-dist/cmaps/')).toBe(
        'D:/a/pdf-visual-compare/node_modules/pdfjs-dist/cmaps/',
    );
    expect(originalNormalizePath).toHaveBeenCalledWith('./node_modules/pdfjs-dist/cmaps/');
});

test(`should not patch dependency normalizePath on non-Windows platforms`, () => {
    const originalNormalizePath = vi.fn().mockReturnValue('/tmp/pdfjs-dist/cmaps/');
    const normalizePathModule = {
        normalizePath: originalNormalizePath,
    };

    expect(patchPdfToPngNormalizePathForWindows(normalizePathModule, 'linux')).toBeFalsy();
    expect(normalizePathModule.normalizePath('./node_modules/pdfjs-dist/cmaps/')).toBe('/tmp/pdfjs-dist/cmaps/');
    expect(originalNormalizePath).toHaveBeenCalledWith('./node_modules/pdfjs-dist/cmaps/');
});

test(`should patch pdf-to-png-converter internals once on Windows`, async () => {
    vi.resetModules();

    const normalizePathModule = {
        normalizePath: vi.fn().mockReturnValue('D:\\a\\pdf-visual-compare\\node_modules\\pdfjs-dist\\cmaps\\'),
    };
    const localRequire = Object.assign(
        vi.fn((modulePath: string) => {
            if (modulePath === '/virtual/pdf-to-png-converter/out/normalizePath.js') {
                return normalizePathModule;
            }

            throw new Error(`Unexpected module path: ${modulePath}`);
        }),
        {
            resolve: vi.fn().mockReturnValue('/virtual/pdf-to-png-converter/out/index.js'),
        },
    );

    vi.doMock('node:module', () => ({
        createRequire: vi.fn().mockReturnValue(localRequire),
    }));

    const { ensurePdfToPngWindowsCompat } = await import('../src/pdfToPngWindowsCompat.js');

    ensurePdfToPngWindowsCompat('win32');
    ensurePdfToPngWindowsCompat('win32');

    expect(localRequire.resolve).toHaveBeenCalledTimes(1);
    expect(normalizePathModule.normalizePath('./node_modules/pdfjs-dist/cmaps/')).toBe(
        'D:/a/pdf-visual-compare/node_modules/pdfjs-dist/cmaps/',
    );

    vi.doUnmock('node:module');
    vi.resetModules();
});

test(`should patch pdf-to-png-converter before comparePdf renders on Windows`, async () => {
    vi.resetModules();
    const originalPlatform = process.platform;

    const normalizePathModule = {
        normalizePath: vi.fn().mockReturnValue('D:\\a\\pdf-visual-compare\\node_modules\\pdfjs-dist\\cmaps\\'),
    };
    const pdfToPngCalls: string[] = [];
    const localRequire = Object.assign(
        vi.fn((modulePath: string) => {
            if (modulePath === '/virtual/pdf-to-png-converter/out/normalizePath.js') {
                return normalizePathModule;
            }

            throw new Error(`Unexpected module path: ${modulePath}`);
        }),
        {
            resolve: vi.fn().mockReturnValue('/virtual/pdf-to-png-converter/out/index.js'),
        },
    );

    vi.doMock('node:module', () => ({
        createRequire: vi.fn().mockReturnValue(localRequire),
    }));
    vi.doMock('pdf-to-png-converter', () => ({
        pdfToPng: vi.fn(async () => {
            pdfToPngCalls.push(normalizePathModule.normalizePath('./node_modules/pdfjs-dist/cmaps/'));
            return [
                {
                    name: 'comparePdf_1.png',
                    content: Buffer.from('page'),
                },
            ];
        }),
    }));
    vi.doMock('png-visual-compare', () => ({
        comparePng: vi.fn().mockReturnValue(0),
    }));
    Object.defineProperty(process, 'platform', {
        value: 'win32',
    });

    const { comparePdf } = await import('../src/comparePdf.js');

    await expect(comparePdf(Buffer.from('actual'), Buffer.from('expected'))).resolves.toBeTruthy();
    expect(localRequire.resolve).toHaveBeenCalledTimes(1);
    expect(pdfToPngCalls).toEqual([
        'D:/a/pdf-visual-compare/node_modules/pdfjs-dist/cmaps/',
        'D:/a/pdf-visual-compare/node_modules/pdfjs-dist/cmaps/',
    ]);

    vi.doUnmock('png-visual-compare');
    vi.doUnmock('pdf-to-png-converter');
    vi.doUnmock('node:module');
    Object.defineProperty(process, 'platform', {
        value: originalPlatform,
    });
    vi.resetModules();
});

test(`should throw when pdf-to-png-converter internals change on Windows`, async () => {
    vi.resetModules();

    const localRequire = Object.assign(vi.fn().mockReturnValue({}), {
        resolve: vi.fn().mockReturnValue('/virtual/pdf-to-png-converter/out/index.js'),
    });

    vi.doMock('node:module', () => ({
        createRequire: vi.fn().mockReturnValue(localRequire),
    }));

    const { ensurePdfToPngWindowsCompat } = await import('../src/pdfToPngWindowsCompat.js');

    expect(() => ensurePdfToPngWindowsCompat('win32')).toThrow(
        'Unsupported pdf-to-png-converter internals: normalizePath export not found.',
    );

    vi.doUnmock('node:module');
    vi.resetModules();
});
