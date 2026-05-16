import { beforeEach, expect, test, vi } from 'vitest';

const { closeSyncMock, lstatSyncMock, openSyncMock, unlinkSyncMock } = vi.hoisted(() => ({
    closeSyncMock: vi.fn(),
    lstatSyncMock: vi.fn(),
    openSyncMock: vi.fn(),
    unlinkSyncMock: vi.fn(),
}));

vi.mock('node:fs', async () => {
    const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
    return {
        ...actual,
        closeSync: closeSyncMock,
        lstatSync: lstatSyncMock,
        openSync: openSyncMock,
        unlinkSync: unlinkSyncMock,
    };
});

import { ComparePdfConfigurationError } from '../src/errors/ComparePdfConfigurationError.js';
import { preCreateDiffOutputLeaf, verifyDiffOutputLeafAfterWrite } from '../src/internal/diffOutputGuards.js';

beforeEach(() => {
    closeSyncMock.mockReset();
    lstatSyncMock.mockReset();
    openSyncMock.mockReset();
    unlinkSyncMock.mockReset();
});

test('should treat ENOENT from lstat as "no diff written" and return cleanly', () => {
    const enoent = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    lstatSyncMock.mockImplementation(() => {
        throw enoent;
    });

    expect(() => verifyDiffOutputLeafAfterWrite('/diffs/leaf.png', '/diffs')).not.toThrow();
    expect(unlinkSyncMock).not.toHaveBeenCalled();
});

test('should wrap non-ENOENT lstat errors as ComparePdfConfigurationError', () => {
    const eacces = Object.assign(new Error('EACCES'), { code: 'EACCES' });
    lstatSyncMock.mockImplementation(() => {
        throw eacces;
    });

    expect(() => verifyDiffOutputLeafAfterWrite('/diffs/leaf.png', '/diffs')).toThrow(ComparePdfConfigurationError);
});

test('should detect post-write symlink swap and unlink the tampered leaf', () => {
    lstatSyncMock.mockReturnValue({
        isFile: () => false,
        size: 0,
    });

    expect(() => verifyDiffOutputLeafAfterWrite('/diffs/leaf.png', '/diffs')).toThrow(ComparePdfConfigurationError);
    expect(() => verifyDiffOutputLeafAfterWrite('/diffs/leaf.png', '/diffs')).toThrow(
        'Diff output path was replaced during the write window',
    );
    expect(unlinkSyncMock).toHaveBeenCalledWith('/diffs/leaf.png');
});

test('should swallow unlink failures during best-effort cleanup', () => {
    lstatSyncMock.mockReturnValue({
        isFile: () => true,
        size: 0,
    });
    unlinkSyncMock.mockImplementation(() => {
        throw Object.assign(new Error('EACCES'), { code: 'EACCES' });
    });

    expect(() => verifyDiffOutputLeafAfterWrite('/diffs/leaf.png', '/diffs')).not.toThrow();
});

test('should surface ENOSPC on pre-create open as writable-directory configuration error', () => {
    // removeStaleDiffLeaf finds no stale file → returns cleanly.
    unlinkSyncMock.mockImplementation(() => {
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    });
    // openSync with O_CREAT|O_EXCL|O_NOFOLLOW fails with an unrelated I/O error.
    openSyncMock.mockImplementation(() => {
        throw Object.assign(new Error('ENOSPC'), { code: 'ENOSPC' });
    });

    expect(() => preCreateDiffOutputLeaf('/diffs/leaf.png', '/diffs')).toThrow(ComparePdfConfigurationError);
    expect(() => preCreateDiffOutputLeaf('/diffs/leaf.png', '/diffs')).toThrow(
        'diffsOutputFolder must point to a writable directory: /diffs',
    );
});

test.each([
    ['ELOOP', 'ELOOP'],
    ['EMLINK', 'EMLINK'],
    ['EEXIST', 'EEXIST'],
])('should surface %s on pre-create open as sandbox-escape configuration error', (_label, code) => {
    unlinkSyncMock.mockImplementation(() => {
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    });
    openSyncMock.mockImplementation(() => {
        throw Object.assign(new Error(code), { code });
    });

    expect(() => preCreateDiffOutputLeaf('/diffs/leaf.png', '/diffs')).toThrow(ComparePdfConfigurationError);
    expect(() => preCreateDiffOutputLeaf('/diffs/leaf.png', '/diffs')).toThrow(
        'Diff output path must stay within diffsOutputFolder: /diffs',
    );
});

test('should surface non-ENOENT unlink failures during stale-leaf cleanup', () => {
    // unlinkSync fails for a reason other than "file did not exist" — e.g. permission denied.
    unlinkSyncMock.mockImplementation(() => {
        throw Object.assign(new Error('EPERM'), { code: 'EPERM' });
    });

    expect(() => preCreateDiffOutputLeaf('/diffs/leaf.png', '/diffs')).toThrow(ComparePdfConfigurationError);
    expect(() => preCreateDiffOutputLeaf('/diffs/leaf.png', '/diffs')).toThrow(
        'diffsOutputFolder must point to a writable directory: /diffs',
    );
    expect(openSyncMock).not.toHaveBeenCalled();
});
