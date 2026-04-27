import { expect, test } from 'vitest';
import { buildPageComparisonPlan } from '../src/internal/pageComparisonPlan.js';

test(`should plan page comparisons by page number with first exclusion winning`, () => {
    const plan = buildPageComparisonPlan(
        [
            { name: 'actual-4.png', pageNumber: 4, content: Buffer.from('actual-4') },
            { name: 'actual-2.png', pageNumber: 2, content: Buffer.from('actual-2') },
        ],
        [{ name: 'expected-3.png', pageNumber: 3, content: Buffer.from('expected-3') }],
        [
            { pageNumber: 3, matchingThreshold: 5 },
            { pageNumber: 3, matchingThreshold: 10 },
        ],
    );

    expect(plan.map((entry) => entry.pageNumber)).toEqual([2, 3, 4]);
    expect(plan[1]?.pageExclusion?.matchingThreshold).toBe(5);
    expect(plan[1]?.expectedPage?.name).toBe('expected-3.png');
});
