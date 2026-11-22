import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';

test('reports disallowed and unknown production licenses across platforms', ({ onTestFinished }) => {
    const cwd = mkdtempSync(join(tmpdir(), 'pdf-license-'));
    onTestFinished(() => rmSync(cwd, { recursive: true, force: true }));
    const version = '1.0.0';
    const manifest = {
        name: 'license-fixture',
        version,
        license: 'MIT',
        dependencies: { permitted: version, restricted: version },
        optionalDependencies: { native: version },
        devDependencies: { tooling: version },
    };
    const packages = {
        '': manifest,
        'node_modules/permitted': { version, license: '(MIT OR X11) AND BSD-3-Clause' },
        'node_modules/restricted': { version, license: 'MIT AND GPL-3.0-only' },
        'node_modules/native': { version, os: ['win32'], optional: true },
        'node_modules/tooling': { version, license: 'GPL-3.0-only', dev: true },
    };
    writeFileSync(join(cwd, 'package.json'), JSON.stringify(manifest));
    writeFileSync(join(cwd, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages }));

    const script = join(import.meta.dirname, '..', 'check-licenses.mjs');
    const result = spawnSync(process.execPath, [script], { cwd, encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('restricted@1.0.0 declares an unapproved license: MIT AND GPL-3.0-only');
    expect(result.stderr).toContain('native@1.0.0 declares an unapproved license: NOASSERTION');
    expect(result.stderr).not.toContain('permitted@');
    expect(result.stderr).not.toContain('tooling@');
});
