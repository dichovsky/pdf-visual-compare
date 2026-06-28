import type { ComparePdfDetailedResult } from '../types/ComparePdfDetailedResult.js';
import type { ComparePdfOptions } from '../types/ComparePdfOptions.js';
import { helpText, USAGE } from './help.js';
import { CliInvocation, parseCliArgs } from './parseArgs.js';
import { formatReport } from './report.js';

/** Sink for CLI output, injected so the orchestration is testable without touching the process. */
export type CliIo = {
    stdout: (text: string) => void;
    stderr: (text: string) => void;
};

/** Dependencies injected into {@link runCli} (process I/O, version, and the comparison function). */
export type CliDeps = {
    io: CliIo;
    version: string;
    compare: (
        actualPdf: string,
        expectedPdf: string,
        options: ComparePdfOptions,
    ) => Promise<ComparePdfDetailedResult>;
};

/**
 * Runs the CLI and resolves to a process exit code:
 * - `0` success (PDFs equal, or differences found without `--fail-on-diff`),
 * - `1` differences found with `--fail-on-diff`,
 * - `2` usage error (bad arguments) or a runtime/comparison error.
 *
 * All output goes through the injected {@link CliIo}; no `process` access happens here.
 */
export async function runCli(argv: readonly string[], deps: CliDeps): Promise<number> {
    let invocation: CliInvocation;
    try {
        invocation = parseCliArgs(argv);
    } catch (error) {
        deps.io.stderr(`${toErrorMessage(error)}\n${USAGE}\n`);
        return 2;
    }

    if (invocation.kind === 'help') {
        deps.io.stdout(`${helpText(deps.version)}\n`);
        return 0;
    }
    if (invocation.kind === 'version') {
        deps.io.stdout(`${deps.version}\n`);
        return 0;
    }

    try {
        const result = await deps.compare(invocation.actualPdf, invocation.expectedPdf, invocation.options);
        deps.io.stdout(`${formatReport(result, invocation.format)}\n`);
        return !result.isEqual && invocation.failOnDiff ? 1 : 0;
    } catch (error) {
        deps.io.stderr(`${toErrorMessage(error)}\n`);
        return 2;
    }
}

function toErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
