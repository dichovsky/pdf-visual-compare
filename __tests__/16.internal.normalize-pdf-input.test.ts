import { beforeEach, expect, test, vi } from 'vitest';

const {
    closeSyncMock,
    fstatSyncMock,
    openSyncMock,
    readFileSyncMock,
    realpathSyncMock,
    statSyncMock,
} = vi.hoisted(() => ({
    closeSyncMock: vi.fn(),
    fstatSyncMock: vi.fn(),
    openSyncMock: vi.fn(),
    readFileSyncMock: vi.fn(),
    realpathSyncMock: vi.fn(),
    statSyncMock: vi.fn(),
}));

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

import { ComparePdfConfigurationError } from '../src/errors/ComparePdfConfigurationError.js';
import { normalizePdfInput } from '../src/internal/normalizePdfInput.js';

beforeEach(() => {
    closeSyncMock.mockReset();
    fstatSyncMock.mockReset();
    openSyncMock.mockReset();
    readFileSyncMock.mockReset();
    realpathSyncMock.mockReset();
    statSyncMock.mockReset();
});

test(`should reject allowedInputRoot TOCTOU mismatches after opening the file`, () => {
    realpathSyncMock.mockReturnValue('/safe-root/file.pdf');
    statSyncMock.mockReturnValue({ isFile: () => true });
    openSyncMock.mockReturnValue(1);
    fstatSyncMock.mockReturnValue({ dev: 2, ino: 2 });

    expect(() =>
        normalizePdfInput('/safe-root/file.pdf', 'actualPdf', {
            displayPath: '/safe-root',
            resolvedPath: '/safe-root',
            canonicalPath: '/safe-root',
        }),
    ).toThrow(ComparePdfConfigurationError);

    expect(closeSyncMock).toHaveBeenCalledWith(1);
    expect(readFileSyncMock).not.toHaveBeenCalled();
});
