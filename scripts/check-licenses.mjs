import { execFileSync } from 'node:child_process';
import parseLicense from 'spdx-expression-parse';

const allowedLicenses = new Set(['Apache-2.0', 'ISC', 'MIT', 'MPL-2.0', 'Unlicense']);

function permitsExpression(expression) {
    if (expression.conjunction === 'or') {
        return permitsExpression(expression.left) || permitsExpression(expression.right);
    }
    if (expression.conjunction === 'and') {
        return permitsExpression(expression.left) && permitsExpression(expression.right);
    }

    const { license, exception, plus } = expression;
    return !exception && !plus && (allowedLicenses.has(license) || license === '0BSD' || license.startsWith('BSD-'));
}

function isPermitted(license) {
    // Some packages declare the legacy family name instead of a specific BSD license.
    if (license === 'BSD') return true;
    try {
        return permitsExpression(parseLicense(license));
    } catch {
        return false;
    }
}

const report = execFileSync('npm', ['sbom', '--sbom-format=spdx', '--package-lock-only', '--omit=dev'], {
    encoding: 'utf8',
});
const { packages } = JSON.parse(report);
for (const { name, versionInfo, licenseDeclared } of packages) {
    if (!isPermitted(licenseDeclared)) {
        console.error(`${name}@${versionInfo} declares an unapproved license: ${licenseDeclared}`);
        process.exitCode = 1;
    }
}
if (!process.exitCode) {
    console.log(`Verified licenses for ${packages.length} production packages, including the root package.`);
}
