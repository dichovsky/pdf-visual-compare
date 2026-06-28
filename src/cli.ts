#!/usr/bin/env node
import { comparePdfDetailed } from './comparePdf.js';
import { runCli } from './cli/runCli.js';
import { readPackageVersion } from './cli/version.js';

void runCli(process.argv.slice(2), {
    io: {
        stdout: (text) => process.stdout.write(text),
        stderr: (text) => process.stderr.write(text),
    },
    version: readPackageVersion(),
    compare: comparePdfDetailed,
})
    .then((exitCode) => {
        process.exitCode = exitCode;
    })
    .catch(() => {
        // runCli is designed never to reject, but guard against a late I/O throw so the
        // process still exits with the runtime-error code rather than an unhandled rejection.
        process.exitCode = 2;
    });
