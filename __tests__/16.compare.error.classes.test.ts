import { expect, test } from 'vitest';
import { ComparePdfComparisonError } from '../src/errors/ComparePdfComparisonError.js';
import { ComparePdfConfigurationError } from '../src/errors/ComparePdfConfigurationError.js';
import { ComparePdfError } from '../src/errors/ComparePdfError.js';
import { ComparePdfInputError } from '../src/errors/ComparePdfInputError.js';
import { ComparePdfRenderingError } from '../src/errors/ComparePdfRenderingError.js';


test(`should expose library error subclasses with stable names and causes`, () => {
    const cause = new Error('root cause');

    const errors = [
        new ComparePdfComparisonError('comparison failed', { cause }),
        new ComparePdfConfigurationError('bad config', { cause }),
        new ComparePdfInputError('bad input', { cause }),
        new ComparePdfRenderingError('render failed', { cause }),
    ];

    for (const error of errors) {
        expect(error).toBeInstanceOf(ComparePdfError);
        expect(error.cause).toBe(cause);
        expect(error.name).toBe(error.constructor.name);
    }
});
