import { beforeEach, expect, test, vi } from 'vitest';

const { closeSyncMock, lstatSyncMock, openSyncMock, renameSyncMock, unlinkSyncMock } = vi.hoisted(() => ({
    closeSyncMock: vi.fn(),
    lstatSyncMock: vi.fn(),
    openSyncMock: vi.fn(),
    renameSyncMock: vi.fn(),
    unlinkSyncMock: vi.fn(),
}));

vi.mock('node:fs', async () => {
    const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
    return {
        ...actual,
        closeSync: closeSyncMock,
        lstatSync: lstatSyncMock,
        openSync: openSyncMock,
        renameSync: renameSyncMock,
        unlinkSync: unlinkSyncMock,
    };
});

import { ComparePdfConfigurationError } from '../src/errors/ComparePdfConfigurationError.js';
import { createSecureDiffOutputTempfile, publishDiffOutputTempfile } from '../src/internal/diffOutputGuards.js';

const DIFF_PATH = '/diffs/leaf.png';
const DIFF_FOLDER = '/diffs';

beforeEach(() => {
    closeSyncMock.mockReset();
    lstatSyncMock.mockReset();
    openSyncMock.mockReset();
    renameSyncMock.mockReset();
    unlinkSyncMock.mockReset();
});

// --- createSecureDiffOutputTempfile -----------------------------------------------------

test('should return a tempfile path inside the diff parent dir with a hidden random suffix', () => {
    openSyncMock.mockReturnValue(7);

    const tempfilePath = createSecureDiffOutputTempfile(DIFF_PATH, DIFF_FOLDER);

    expect(tempfilePath.startsWith(DIFF_FOLDER + '/')).toBe(true);
    expect(tempfilePath).toMatch(/\/\.leaf\.png\.[0-9a-f]{32}\.tmp$/);
    expect(openSyncMock).toHaveBeenCalledTimes(1);
    expect(closeSyncMock).toHaveBeenCalledWith(7);
});

test.each([
    ['ELOOP', 'ELOOP'],
    ['EMLINK', 'EMLINK'],
    ['EEXIST', 'EEXIST'],
])('should surface %s on tempfile create as sandbox-escape configuration error', (_label, code) => {
    openSyncMock.mockImplementation(() => {
        throw Object.assign(new Error(code), { code });
    });

    expect(() => createSecureDiffOutputTempfile(DIFF_PATH, DIFF_FOLDER)).toThrow(ComparePdfConfigurationError);
    expect(() => createSecureDiffOutputTempfile(DIFF_PATH, DIFF_FOLDER)).toThrow(
        'Diff output path must stay within diffsOutputFolder: /diffs',
    );
});

test('should surface ENOSPC on tempfile create as writable-directory configuration error', () => {
    openSyncMock.mockImplementation(() => {
        throw Object.assign(new Error('ENOSPC'), { code: 'ENOSPC' });
    });

    expect(() => createSecureDiffOutputTempfile(DIFF_PATH, DIFF_FOLDER)).toThrow(ComparePdfConfigurationError);
    expect(() => createSecureDiffOutputTempfile(DIFF_PATH, DIFF_FOLDER)).toThrow(
        'diffsOutputFolder must point to a writable directory: /diffs',
    );
});

// --- publishDiffOutputTempfile ----------------------------------------------------------

test('should atomically rename tempfile into diff path when comparator wrote bytes', () => {
    lstatSyncMock.mockReturnValue({
        isFile: () => true,
        size: 4096,
    });

    expect(() =>
        publishDiffOutputTempfile('/diffs/.leaf.png.deadbeef.tmp', DIFF_PATH, DIFF_FOLDER, {
            expectDiffWritten: true,
        }),
    ).not.toThrow();
    expect(renameSyncMock).toHaveBeenCalledWith('/diffs/.leaf.png.deadbeef.tmp', DIFF_PATH);
});

test('should treat ENOENT on tempfile as "no diff written" when none was expected', () => {
    const enoent = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    lstatSyncMock.mockImplementation(() => {
        throw enoent;
    });

    expect(() =>
        publishDiffOutputTempfile('/diffs/.leaf.png.deadbeef.tmp', DIFF_PATH, DIFF_FOLDER, {
            expectDiffWritten: false,
        }),
    ).not.toThrow();
    // Cleanup of any stale leaf at the final path happens via best-effort unlink.
    expect(unlinkSyncMock).toHaveBeenCalledWith(DIFF_PATH);
    expect(renameSyncMock).not.toHaveBeenCalled();
});

