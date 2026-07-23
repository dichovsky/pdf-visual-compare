import { expect, test, vi } from 'vitest';
import { runCli, type CliDeps } from '../src/cli/runCli.js';
import { toTextReport } from '../src/cli/report.js';
import type { ComparePdfDetailedResult } from '../src/types/ComparePdfDetailedResult.js';

function sampleResult(isEqual: boolean): ComparePdfDetailedResult {
    return {
        isEqual,
        actualPageCount: 1,
        expectedPageCount: 1,
        compareThreshold: 0,
        compareThresholdPercent: null,
        writeDiffs: false,
        diffsOutputFolder: null,
        pages: [
            {
                pageNumber: 1,
                status: isEqual ? 'matched' : 'mismatched',
                isEqual,
                threshold: 0,
                thresholdPercent: null,
                mismatchCount: isEqual ? 0 : 200,
                mismatchPercent: isEqual ? 0 : 2,
                diffFilePath: null,
                actualPageName: 'a1.png',
                expectedPageName: 'e1.png',
            },
        ],
        summary: {
            totalPages: 1,
            matchedPages: isEqual ? 1 : 0,
            mismatchedPages: isEqual ? 0 : 1,
            missingPages: 0,
            maxMismatchPercent: isEqual ? 0 : 2,
            totalMismatchCount: isEqual ? 0 : 200,
        },
    };
}

function makeDeps(overrides: Partial<CliDeps> = {}): { deps: CliDeps; out: string[]; err: string[] } {
    const out: string[] = [];
    const err: string[] = [];
    const deps: CliDeps = {
        io: { stdout: (text) => out.push(text), stderr: (text) => err.push(text) },
        version: '9.9.9',
        compare: vi.fn(async () => sampleResult(true)),
        ...overrides,
    };
    return { deps, out, err };
}

test(`prints usage to stderr and exits 2 on an argument error`, async () => {
    const { deps, out, err } = makeDeps();

    expect(await runCli(['--nope'], deps)).toBe(2);
    expect(out).toHaveLength(0);
    expect(err.join('')).toContain('Unknown option "--nope".');
    expect(err.join('')).toContain('Usage: pdf-visual-compare');
});

test(`prints help and exits 0`, async () => {
    const { deps, out } = makeDeps();

    expect(await runCli(['--help'], deps)).toBe(0);
    expect(out.join('')).toContain('pdf-visual-compare 9.9.9');
    expect(out.join('')).toContain('--fail-on-diff');
});

test(`prints version and exits 0`, async () => {
    const { deps, out } = makeDeps();

    expect(await runCli(['--version'], deps)).toBe(0);
    expect(out.join('')).toBe('9.9.9\n');
});

test(`compares equal PDFs and exits 0 with a text report`, async () => {
    const { deps, out } = makeDeps();

    expect(await runCli(['a.pdf', 'b.pdf'], deps)).toBe(0);
    expect(out.join('')).toBe(`${toTextReport(sampleResult(true))}\n`);
});

test(`exits 0 on differences without --fail-on-diff, and 1 with it`, async () => {
    const { deps: deps1 } = makeDeps({ compare: vi.fn(async () => sampleResult(false)) });
    expect(await runCli(['a.pdf', 'b.pdf'], deps1)).toBe(0);

    const { deps: deps2 } = makeDeps({ compare: vi.fn(async () => sampleResult(false)) });
    expect(await runCli(['a.pdf', 'b.pdf', '--fail-on-diff'], deps2)).toBe(1);
});

test(`emits JSON and JUnit reports for the matching --format`, async () => {
    const { deps: jsonDeps, out: jsonOut } = makeDeps();
    expect(await runCli(['a.pdf', 'b.pdf', '-f', 'json'], jsonDeps)).toBe(0);
    expect(JSON.parse(jsonOut.join(''))).toEqual(sampleResult(true));

    const { deps: junitDeps, out: junitOut } = makeDeps();
    expect(await runCli(['a.pdf', 'b.pdf', '-f', 'junit'], junitDeps)).toBe(0);
    expect(junitOut.join('')).toContain('<testsuites name="pdf-visual-compare" tests="1" failures="0">');
});

test(`forwards parsed options to the comparison function`, async () => {
    const compare = vi.fn(async () => sampleResult(true));
    const { deps } = makeDeps({ compare });

    await runCli(['a.pdf', 'b.pdf', '-t', '10', '--threshold-percent', '0.5', '-p', '1-2', '-o', 'diffs'], deps);

    expect(compare).toHaveBeenCalledWith('a.pdf', 'b.pdf', {
        compareThreshold: 10,
        compareThresholdPercent: 0.5,
        pages: '1-2',
        writeDiffs: true,
        diffsOutputFolder: 'diffs',
    });
});

test(`reports a thrown Error message to stderr and exits 2`, async () => {
    const { deps, err } = makeDeps({
        compare: vi.fn(async () => {
            throw new Error('rendering failed');
        }),
    });

    expect(await runCli(['a.pdf', 'b.pdf'], deps)).toBe(2);
    expect(err.join('')).toContain('rendering failed');
});

test(`stringifies a non-Error rejection reason`, async () => {
    const { deps, err } = makeDeps({
        compare: vi.fn(async () => {
            throw 'plain string failure';
        }),
    });

    expect(await runCli(['a.pdf', 'b.pdf'], deps)).toBe(2);
    expect(err.join('')).toContain('plain string failure');
});
