import { expect, test } from 'vitest';
import { parsePageSelection } from '../src/internal/parsePageRange.js';
import { ComparePdfConfigurationError } from '../src/errors/ComparePdfConfigurationError.js';

test(`parses a mixed range spec into sorted unique page numbers`, () => {
    expect(parsePageSelection('1-3,5,7')).toEqual([1, 2, 3, 5, 7]);
});

test(`tolerates whitespace and de-duplicates overlapping entries`, () => {
    expect(parsePageSelection(' 2 , 1-3 , 3 ')).toEqual([1, 2, 3]);
});

test(`accepts a single page and a single-page range`, () => {
    expect(parsePageSelection('4')).toEqual([4]);
    expect(parsePageSelection('4-4')).toEqual([4]);
});

test(`accepts an explicit array of page numbers`, () => {
    expect(parsePageSelection([5, 1, 1, 2])).toEqual([1, 2, 5]);
});

test(`rejects descending ranges`, () => {
    expect(() => parsePageSelection('5-2')).toThrow(ComparePdfConfigurationError);
    expect(() => parsePageSelection('5-2')).toThrow('descending range');
});

test(`rejects empty entries and empty selections`, () => {
    expect(() => parsePageSelection('1,,2')).toThrow('empty entry');
    expect(() => parsePageSelection('')).toThrow('empty entry');
    expect(() => parsePageSelection([])).toThrow('must select at least one page');
});

test(`rejects zero, negative, fractional, and non-finite page numbers`, () => {
    expect(() => parsePageSelection('0')).toThrow('finite positive page numbers');
    expect(() => parsePageSelection('1-0')).toThrow('finite positive page numbers');
    expect(() => parsePageSelection([0])).toThrow('finite positive page numbers');
    expect(() => parsePageSelection([-1])).toThrow('finite positive page numbers');
    expect(() => parsePageSelection([1.5])).toThrow('finite positive page numbers');
    expect(() => parsePageSelection([Number.NaN])).toThrow('finite positive page numbers');
});

test(`rejects selections that would expand beyond the maximum, via range, single entries, or array`, () => {
    expect(() => parsePageSelection('1-1000001')).toThrow('exceeds the maximum of 1000000 pages');
    // A range just under the cap combined with a single entry that pushes it over.
    expect(() => parsePageSelection('1-1000000,1000002')).toThrow('exceeds the maximum of 1000000 pages');
    // Array length is checked up front without materializing entries.
    expect(() => parsePageSelection(new Array(1_000_001))).toThrow('exceeds the maximum of 1000000 pages');
});

test(`rejects page numbers beyond the safe integer range`, () => {
    expect(() => parsePageSelection('99999999999999999999')).toThrow('finite positive page numbers');
    expect(() => parsePageSelection('9007199254740993')).toThrow('finite positive page numbers');
});

test(`truncates an overlong spec when echoing it in error messages`, () => {
    const longSpec = `${'1,'.repeat(60)}bad`;
    expect(longSpec.length).toBeGreaterThan(80);
    try {
        parsePageSelection(longSpec);
        throw new Error('expected parsePageSelection to throw');
    } catch (error) {
        const message = (error as Error).message;
        expect(message).toContain('…');
        expect(message.length).toBeLessThan(longSpec.length);
    }
});

test(`rejects unparseable tokens and wrong input types`, () => {
    expect(() => parsePageSelection('1-2-3')).toThrow('invalid entry');
    expect(() => parsePageSelection('abc')).toThrow('invalid entry');
    expect(() => parsePageSelection(['1'])).toThrow('must be numbers; received string');
    expect(() => parsePageSelection(42)).toThrow('range spec string');
    expect(() => parsePageSelection(undefined)).toThrow('range spec string');
});
