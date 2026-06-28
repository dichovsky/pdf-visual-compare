import type { ComparePdfOptions } from '../types/ComparePdfOptions.js';

/** Output format for the CLI report. */
export type CliOutputFormat = 'text' | 'json' | 'junit';

/** Parsed CLI invocation: a request for help/version, or a comparison to run. */
export type CliInvocation =
    | { kind: 'help' }
    | { kind: 'version' }
    | {
          kind: 'compare';
          actualPdf: string;
          expectedPdf: string;
          options: ComparePdfOptions;
          format: CliOutputFormat;
          failOnDiff: boolean;
      };

/** Raised for malformed CLI usage (unknown flag, missing value, wrong argument count). */
export class CliUsageError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CliUsageError';
    }
}

type FlagTarget = 'threshold' | 'thresholdPercent' | 'pages' | 'format' | 'out';

/**
 * Parses `pdf-visual-compare` CLI arguments (everything after the binary name).
 *
 * Supports `--flag value` and `--flag=value`, and a `--` separator after which every token is
 * treated as a positional path (so paths starting with `-` are still usable). Returns a
 * help/version request when `-h`/`--help` or `-v`/`--version` appears. Throws {@link CliUsageError}
 * for unknown flags, missing values, an unsupported `--format`, or anything other than exactly two
 * positional PDF paths.
 *
 * Numeric and page-selection VALUES are passed through to the library, which validates ranges and
 * surfaces precise errors; this parser only enforces argument STRUCTURE and `--format`.
 */
export function parseCliArgs(argv: readonly string[]): CliInvocation {
    const positionals: string[] = [];
    let threshold: number | undefined;
    let thresholdPercent: number | undefined;
    let pages: string | undefined;
    let format: CliOutputFormat = 'text';
    let out: string | undefined;
    let failOnDiff = false;

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];

        if (arg === '--') {
            positionals.push(...argv.slice(index + 1));
            break;
        }
        if (arg === '--help' || arg === '-h') {
            return { kind: 'help' };
        }
        if (arg === '--version' || arg === '-v') {
            return { kind: 'version' };
        }
        if (arg === '--fail-on-diff') {
            failOnDiff = true;
            continue;
        }
        if (!arg.startsWith('-')) {
            positionals.push(arg);
            continue;
        }

        const equalsIndex = arg.indexOf('=');
        const flag = equalsIndex === -1 ? arg : arg.slice(0, equalsIndex);
        const target = flagTarget(flag);
        if (target === null) {
            throw new CliUsageError(`Unknown option "${flag}".`);
        }

        let value: string;
        if (equalsIndex === -1) {
            const next = argv[index + 1];
            if (next === undefined || next.startsWith('-')) {
                throw new CliUsageError(`Missing value for "${flag}".`);
            }
            value = next;
            index += 1;
        } else {
            value = arg.slice(equalsIndex + 1);
        }

        switch (target) {
            case 'threshold':
                threshold = parseNumberValue(flag, value);
                break;
            case 'thresholdPercent':
                thresholdPercent = parseNumberValue(flag, value);
                break;
            case 'pages':
                pages = value;
                break;
            case 'format':
                format = parseFormatValue(value);
                break;
            case 'out':
                out = value;
                break;
        }
    }

    if (positionals.length !== 2) {
        throw new CliUsageError(
            `Expected exactly two PDF paths (actual and expected); received ${positionals.length}.`,
        );
    }

    const options: ComparePdfOptions = {
        ...(threshold !== undefined ? { compareThreshold: threshold } : {}),
        ...(thresholdPercent !== undefined ? { compareThresholdPercent: thresholdPercent } : {}),
        ...(pages !== undefined ? { pages } : {}),
        ...(out !== undefined ? { writeDiffs: true, diffsOutputFolder: out } : {}),
    };

    return {
        kind: 'compare',
        actualPdf: positionals[0],
        expectedPdf: positionals[1],
        options,
        format,
        failOnDiff,
    };
}

/** Maps a value-taking flag to the option it sets, or `null` for an unknown flag. */
function flagTarget(flag: string): FlagTarget | null {
    switch (flag) {
        case '-t':
        case '--threshold':
            return 'threshold';
        case '--threshold-percent':
            return 'thresholdPercent';
        case '-p':
        case '--pages':
            return 'pages';
        case '-f':
        case '--format':
            return 'format';
        case '-o':
        case '--out':
            return 'out';
        default:
            return null;
    }
}

function parseNumberValue(flag: string, value: string): number {
    const parsed = Number(value);
    if (value.trim() === '' || !Number.isFinite(parsed)) {
        throw new CliUsageError(`Option "${flag}" expects a number; received "${value}".`);
    }
    return parsed;
}

function parseFormatValue(value: string): CliOutputFormat {
    if (value === 'text' || value === 'json' || value === 'junit') {
        return value;
    }
    throw new CliUsageError(`Unsupported --format "${value}"; expected text, json, or junit.`);
}
