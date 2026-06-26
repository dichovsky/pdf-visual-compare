import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Reads the package version from the published `package.json`. Both the TypeScript source
 * (`src/cli/`) and the compiled output (`out/cli/`) live two directories below the package
 * root, so the relative path resolves correctly in tests and at runtime.
 */
export function readPackageVersion(): string {
    const packageJsonPath = join(__dirname, '..', '..', 'package.json');
    const parsed = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version: string };
    return parsed.version;
}
