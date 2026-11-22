import type { ComparePdfDetailedResult } from '../types/ComparePdfDetailedResult.js';
import type { ComparePdfPageResult } from '../types/ComparePdfPageResult.js';
import { escapeXmlAttribute, escapeXmlText } from './xml.js';

const SUITE_NAME = 'pdf-visual-compare';

/**
 * Serializes a {@link ComparePdfDetailedResult} as a JUnit XML test report.
 *
 * The report has one `<testcase>` for each planned page. It has a `<failure>` for each page
 * that is not equal: a mismatched page or a page without a counterpart. The output has no
 * timestamps. Thus, the output is the same for the same result, in snapshots and in CI diffs.
 * The function escapes the XML special characters in the page names that callers control.
 */
export function toJUnitReport(result: ComparePdfDetailedResult): string {
    const tests = result.pages.length;
    const failures = result.pages.filter((page) => !page.isEqual).length;
    const suiteName = escapeXmlAttribute(SUITE_NAME);

    const lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `<testsuites name="${suiteName}" tests="${tests}" failures="${failures}">`,
        `  <testsuite name="${suiteName}" tests="${tests}" failures="${failures}">`,
    ];

    for (const page of result.pages) {
        lines.push(...renderTestCase(page));
    }

    lines.push('  </testsuite>', '</testsuites>');
    return lines.join('\n');
}

function renderTestCase(page: ComparePdfPageResult): string[] {
    const open = `    <testcase name="${escapeXmlAttribute(`page ${page.pageNumber}`)}" classname="${escapeXmlAttribute(
        SUITE_NAME,
    )}"`;

    if (page.isEqual) {
        return [`${open} />`];
    }

    return [
        `${open}>`,
        `      <failure message="${escapeXmlAttribute(failureMessage(page))}">${escapeXmlText(
            failureDetails(page),
        )}</failure>`,
        '    </testcase>',
    ];
}

function failureMessage(page: ComparePdfPageResult): string {
    if (page.status === 'mismatched') {
        return `Page ${page.pageNumber} exceeded the comparison threshold.`;
    }

    return `Page ${page.pageNumber} is ${page.status}.`;
}

function failureDetails(page: ComparePdfPageResult): string {
    if (page.status === 'mismatched') {
        const percentThreshold =
            page.thresholdPercent === null ? '' : `, percentage threshold ${page.thresholdPercent}%`;
        // mismatchCount/mismatchPercent are always non-null for a mismatched page produced by the
        // pipeline, but ComparePdfPageResult is a public type that permits null, so guard defensively.
        return (
            `mismatchCount=${orNa(page.mismatchCount)} (${orNa(page.mismatchPercent)}%) exceeded ` +
            `pixel threshold ${page.threshold}${percentThreshold}. ` +
            `actual=${orNa(page.actualPageName)}, expected=${orNa(page.expectedPageName)}.`
        );
    }

    const presentSide =
        page.status === 'missing-actual'
            ? `expected=${orNa(page.expectedPageName)}`
            : `actual=${orNa(page.actualPageName)}`;
    return `No comparison ran because one rendered counterpart was missing (${presentSide}).`;
}

function orNa(value: string | number | null): string {
    return value === null ? 'n/a' : String(value);
}
