import { beforeEach, expect, test, vi } from 'vitest';

const { closeSyncMock, fstatSyncMock, openSyncMock, readFileSyncMock, realpathSyncMock, statSyncMock } = vi.hoisted(
    () => ({
        closeSyncMock: vi.fn(),
        fstatSyncMock: vi.fn(),
        openSyncMock: vi.fn(),
        readFileSyncMock: vi.fn(),
        realpathSyncMock: vi.fn(),
        statSyncMock: vi.fn(),
    }),
);

vi.mock('node:fs', async () => {
    const actual = await vi.importActual<typeof import('node:fs')>('node:fs');

    return {
        ...actual,
        closeSync: closeSyncMock,
        fstatSync: fstatSyncMock,
        openSync: openSyncMock,
        readFileSync: readFileSyncMock,
        realpathSync: realpathSyncMock,
        statSync: statSyncMock,
    };
});

import { constants } from 'node:fs';
import { ComparePdfConfigurationError } from '../src/errors/ComparePdfConfigurationError.js';
import { ComparePdfInputError } from '../src/errors/ComparePdfInputError.js';
import { normalizePdfInput } from '../src/internal/normalizePdfInput.js';

const ALLOWED_INPUT_ROOT = {
    displayPath: '/safe-root',
    resolvedPath: '/safe-root',
    canonicalPath: '/safe-root',
};

beforeEach(() => {
    closeSyncMock.mockReset();
    fstatSyncMock.mockReset();
    openSyncMock.mockReset();
    readFileSyncMock.mockReset();
    realpathSyncMock.mockReset();
    statSyncMock.mockReset();
});

test('should pass O_NOFOLLOW to openSync when allowedInputRoot is configured', () => {
    realpathSyncMock.mockReturnValue('/safe-root/file.pdf');
    statSyncMock.mockReturnValue({ isFile: () => true, dev: 1, ino: 1 });
    openSyncMock.mockReturnValue(1);
    fstatSyncMock.mockReturnValue({ dev: 1, ino: 1 });
    readFileSyncMock.mockReturnValue(Buffer.from('pdf-bytes'));

    normalizePdfInput('/safe-root/file.pdf', 'actualPdf', ALLOWED_INPUT_ROOT);

    expect(openSyncMock).toHaveBeenCalledWith('/safe-root/file.pdf', constants.O_RDONLY | constants.O_NOFOLLOW);
    expect(closeSyncMock).toHaveBeenCalledWith(1);
});

test('should NOT pass O_NOFOLLOW to openSync when allowedInputRoot is not configured', () => {
    realpathSyncMock.mockReturnValue('/anywhere/file.pdf');
    statSyncMock.mockReturnValue({ isFile: () => true, dev: 1, ino: 1 });
    openSyncMock.mockReturnValue(1);
    readFileSyncMock.mockReturnValue(Buffer.from('pdf-bytes'));

    normalizePdfInput('/anywhere/file.pdf', 'actualPdf', undefined);

    expect(openSyncMock).toHaveBeenCalledWith('/anywhere/file.pdf', constants.O_RDONLY);
});

test('should map ELOOP from O_NOFOLLOW to a sandbox-escape configuration error', () => {
    realpathSyncMock.mockReturnValue('/safe-root/file.pdf');
    statSyncMock.mockReturnValue({ isFile: () => true, dev: 1, ino: 1 });
    const eloop = Object.assign(new Error('ELOOP'), { code: 'ELOOP' });
    openSyncMock.mockImplementation(() => {
        throw eloop;
    });

    expect(() => normalizePdfInput('/safe-root/file.pdf', 'actualPdf', ALLOWED_INPUT_ROOT)).toThrow(
        ComparePdfConfigurationError,
    );
    expect(() => normalizePdfInput('/safe-root/file.pdf', 'actualPdf', ALLOWED_INPUT_ROOT)).toThrow(
        'actualPdf must resolve within allowedInputRoot: /safe-root',
    );
    expect(readFileSyncMock).not.toHaveBeenCalled();
});

test('should map EMLINK from O_NOFOLLOW to a sandbox-escape configuration error', () => {
    realpathSyncMock.mockReturnValue('/safe-root/file.pdf');
    statSyncMock.mockReturnValue({ isFile: () => true, dev: 1, ino: 1 });
    const emlink = Object.assign(new Error('EMLINK'), { code: 'EMLINK' });
    openSyncMock.mockImplementation(() => {
        throw emlink;
    });

    expect(() => normalizePdfInput('/safe-root/file.pdf', 'expectedPdf', ALLOWED_INPUT_ROOT)).toThrow(
        ComparePdfConfigurationError,
    );
    expect(() => normalizePdfInput('/safe-root/file.pdf', 'expectedPdf', ALLOWED_INPUT_ROOT)).toThrow(
        'expectedPdf must resolve within allowedInputRoot: /safe-root',
    );
});

test('should still surface non-symlink open errors as input errors', () => {
    realpathSyncMock.mockReturnValue('/safe-root/file.pdf');
    statSyncMock.mockReturnValue({ isFile: () => true, dev: 1, ino: 1 });
    const eacces = Object.assign(new Error('EACCES'), { code: 'EACCES' });
    openSyncMock.mockImplementation(() => {
        throw eacces;
    });

    expect(() => normalizePdfInput('/safe-root/file.pdf', 'actualPdf', ALLOWED_INPUT_ROOT)).toThrow(
        ComparePdfInputError,
    );
    expect(() => normalizePdfInput('/safe-root/file.pdf', 'actualPdf', ALLOWED_INPUT_ROOT)).toThrow(
        'Failed to read PDF file: /safe-root/file.pdf',
    );
});
