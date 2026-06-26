import { expect, test } from 'vitest';
import { CliUsageError, parseCliArgs } from '../src/cli/parseArgs.js';

test(`returns a help request for -h/--help`, () => {
    expect(parseCliArgs(['--help'])).toEqual({ kind: 'help' });
    expect(parseCliArgs(['a.pdf', 'b.pdf', '-h'])).toEqual({ kind: 'help' });
});

test(`returns a version request for -v/--version`, () => {
    expect(parseCliArgs(['--version'])).toEqual({ kind: 'version' });
    expect(parseCliArgs(['-v'])).toEqual({ kind: 'version' });
});

test(`parses the minimal two-positional invocation with defaults`, () => {
    expect(parseCliArgs(['actual.pdf', 'expected.pdf'])).toEqual({
        kind: 'compare',
        actualPdf: 'actual.pdf',
        expectedPdf: 'expected.pdf',
        options: {},
        format: 'text',
        failOnDiff: false,
    });
});

test(`parses every flag in the space-separated form`, () => {
    expect(
        parseCliArgs([
            'actual.pdf',
            'expected.pdf',
            '-t',
            '5',
            '--threshold-percent',
            '1.5',
            '-p',
            '1-3,5',
            '-f',
            'junit',
            '-o',
            'diffs',
            '--fail-on-diff',
        ]),
    ).toEqual({
        kind: 'compare',
        actualPdf: 'actual.pdf',
        expectedPdf: 'expected.pdf',
        options: {
            compareThreshold: 5,
            compareThresholdPercent: 1.5,
            pages: '1-3,5',
            writeDiffs: true,
            diffsOutputFolder: 'diffs',
        },
        format: 'junit',
        failOnDiff: true,
    });
});

test(`parses flags in the --flag=value form`, () => {
    const invocation = parseCliArgs(['--threshold=5', '--pages=1,2', '--format=json', 'actual.pdf', 'expected.pdf']);

    expect(invocation).toEqual({
        kind: 'compare',
        actualPdf: 'actual.pdf',
        expectedPdf: 'expected.pdf',
        options: { compareThreshold: 5, pages: '1,2' },
        format: 'json',
        failOnDiff: false,
    });
});

test(`parses --out and --threshold-percent in the =value form`, () => {
    expect(parseCliArgs(['--out=./diffs', '--threshold-percent=1.5', 'a.pdf', 'b.pdf'])).toMatchObject({
        kind: 'compare',
        options: { writeDiffs: true, diffsOutputFolder: './diffs', compareThresholdPercent: 1.5 },
    });
});

test(`treats arguments after -- as positional paths`, () => {
    expect(parseCliArgs(['--', '-weird.pdf', 'expected.pdf'])).toEqual({
        kind: 'compare',
        actualPdf: '-weird.pdf',
        expectedPdf: 'expected.pdf',
        options: {},
        format: 'text',
        failOnDiff: false,
    });
});

test(`rejects a flag-shaped value supplied in the space-separated form`, () => {
    expect(() => parseCliArgs(['a.pdf', 'b.pdf', '--out', '--pages', '1-3'])).toThrow('Missing value for "--out".');
});

test(`accepts every supported --format value`, () => {
    for (const format of ['text', 'json', 'junit'] as const) {
        const invocation = parseCliArgs(['a.pdf', 'b.pdf', '--format', format]);
        expect(invocation).toMatchObject({ kind: 'compare', format });
    }
});

test(`rejects a missing flag value`, () => {
    expect(() => parseCliArgs(['a.pdf', 'b.pdf', '--threshold'])).toThrow(CliUsageError);
    expect(() => parseCliArgs(['a.pdf', 'b.pdf', '--threshold'])).toThrow('Missing value for "--threshold".');
});

test(`rejects unknown options`, () => {
    expect(() => parseCliArgs(['a.pdf', 'b.pdf', '--nope'])).toThrow('Unknown option "--nope".');
});

test(`rejects an unsupported format`, () => {
    expect(() => parseCliArgs(['a.pdf', 'b.pdf', '-f', 'xml'])).toThrow('Unsupported --format "xml"');
});

test(`rejects non-numeric and empty numeric values`, () => {
    expect(() => parseCliArgs(['a.pdf', 'b.pdf', '-t', 'abc'])).toThrow('expects a number');
    expect(() => parseCliArgs(['a.pdf', 'b.pdf', '--threshold='])).toThrow('expects a number');
});

test(`rejects anything other than exactly two positional PDF paths`, () => {
    expect(() => parseCliArgs(['only.pdf'])).toThrow('received 1');
    expect(() => parseCliArgs(['a.pdf', 'b.pdf', 'c.pdf'])).toThrow('received 3');
});