test('should surface ENOENT on tempfile as configuration error when a diff was expected', () => {
    const enoent = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    lstatSyncMock.mockImplementation(() => {
        throw enoent;
    });

    expect(() =>
        publishDiffOutputTempfile('/diffs/.leaf.png.deadbeef.tmp', DIFF_PATH, DIFF_FOLDER, {
            expectDiffWritten: true,
        }),
    ).toThrow(ComparePdfConfigurationError);
    expect(() =>
        publishDiffOutputTempfile('/diffs/.leaf.png.deadbeef.tmp', DIFF_PATH, DIFF_FOLDER, {
            expectDiffWritten: true,
        }),
    ).toThrow('Diff output was expected but is missing');
});

test('should wrap non-ENOENT lstat errors as ComparePdfConfigurationError', () => {
    lstatSyncMock.mockImplementation(() => {
        throw Object.assign(new Error('EACCES'), { code: 'EACCES' });
    });

    expect(() =>
        publishDiffOutputTempfile('/diffs/.leaf.png.deadbeef.tmp', DIFF_PATH, DIFF_FOLDER, {
            expectDiffWritten: false,
        }),
    ).toThrow(ComparePdfConfigurationError);
});

test('should detect non-regular-file tempfile (symlink swap) and unlink the tempfile', () => {
    lstatSyncMock.mockReturnValue({
        isFile: () => false,
        size: 0,
    });

    expect(() =>
        publishDiffOutputTempfile('/diffs/.leaf.png.deadbeef.tmp', DIFF_PATH, DIFF_FOLDER, {
            expectDiffWritten: false,
        }),
    ).toThrow(ComparePdfConfigurationError);
    expect(() =>
        publishDiffOutputTempfile('/diffs/.leaf.png.deadbeef.tmp', DIFF_PATH, DIFF_FOLDER, {
            expectDiffWritten: false,
        }),
    ).toThrow('Diff output tempfile was replaced during the write window');
    expect(unlinkSyncMock).toHaveBeenCalledWith('/diffs/.leaf.png.deadbeef.tmp');
    expect(renameSyncMock).not.toHaveBeenCalled();
});

test('should surface zero-byte tempfile as configuration error when a diff was expected', () => {
    lstatSyncMock.mockReturnValue({
        isFile: () => true,
        size: 0,
    });

    expect(() =>
        publishDiffOutputTempfile('/diffs/.leaf.png.deadbeef.tmp', DIFF_PATH, DIFF_FOLDER, {
            expectDiffWritten: true,
        }),
    ).toThrow(ComparePdfConfigurationError);
    expect(() =>
        publishDiffOutputTempfile('/diffs/.leaf.png.deadbeef.tmp', DIFF_PATH, DIFF_FOLDER, {
            expectDiffWritten: true,
        }),
    ).toThrow('Diff output was expected but is empty');
    expect(unlinkSyncMock).toHaveBeenCalledWith('/diffs/.leaf.png.deadbeef.tmp');
});

test('should silently discard zero-byte tempfile and stale leaf when no diff was expected', () => {
    lstatSyncMock.mockReturnValue({
        isFile: () => true,
        size: 0,
    });

    expect(() =>
        publishDiffOutputTempfile('/diffs/.leaf.png.deadbeef.tmp', DIFF_PATH, DIFF_FOLDER, {
            expectDiffWritten: false,
        }),
    ).not.toThrow();
    expect(unlinkSyncMock).toHaveBeenCalledWith('/diffs/.leaf.png.deadbeef.tmp');
    expect(unlinkSyncMock).toHaveBeenCalledWith(DIFF_PATH);
    expect(renameSyncMock).not.toHaveBeenCalled();
});

test('should surface renameSync failure as configuration error and clean up the tempfile', () => {
    lstatSyncMock.mockReturnValue({
        isFile: () => true,
        size: 1024,
    });
    renameSyncMock.mockImplementation(() => {
        throw Object.assign(new Error('EXDEV'), { code: 'EXDEV' });
    });

    expect(() =>
        publishDiffOutputTempfile('/diffs/.leaf.png.deadbeef.tmp', DIFF_PATH, DIFF_FOLDER, {
            expectDiffWritten: true,
        }),
    ).toThrow(ComparePdfConfigurationError);
    expect(() =>
        publishDiffOutputTempfile('/diffs/.leaf.png.deadbeef.tmp', DIFF_PATH, DIFF_FOLDER, {
            expectDiffWritten: true,
        }),
    ).toThrow('Failed to publish diff output');
    expect(unlinkSyncMock).toHaveBeenCalledWith('/diffs/.leaf.png.deadbeef.tmp');
});

test('should swallow unlink failures during best-effort cleanup', () => {
    lstatSyncMock.mockReturnValue({
        isFile: () => true,
        size: 0,
    });
    unlinkSyncMock.mockImplementation(() => {
        throw Object.assign(new Error('EACCES'), { code: 'EACCES' });
    });

    expect(() =>
        publishDiffOutputTempfile('/diffs/.leaf.png.deadbeef.tmp', DIFF_PATH, DIFF_FOLDER, {
            expectDiffWritten: false,
        }),
    ).not.toThrow();
});
