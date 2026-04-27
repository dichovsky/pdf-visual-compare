import { resolve } from 'node:path';

/** Resolves the default folder path for diff PNG images produced during PDF comparison. */
export function getDefaultDiffsFolder(): string {
    return resolve('./comparePdfOutput');
}
