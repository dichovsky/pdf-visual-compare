import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
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

const report = execFileSync('npm', ['sbom', '--sbom-format=spdx', '--package-lock-only'], {
    encoding: 'utf8',
});
const { documentDescribes, packages, relationships } = JSON.parse(report);
const packagesById = new Map(packages.map((pkg) => [pkg.SPDXID, pkg]));
const dependenciesByParent = Map.groupBy(relationships, (edge) => edge.relatedSpdxElement);
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const runtimeEdges = new Set(['DEPENDENCY_OF', 'OPTIONAL_DEPENDENCY_OF', 'PREREQUISITE_FOR']);

// npm's --omit=dev drops packages reached through both development and runtime paths.
// Start at the root and follow each production relationship, including native optional packages.
const productionIds = new Set(documentDescribes);
for (const id of productionIds) {
    const parent = lock.packages[packagesById.get(id).packageFileName];
    for (const { relationshipType, spdxElementId } of dependenciesByParent.get(id) ?? []) {
        if (!runtimeEdges.has(relationshipType)) continue;
        const name = packagesById.get(spdxElementId).name;
        // npm represents installed optional peers as DEPENDENCY_OF. A test runner can supply
        // one during development even though a normal consumer install does not require it.
        if (
            relationshipType === 'DEPENDENCY_OF' &&
            parent.peerDependenciesMeta?.[name]?.optional &&
            !parent.dependencies?.[name]
        ) {
            continue;
        }
        productionIds.add(spdxElementId);
    }
}

for (const id of productionIds) {
    const { name, versionInfo, licenseDeclared } = packagesById.get(id);
    if (!isPermitted(licenseDeclared)) {
        console.error(`${name}@${versionInfo} declares an unapproved license: ${licenseDeclared}`);
        process.exitCode = 1;
    }
}
if (!process.exitCode) {
    console.log(`Verified licenses for ${productionIds.size} production packages, including the root package.`);
}
