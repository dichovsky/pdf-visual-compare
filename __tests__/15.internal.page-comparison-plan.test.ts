import { expect, test } from 'vitest';
import { buildPageNumberComparisonPlan } from '../src/internal/pageComparisonPlan.js';

test(`should plan page comparisons by page number with first exclusion winning`, () => {
    const plan = buildPageNumberComparisonPlan(
        [4, 2],
        [3],
        [
            { pageNumber: 3, matchingThreshold: 5 },
            { pageNumber: 3, matchingThreshold: 10 },
        ],
    );

    expect(plan.map((entry) => entry.pageNumber)).toEqual([2, 3, 4]);
    expect(plan[1]?.pageExclusion?.matchingThreshold).toBe(5);
});
