import { ComparePdfConfigurationError } from '../errors/ComparePdfConfigurationError.js';

const SINGLE_PAGE = /^\d+$/;
const PAGE_RANGE = /^(\d+)-(\d+)$/;

/**
 * Upper bound on the number of pages a single selection may expand to. Guards against a
 * pathological selection (e.g. a CLI typo like `1-1000000000`, a millions-long comma list, or
 * a huge array) materializing an enormous array/Set. Far larger than any realistic PDF page
 * count, so legitimate selections are never affected.
 */
const MAX_SELECTED_PAGES = 1_000_000;

/** Maximum spec length echoed back in error messages, to bound thrown `Error.message` size. */
const SPEC_PREVIEW_LENGTH = 80;

/**
 * Accepted shape of the `pages` selection option: either a comma-separated range spec
 * (e.g. `"1-3,5,7"`) or an explicit array of 1-based page numbers (e.g. `[1, 2, 3, 5, 7]`).
 */
export type PageSelection = string | readonly number[];

/**
 * Normalizes a page selection into a sorted, de-duplicated array of 1-based page numbers.
 *
 * Fails fast with a {@link ComparePdfConfigurationError} on any malformed entry (non-integer,
 * non-positive, out of safe-integer range, descending range, unparseable token, wrong type),
 * when the selection resolves to no pages, or when it would expand beyond
 * {@link MAX_SELECTED_PAGES} — surfacing caller mistakes instead of silently comparing nothing
 * or exhausting memory.
 *
 * @param pages - A range spec string or an array of page numbers. Runtime-validated; the
 * declared type is not trusted because callers (and the CLI) may pass untyped input.
 * @returns Sorted unique page numbers, guaranteed to contain at least one entry.
 */
export function parsePageSelection(pages: unknown): number[] {
    let pageNumbers: number[];

    if (typeof pages === 'string') {
        pageNumbers = fromSpecString(pages);
    } else if (Array.isArray(pages)) {
        pageNumbers = fromNumbers(pages);
    } else {
        throw new ComparePdfConfigurationError(
            'pages must be a range spec string (e.g. "1-3,5,7") or an array of page numbers.',
        );
    }

    const uniqueSorted = [...new Set(pageNumbers)].sort((left, right) => left - right);
    if (uniqueSorted.length === 0) {
        throw new ComparePdfConfigurationError('pages must select at least one page.');
    }

    return uniqueSorted;
}

function fromSpecString(spec: string): number[] {
    const pageNumbers: number[] = [];

    for (const rawToken of spec.split(',')) {
        const token = rawToken.trim();
        if (token === '') {
            throw new ComparePdfConfigurationError(`pages spec "${previewSpec(spec)}" has an empty entry.`);
        }

        const rangeMatch = PAGE_RANGE.exec(token);
        if (rangeMatch) {
            const start = Number(rangeMatch[1]);
            const end = Number(rangeMatch[2]);
            assertPositivePage(start);
            assertPositivePage(end);
            if (start > end) {
                throw new ComparePdfConfigurationError(
                    `pages spec "${previewSpec(spec)}" has a descending range "${token}".`,
                );
            }
            assertSelectionWithinLimit(pageNumbers.length + (end - start + 1));
            for (let page = start; page <= end; page += 1) {
                pageNumbers.push(page);
            }
            continue;
        }

        if (!SINGLE_PAGE.test(token)) {
            throw new ComparePdfConfigurationError(`pages spec "${previewSpec(spec)}" has an invalid entry "${token}".`);
        }

        const page = Number(token);
        assertPositivePage(page);
        pageNumbers.push(page);
        assertSelectionWithinLimit(pageNumbers.length);
    }

    return pageNumbers;
}

function fromNumbers(pages: readonly unknown[]): number[] {
    assertSelectionWithinLimit(pages.length);

    return pages.map((page) => {
        if (typeof page !== 'number') {
            throw new ComparePdfConfigurationError(`pages array entries must be numbers; received ${typeof page}.`);
        }
        assertPositivePage(page);
        return page;
    });
}

function assertPositivePage(page: number): void {
    if (!Number.isInteger(page) || page <= 0 || page > Number.MAX_SAFE_INTEGER) {
        throw new ComparePdfConfigurationError(
            `pages must reference finite positive page numbers within the safe integer range; received ${page}.`,
        );
    }
}

function assertSelectionWithinLimit(selectedCount: number): void {
    if (selectedCount > MAX_SELECTED_PAGES) {
        throw new ComparePdfConfigurationError(
            `pages selection exceeds the maximum of ${MAX_SELECTED_PAGES} pages; narrow the selection.`,
        );
    }
}

function previewSpec(spec: string): string {
    return spec.length > SPEC_PREVIEW_LENGTH ? `${spec.slice(0, SPEC_PREVIEW_LENGTH)}…` : spec;
}
