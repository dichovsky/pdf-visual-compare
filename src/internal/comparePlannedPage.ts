import { comparePng } from 'png-visual-compare';
import { ComparePdfComparisonError } from '../errors/ComparePdfComparisonError.js';
import type { ComparePdfPageResult } from '../types/ComparePdfPageResult.js';
import { toComparePngOptions } from './adapters/comparePngOptions.js';
import {
    assertCanonicalDiffOutputPath,
    assertDiffOutputPathUsesRealFilesystemEntries,
    discardDiffOutputLeaf,
    ensureDiffOutputDirectory,
    preCreateDiffOutputLeaf,
    verifyDiffOutputLeafAfterWrite,
} from './diffOutputGuards.js';
import type { NormalizedComparePdfOptions, PageComparisonPlanEntry } from './types.js';

export function comparePlannedPage(
    planEntry: PageComparisonPlanEntry,
    normalizedOptions: NormalizedComparePdfOptions,
): ComparePdfPageResult {
    const threshold = planEntry.pageExclusion?.matchingThreshold ?? normalizedOptions.compareThreshold;
    const actualPageName = planEntry.actualPage?.name ?? null;
    const expectedPageName = planEntry.expectedPage?.name ?? null;

    if (!planEntry.actualPage || !planEntry.expectedPage) {
        return {
            pageNumber: planEntry.pageNumber,
            status: planEntry.actualPage ? 'missing-expected' : 'missing-actual',
            isEqual: false,
            threshold,
            mismatchCount: null,
            diffFilePath: null,
            actualPageName,
            expectedPageName,
        };
    }

    const comparePngOptions = toComparePngOptions(
        planEntry.pageExclusion,
        normalizedOptions.diffsOutputFolder,
        planEntry.actualPage.name,
        normalizedOptions.writeDiffs,
    );
    const diffFilePath = comparePngOptions.diffFilePath ?? null;

    if (diffFilePath) {
        assertDiffOutputPathUsesRealFilesystemEntries(diffFilePath, normalizedOptions.diffsOutputFolder);
        ensureDiffOutputDirectory(diffFilePath, normalizedOptions.diffsOutputFolder);
        assertDiffOutputPathUsesRealFilesystemEntries(diffFilePath, normalizedOptions.diffsOutputFolder);
        assertCanonicalDiffOutputPath(diffFilePath, normalizedOptions.diffsOutputFolder);
        // Atomically claim the leaf path with a real regular file so the comparator's write
        // cannot follow a symlink planted after the guards above passed (CWE-367 / CWE-61).
        preCreateDiffOutputLeaf(diffFilePath, normalizedOptions.diffsOutputFolder);
    }

    let mismatchCount: number;
    try {
        mismatchCount = comparePng(planEntry.actualPage.content, planEntry.expectedPage.content, comparePngOptions);
    } catch (cause) {
        // Roll back the pre-created placeholder so an empty zero-byte leaf does not leak into
        // the diffs folder on the comparator's error path (would otherwise confuse CI artifacts).
        if (diffFilePath) {
            discardDiffOutputLeaf(diffFilePath);
        }
        throw new ComparePdfComparisonError(`Failed to compare rendered PDF page ${planEntry.pageNumber}.`, {
            cause,
        });
    }

    if (diffFilePath) {
        // Detect post-write tampering, surface missing/empty leaves when a diff was expected,
        // and remove the empty placeholder when no diff was written for matching pages.
        verifyDiffOutputLeafAfterWrite(diffFilePath, normalizedOptions.diffsOutputFolder, {
            expectDiffWritten: mismatchCount > threshold,
        });
    }

    const isEqual = mismatchCount <= threshold;

    return {
        pageNumber: planEntry.pageNumber,
        status: isEqual ? 'matched' : 'mismatched',
        isEqual,
        threshold,
        mismatchCount,
        diffFilePath,
        actualPageName,
        expectedPageName,
    };
}
