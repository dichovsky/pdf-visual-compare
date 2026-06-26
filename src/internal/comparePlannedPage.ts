import { comparePng } from 'png-visual-compare';
import { ComparePdfComparisonError } from '../errors/ComparePdfComparisonError.js';
import type { ComparePdfPageResult } from '../types/ComparePdfPageResult.js';
import { toComparePngOptions } from './adapters/comparePngOptions.js';
import { computeMismatchPercent } from './mismatchStats.js';
import {
    assertCanonicalDiffOutputPath,
    assertDiffOutputPathUsesRealFilesystemEntries,
    createSecureDiffOutputTempfile,
    discardDiffOutputLeaf,
    ensureDiffOutputDirectory,
    publishDiffOutputTempfile,
} from './diffOutputGuards.js';
import type { NormalizedComparePdfOptions, PageComparisonPlanEntry } from './types.js';

export function comparePlannedPage(
    planEntry: PageComparisonPlanEntry,
    normalizedOptions: NormalizedComparePdfOptions,
): ComparePdfPageResult {
    const threshold = planEntry.pageExclusion?.matchingThreshold ?? normalizedOptions.compareThreshold;
    const thresholdPercent =
        planEntry.pageExclusion?.matchingThresholdPercent ?? normalizedOptions.compareThresholdPercent ?? null;
    const actualPageName = planEntry.actualPage?.name ?? null;
    const expectedPageName = planEntry.expectedPage?.name ?? null;

    if (!planEntry.actualPage || !planEntry.expectedPage) {
        return {
            pageNumber: planEntry.pageNumber,
            status: planEntry.actualPage ? 'missing-expected' : 'missing-actual',
            isEqual: false,
            threshold,
            thresholdPercent,
            mismatchCount: null,
            mismatchPercent: null,
            diffFilePath: null,
            actualPageName,
            expectedPageName,
        };
    }

    const resolvedComparePngOptions = toComparePngOptions(
        planEntry.pageExclusion,
        normalizedOptions.diffsOutputFolder,
        planEntry.actualPage.name,
        normalizedOptions.writeDiffs,
    );
    const diffFilePath = resolvedComparePngOptions.diffFilePath ?? null;

    let stagedTempfilePath: string | undefined;
    let scopedComparePngOptions = resolvedComparePngOptions;
    if (diffFilePath) {
        assertDiffOutputPathUsesRealFilesystemEntries(diffFilePath, normalizedOptions.diffsOutputFolder);
        ensureDiffOutputDirectory(diffFilePath, normalizedOptions.diffsOutputFolder);
        assertDiffOutputPathUsesRealFilesystemEntries(diffFilePath, normalizedOptions.diffsOutputFolder);
        assertCanonicalDiffOutputPath(diffFilePath, normalizedOptions.diffsOutputFolder);
        // Stage the comparator's write at a securely-created random-named tempfile in the
        // same directory, then atomically rename into diffFilePath afterwards. rename()
        // replaces any symlink planted at diffFilePath during the write window without
        // following it, which is the only way to actually prevent — not just detect — a
        // redirected write when the comparator's API takes a path rather than an fd
        // (CWE-61 / CWE-367).
        stagedTempfilePath = createSecureDiffOutputTempfile(diffFilePath, normalizedOptions.diffsOutputFolder);
        scopedComparePngOptions = { ...resolvedComparePngOptions, diffFilePath: stagedTempfilePath };
    }

    let mismatchCount: number;
    try {
        mismatchCount = comparePng(
            planEntry.actualPage.content,
            planEntry.expectedPage.content,
            scopedComparePngOptions,
        );
    } catch (cause) {
        // Roll back the staged tempfile so a zero-byte file does not leak into the diffs
        // folder on the comparator's error path (would otherwise confuse CI artifacts).
        if (stagedTempfilePath) {
            discardDiffOutputLeaf(stagedTempfilePath);
        }
        throw new ComparePdfComparisonError(`Failed to compare rendered PDF page ${planEntry.pageNumber}.`, {
            cause,
        });
    }

    if (stagedTempfilePath && diffFilePath) {
        publishDiffOutputTempfile(stagedTempfilePath, diffFilePath, normalizedOptions.diffsOutputFolder, {
            expectDiffWritten: mismatchCount > threshold,
        });
    }

    const mismatchPercent = computeMismatchPercent(
        mismatchCount,
        planEntry.actualPage.width,
        planEntry.actualPage.height,
        planEntry.expectedPage.width,
        planEntry.expectedPage.height,
    );
    // A page passes when it is within EITHER the pixel-count threshold OR the configured
    // percentage threshold. The percentage tolerance therefore relaxes, never tightens, the
    // pixel-count default; when no percentage threshold is configured only the pixel check applies.
    const withinPixels = mismatchCount <= threshold;
    const withinPercent = thresholdPercent !== null && mismatchPercent <= thresholdPercent;
    const isEqual = withinPixels || withinPercent;

    return {
        pageNumber: planEntry.pageNumber,
        status: isEqual ? 'matched' : 'mismatched',
        isEqual,
        threshold,
        thresholdPercent,
        mismatchCount,
        mismatchPercent,
        diffFilePath,
        actualPageName,
        expectedPageName,
    };
}
