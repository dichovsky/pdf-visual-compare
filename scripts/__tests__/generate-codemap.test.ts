import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, test } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(HERE, '..', 'generate-codemap.ts');

interface SpawnResult {
  stdout: string;
  stderr: string;
  code: number;
}

interface SpawnError {
  status: number | null;
  stdout?: Buffer | string;
  stderr?: Buffer | string;
}

function runScript(cwd: string, args: string[] = []): SpawnResult {
  try {
    const stdout = execFileSync(
      'node',
      ['--disable-warning=ExperimentalWarning', '--experimental-strip-types', SCRIPT, ...args],
      { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    return { stdout, stderr: '', code: 0 };
  } catch (err: unknown) {
    const e = err as SpawnError;
    return {
      stdout: e.stdout ? e.stdout.toString() : '',
      stderr: e.stderr ? e.stderr.toString() : '',
      code: e.status ?? 1,
    };
  }
}

function makeFixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'codemap-test-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = join(root, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

const minimalPkg = JSON.stringify({ name: 'fixture', version: '0.0.1' }, null, 2);

interface ConfigOverrides {
  sourceDirs?: string[];
  entrypoints?: string[];
  exclude?: string[];
  maxSignatureLength?: number;
}

function minimalCfg(overrides: ConfigOverrides = {}): string {
  return JSON.stringify(
    {
      sourceDirs: overrides.sourceDirs ?? ['src'],
      entrypoints: overrides.entrypoints ?? ['src/index.ts'],
      exclude: overrides.exclude ?? ['__tests__/**'],
      maxSignatureLength: overrides.maxSignatureLength ?? 200,
    },
    null,
    2,
  );
}

interface PublicApiEntry {
  name: string;
  kind: string;
  file: string;
  line: number;
  signature: string;
  jsdoc?: string;
  typeOnly: boolean;
}

interface CodemapJson {
  schema: string;
  publicApi: PublicApiEntry[];
  files: { path: string; symbols: { name: string }[] }[];
  sourceHash: string;
}

function extractJson(markdown: string): CodemapJson {
  const m = markdown.match(/```json\n([\s\S]*?)\n```/);
  if (!m) throw new Error('No JSON block found in CODEMAP.md');
  return JSON.parse(m[1]) as CodemapJson;
}

describe('generate-codemap', () => {
  const fixtures: string[] = [];

  afterEach(() => {
    while (fixtures.length > 0) {
      const f = fixtures.pop();
      if (f) {
        try {
          rmSync(f, { recursive: true, force: true });
        } catch {
          // best effort cleanup
        }
      }
    }
  });

  function create(files: Record<string, string>): string {
    const root = makeFixture(files);
    fixtures.push(root);
    return root;
  }

  test('determinism: same input produces byte-identical output', () => {
    const root = create({
      'package.json': minimalPkg,
      'codemap.config.json': minimalCfg(),
      'src/index.ts': 'export const x: number = 1;\n',
    });
    const r1 = runScript(root);
    expect(r1.code).toBe(0);
    const first = readFileSync(join(root, 'CODEMAP.md'), 'utf8');
    const r2 = runScript(root);
    expect(r2.code).toBe(0);
    const second = readFileSync(join(root, 'CODEMAP.md'), 'utf8');
    expect(second).toBe(first);
  });

  test('--check exits 0 when CODEMAP.md is fresh', () => {
    const root = create({
      'package.json': minimalPkg,
      'codemap.config.json': minimalCfg(),
      'src/index.ts': 'export const x: number = 1;\n',
    });
    expect(runScript(root).code).toBe(0);
    const r = runScript(root, ['--check']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('up to date');
  });

  test('--check exits 1 with diff when source diverges from committed CODEMAP.md', () => {
    const root = create({
      'package.json': minimalPkg,
      'codemap.config.json': minimalCfg(),
      'src/index.ts': 'export const x: number = 1;\n',
    });
    expect(runScript(root).code).toBe(0);
    writeFileSync(
      join(root, 'src/index.ts'),
      'export const x: number = 2;\nexport const y: string = "hi";\n',
    );
    const r = runScript(root, ['--check']);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain('stale');
    expect(r.stderr).toMatch(/[+-] /);
    // Unified-diff convention: `-` is on-disk (stale, must be removed); `+`
    // is the freshly generated content (must be added). The new symbol `y`
    // only exists in the fresh content, so it must appear on `+` lines and
    // never on `-` lines.
    const stderrLines = r.stderr.split('\n');
    const minusLines = stderrLines.filter((l) => l.startsWith('- '));
    const plusLines = stderrLines.filter((l) => l.startsWith('+ '));
    expect(plusLines.some((l) => l.includes('"y"'))).toBe(true);
    expect(minusLines.some((l) => l.includes('"y"'))).toBe(false);
  });

  test('exclude globs prevent matching files from appearing in the output', () => {
    const root = create({
      'package.json': minimalPkg,
      'codemap.config.json': minimalCfg({ exclude: ['__tests__/**', '**/*.spec.ts'] }),
      'src/index.ts': 'export const visible: number = 1;\n',
      'src/foo.spec.ts': 'export const ghost: number = 99;\n',
    });
    expect(runScript(root).code).toBe(0);
    const out = readFileSync(join(root, 'CODEMAP.md'), 'utf8');
    const json = extractJson(out);
    expect(json.files.map((f) => f.path)).not.toContain('src/foo.spec.ts');
    expect(out).not.toContain('ghost');
    expect(out).toContain('visible');
  });

  test('JSDoc: first paragraph survives, @param/@returns dropped, @deprecated preserved', () => {
    const root = create({
      'package.json': minimalPkg,
      'codemap.config.json': minimalCfg(),
      'src/index.ts': `/**
 * Does the thing.
 *
 * Second paragraph that should be dropped.
 * @param a not preserved
 * @returns also not preserved
 * @deprecated since 2.0.0
 */
export function thing(a: number): number { return a; }
`,
    });
    expect(runScript(root).code).toBe(0);
    const out = readFileSync(join(root, 'CODEMAP.md'), 'utf8');
    const json = extractJson(out);
    const sym = json.publicApi.find((p) => p.name === 'thing');
    expect(sym).toBeDefined();
    const jsdoc = sym!.jsdoc ?? '';
    expect(jsdoc).toContain('Does the thing.');
    expect(jsdoc).toContain('@deprecated');
    expect(jsdoc).toContain('2.0.0');
    expect(jsdoc).not.toContain('@param');
    expect(jsdoc).not.toContain('@returns');
    expect(jsdoc).not.toContain('Second paragraph');
  });

  test('transitive re-export: publicApi points to original declaration site, not the hop file', () => {
    const root = create({
      'package.json': minimalPkg,
      'codemap.config.json': minimalCfg(),
      'src/index.ts': "export { final } from './hop1.js';\n",
      'src/hop1.ts': "export { final } from './hop2.js';\n",
      'src/hop2.ts': 'export function final(): string {\n  return "done";\n}\n',
    });
    expect(runScript(root).code).toBe(0);
    const out = readFileSync(join(root, 'CODEMAP.md'), 'utf8');
    const json = extractJson(out);
    const sym = json.publicApi.find((p) => p.name === 'final');
    expect(sym).toBeDefined();
    expect(sym!.file).toBe('src/hop2.ts');
    expect(sym!.signature).toContain('function final');
  });
});
