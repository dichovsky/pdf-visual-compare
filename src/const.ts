import { resolve } from 'node:path';

/** Default folder path for diff PNG images produced during PDF comparison. */
export const DEFAULT_DIFFS_FOLDER = resolve(`./comparePdfOutput`);
