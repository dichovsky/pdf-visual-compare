import { basename, isAbsolute, relative, resolve } from 'node:path';
import type { ComparePngOptions } from 'png-visual-compare';
import { ComparePdfConfigurationError } from '../../errors/ComparePdfConfigurationError.js';
import type { PageExclusion } from '../../types/PageExclusion.js';

export function toComparePngOptions(
    pageExclusion: PageExclusion | undefined,
    diffsOutputFolder: string,
    pageName: string,
    writeDiffs = true,
): ComparePngOptions {
    const diffFilePath = writeDiffs
        ? resolveDiffFilePath(pageExclusion?.diffFilePath, diffsOutputFolder, pageName)
        : undefined;

    return {
        excludedAreas: pageExclusion?.excludedAreas?.map((area) => ({ ...area })),
        excludedAreaColor: pageExclusion?.excludedAreaColor && { ...pageExclusion.excludedAreaColor },
        diffFilePath,
        throwErrorOnInvalidInputData: true,
    };
}

function resolveDiffFilePath(
    configuredDiffFilePath: PageExclusion['diffFilePath'],
    diffsOutputFolder: string,
    pageName: string,
): string {
    if (configuredDiffFilePath !== undefined) {
        if (typeof configuredDiffFilePath !== 'string' || configuredDiffFilePath.trim() === '') {
            throw new ComparePdfConfigurationError('diffFilePath must be a non-empty string.');
        }

        return assertPathWithinDiffsOutputFolder(configuredDiffFilePath, diffsOutputFolder);
    }

    assertSafePageName(pageName, diffsOutputFolder);

    return assertPathWithinDiffsOutputFolder(resolve(diffsOutputFolder, `diff_${pageName}`), diffsOutputFolder);
}

function assertSafePageName(pageName: string, diffsOutputFolder: string): void {
    if (pageName.trim() !== '' && pageName === basename(pageName)) {
        return;
    }

    throw new ComparePdfConfigurationError(
        `Diff output path must stay within diffsOutputFolder: ${resolve(diffsOutputFolder)}`,
    );
}

function assertPathWithinDiffsOutputFolder(candidatePath: string, diffsOutputFolder: string): string {
    const resolvedDiffsOutputFolder = resolve(diffsOutputFolder);
    const resolvedCandidatePath = resolve(candidatePath);
    const relativePath = relative(resolvedDiffsOutputFolder, resolvedCandidatePath);

    if (relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath))) {
        return resolvedCandidatePath;
    }

    throw new ComparePdfConfigurationError(
        `Diff output path must stay within diffsOutputFolder: ${resolvedDiffsOutputFolder}`,
    );
}
