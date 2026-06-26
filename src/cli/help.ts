export const USAGE = 'Usage: pdf-visual-compare <actual.pdf> <expected.pdf> [options]';

/** Full `--help` text, including the resolved package version. */
export function helpText(version: string): string {
    return [
        `pdf-visual-compare ${version}`,
        'Visual regression comparison of two PDFs.',
        '',
        USAGE,
        '',
        'Options:',
        '  -t, --threshold <n>          Max differing pixels allowed per page (default 0)',
        '      --threshold-percent <n>  Max differing pixels as a percent (0-100); a page passes',
        '                               when within EITHER the pixel OR the percent threshold',
        '  -p, --pages <spec>           Compare only these pages, e.g. "1-3,5,7"',
        '  -f, --format <type>          Output format: text | json | junit (default text)',
        '  -o, --out <dir>              Write diff PNGs into <dir>',
        '      --fail-on-diff           Exit with code 1 when differences are found',
        '  -h, --help                   Show this help',
        '  -v, --version                Print the version',
        '      --                       Treat all following arguments as file paths',
        '',
        'Exit codes: 0 = success, 1 = differences found (with --fail-on-diff), 2 = usage/runtime error.',
    ].join('\n');
}
