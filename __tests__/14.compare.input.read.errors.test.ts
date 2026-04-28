import { beforeEach, expect, test, vi } from 'vitest';

const { openSyncMock } = vi.hoisted(() => ({
    openSyncMock: vi.fn(),
}));

vi.mock('node:fs', async () => {
    const actual = await vi.importActual<typeof import('node:fs')>('node:fs');

    return {
        ...actual,
        openSync: openSyncMock,
    };
});

import { comparePdf, ComparePdfInputError } from '../src/index.js';

beforeEach(() => {
    openSyncMock.mockReset();
});

test('should wrap string input open failures with ComparePdfInputError and cause', async () => {
    const inputReadCause = Object.assign(new Error('permission denied'), { code: 'EACCES' });
    openSyncMock.mockImplementationOnce(() => {
        throw inputReadCause;
    });

    const comparePromise = comparePdf('./test-data/pdf1.pdf', './test-data/pdf11.pdf');

    await expect(comparePromise).rejects.toThrow(ComparePdfInputError);
    await expect(comparePromise).rejects.toThrow('Failed to read PDF file: ./test-data/pdf1.pdf');
    await expect(comparePromise).rejects.toMatchObject({
        cause: inputReadCause,
        message: 'Failed to read PDF file: ./test-data/pdf1.pdf',
        name: 'ComparePdfInputError',
    });
});
