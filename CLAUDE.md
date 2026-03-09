# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm run build          # Compile TypeScript to ./out (runs clean first)
npm run lint           # Run ESLint
npm run lint:fix       # Run ESLint with auto-fix
npm test               # Full test suite: clean + lint + license check + build + vitest with coverage
npx vitest run         # Run tests without the pre-steps (faster for iteration)
npx vitest run __tests__/1.compare.equal.pdf.files.test.ts  # Run a single test file
npm run clean          # Remove ./out, ./coverage, ./test-results, ./comparePdfOutput
```

Tests have a 90-second timeout (`vitest.config.mjs`) because PDF-to-PNG conversion is slow. Coverage thresholds are enforced (100% statements/lines/functions, 90% branches).

## Architecture

This is a small TypeScript library published to npm. Source lives in `src/`, compiled output goes to `out/` (the published artifact).

**Data flow:** `comparePdf(actualPdf, expectedPdf, opts)` →
1. Validates inputs: `Buffer.isBuffer`, `instanceof ArrayBuffer/SharedArrayBuffer`, or string path existence; throws for anything else
2. Converts both PDFs to PNG arrays via `pdfToPng` from `pdf-to-png-converter` — **sequentially**, not in parallel (concurrent calls corrupt the shared PDF.js worker state, causing "Invalid page request" errors)
3. Compares each actual page against the corresponding expected page via `comparePng` from `png-visual-compare`
4. If expected has more pages than actual, returns `false` immediately after the loop
5. Returns `false` if any page exceeds the applicable threshold; per-page `matchingThreshold` in `ExcludedPageArea` overrides the document-level `compareThreshold`

**Key constraint:** `pdfToPng` calls must remain sequential. `Promise.all` causes "Invalid page request" errors when PDFs have different page counts due to shared PDF.js worker state.

**`excludedAreas` matching:** entries in `ComparePdfOptions.excludedAreas` are matched to pages by their `pageNumber` field (1-based, not array index). An entry with `pageNumber: 1` applies to the first page regardless of its position in the array.

**`ComparePngOptions` surface:** `png-visual-compare`'s `ComparePngOptions` only accepts `excludedAreas`, `diffFilePath`, `throwErrorOnInvalidInputData`, and `pixelmatchOptions`. The `ExcludedPageArea` fields `matchingThreshold` and `excludedAreaColor` are NOT forwarded to `comparePng` — `matchingThreshold` is applied manually as a per-page threshold override, and `excludedAreaColor` is reserved for future use.

**Public API** (exported from `src/index.ts`):
- `comparePdf(actualPdf: string | Buffer | ArrayBufferLike, expectedPdf: string | Buffer | ArrayBufferLike, opts?: ComparePdfOptions): Promise<boolean>`
- `ComparePdfOptions` type
- `ExcludedPageArea` type

**Dependencies:**
- `pdf-to-png-converter` — renders PDF pages to PNG buffers using PDF.js (no native binaries)
- `png-visual-compare` — pixel-level PNG comparison with exclusion zone support

## Test Structure

Tests are in `__tests__/` and use Vitest. Test PDFs are in `test-data/`. Tests import directly from `../src` (not the compiled output), so no build step is needed for running tests in isolation. Test 8 (`8.compare.undefined.page.content.test.ts`) uses `vi.mock` to simulate a `pdfToPng` returning `content: undefined`, covering the content-guard branch.
