import { expect, test } from 'vitest';
import { toJUnitReport } from '../src/serialize/junitReport.js';
import { escapeXmlAttribute, escapeXmlText } from '../src/serialize/xml.js';
import type { ComparePdfDetailedResult } from '../src/types/ComparePdfDetailedResult.js';
import type { ComparePdfPageResult } from '../src/types/ComparePdfPageResult.js';

function page(overrides: Partial<ComparePdfPageResult>): ComparePdfPageResult {
    return {
        pageNumber: 1,
        status: 'matched',
        isEqual: true,
        threshold: 0,
        thresholdPercent: null,
        mismatchCount: 0,
        mismatchPercent: 0,
        diffFilePath: null,
        actualPageName: null,
        expectedPageName: null,
        ...overrides,
    };
}

function resultWith(pages: ComparePdfPageResult[]): ComparePdfDetailedResult {
    return {
        isEqual: pages.every((page) => page.isEqual),
        actualPageCount: pages.length,
        expectedPageCount: pages.length,
        compareThreshold: 0,
        compareThresholdPercent: null,
        writeDiffs: false,
        diffsOutputFolder: null,
        pages,
        summary: {
            totalPages: pages.length,
            matchedPages: 0,
            mismatchedPages: 0,
            missingPages: 0,
            maxMismatchPercent: 0,
            totalMismatchCount: 0,
        },
    };
}

test(`renders one testcase per page, with failures only for non-equal pages`, () => {
    const xml = toJUnitReport(
        resultWith([
            page({ pageNumber: 1, status: 'matched', isEqual: true }),
            page({
                pageNumber: 2,
                status: 'mismatched',
                isEqual: false,
                mismatchCount: 200,
                mismatchPercent: 2,
                threshold: 0,
                thresholdPercent: 1,
                actualPageName: 'a2.png',
                expectedPageName: 'e2.png',
            }),
            page({
                pageNumber: 3,
                status: 'mismatched',
                isEqual: false,
                mismatchCount: 5,
                mismatchPercent: 0.05,
                threshold: 0,
                thresholdPercent: null,
                actualPageName: null,
                expectedPageName: null,
            }),
            page({ pageNumber: 4, status: 'missing-actual', isEqual: false, expectedPageName: 'e4.png' }),
            page({ pageNumber: 5, status: 'missing-expected', isEqual: false, actualPageName: 'a5.png' }),
        ]),
    );

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<testsuites name="pdf-visual-compare" tests="5" failures="4">');
    expect(xml).toContain('<testcase name="page 1" classname="pdf-visual-compare" />');
    expect(xml).toContain('Page 2 exceeded the comparison threshold.');
    expect(xml).toContain('mismatchCount=200 (2%) exceeded pixel threshold 0, percentage threshold 1%.');
    expect(xml).toContain('actual=a2.png, expected=e2.png');
    expect(xml).toContain('mismatchCount=5 (0.05%) exceeded pixel threshold 0. actual=n/a, expected=n/a.');
    expect(xml).toContain('Page 4 is missing-actual.');
    expect(xml).toContain('missing (expected=e4.png)');
    expect(xml).toContain('Page 5 is missing-expected.');
    expect(xml).toContain('missing (actual=a5.png)');
    expect(xml.trimEnd().endsWith('</testsuites>')).toBe(true);
});

test(`XML-escapes caller-controlled page names in failure details`, () => {
    const xml = toJUnitReport(
        resultWith([
            page({
                pageNumber: 1,
                status: 'mismatched',
                isEqual: false,
                mismatchCount: 1,
                mismatchPercent: 0.01,
                threshold: 0,
                thresholdPercent: null,
                actualPageName: 'a&<>"1.png',
                expectedPageName: 'e1.png',
            }),
        ]),
    );

    expect(xml).toContain('actual=a&amp;&lt;&gt;"1.png');
    expect(xml).not.toContain('a&<>');
});

test(`handles an empty page list`, () => {
    const xml = toJUnitReport(resultWith([]));

    expect(xml).toContain('<testsuites name="pdf-visual-compare" tests="0" failures="0">');
    expect(xml).toContain('</testsuite>');
    expect(xml.trimEnd().endsWith('</testsuites>')).toBe(true);
});

test(`renders n/a for a mismatched page with null counts (defensive over the public result type)`, () => {
    const xml = toJUnitReport(
        resultWith([
            page({
                pageNumber: 1,
                status: 'mismatched',
                isEqual: false,
                mismatchCount: null,
                mismatchPercent: null,
                threshold: 0,
                thresholdPercent: null,
            }),
        ]),
    );

    expect(xml).toContain('mismatchCount=n/a (n/a%)');
});

test(`escapeXml helpers escape special characters and strip illegal XML control characters`, () => {
    expect(escapeXmlText('a & b < c > d')).toBe('a &amp; b &lt; c &gt; d');
    expect(escapeXmlAttribute('say "hi" & <go>')).toBe('say &quot;hi&quot; &amp; &lt;go&gt;');
    expect(escapeXmlText(`a${String.fromCharCode(0)}b${String.fromCharCode(8)}c`)).toBe('abc');
    expect(escapeXmlAttribute(`x${String.fromCharCode(31)}y`)).toBe('xy');
});
