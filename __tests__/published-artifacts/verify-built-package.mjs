import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const rootDir = path.resolve(__dirname, '..', '..');
const artifactResultsDir = path.join(rootDir, 'test-results', 'published-artifacts', 'runtime');

function assertExportSurface(pkg) {
    assert.equal(typeof pkg.comparePdf, 'function');
    assert.equal(typeof pkg.comparePdfDetailed, 'function');
    assert.equal(typeof pkg.toJsonReport, 'function');
    assert.equal(typeof pkg.toJUnitReport, 'function');
    assert.equal(typeof pkg.ComparePdfError, 'function');
    assert.equal(typeof pkg.ComparePdfComparisonError, 'function');
    assert.equal(typeof pkg.ComparePdfConfigurationError, 'function');
    assert.equal(typeof pkg.ComparePdfInputError, 'function');
    assert.equal(typeof pkg.ComparePdfRenderingError, 'function');
}

function assertPackedArtifactContents() {
    const packOutput = execFileSync('npm', ['pack', '--dry-run', '--json'], {
        cwd: rootDir,
        encoding: 'utf8',
    });
    const [packResult] = JSON.parse(packOutput);
    const packedPaths = new Set(packResult.files.map((file) => file.path));

    for (const requiredPath of [
        'package.json',
        'README.md',
        'LICENSE',
        'out/index.js',
        'out/index.d.ts',
        'out/comparePdf.js',
        'out/cli.js',
        'out/types/PdfInput.d.ts',
    ]) {
        assert.ok(packedPaths.has(requiredPath), `Expected npm pack output to include ${requiredPath}.`);
    }
}

function assertBinShim() {
    const manifest = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    assert.equal(manifest.bin?.['pdf-visual-compare'], './out/cli.js', 'Expected package.json bin to map to ./out/cli.js.');

    const cliSource = readFileSync(path.join(rootDir, 'out', 'cli.js'), 'utf8');
    assert.ok(cliSource.startsWith('#!/usr/bin/env node'), 'Expected built out/cli.js to start with a node shebang.');
}

async function main() {
    rmSync(artifactResultsDir, { force: true, recursive: true });

    const commonJsPackage = require('pdf-visual-compare');
    assertExportSurface(commonJsPackage);

    const esmPackage = await import('pdf-visual-compare');
    assertExportSurface(esmPackage);

    const actualPdf = readFileSync(path.join(rootDir, 'test-data', 'pdf1.pdf'));
    const expectedPdf = readFileSync(path.join(rootDir, 'test-data', 'pdf11.pdf'));

    const isEqual = await commonJsPackage.comparePdf(actualPdf, expectedPdf, {
        diffsOutputFolder: artifactResultsDir,
    });
    assert.equal(isEqual, true);

    const detailedResult = await esmPackage.comparePdfDetailed(actualPdf, expectedPdf, {
        diffsOutputFolder: artifactResultsDir,
    });
    assert.equal(detailedResult.isEqual, true);
    assert.equal(detailedResult.actualPageCount, 2);
    assert.equal(detailedResult.expectedPageCount, 2);

    assertPackedArtifactContents();
    assertBinShim();
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
