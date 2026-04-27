# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm run build          # Compile TypeScript to ./out (runs clean first)
npm run lint           # Run ESLint
npm run lint:fix       # Run ESLint with auto-fix
npm run test:types     # Compile consumer-style TypeScript usage against the built package declarations
npm run test:artifacts # Verify built entry points/export map behavior and npm pack contents
npm test               # Full test suite: clean + lint + license check + build + type/artifact checks + vitest with coverage
npx vitest run         # Run tests without the pre-steps (faster for iteration)
npx vitest run __tests__/1.compare.equal.pdf.files.test.ts  # Run a single test file
npm run clean          # Remove ./out, ./coverage, ./test-results, ./comparePdfOutput
```

Tests have a 90-second timeout (`vitest.config.mjs`) because PDF-to-PNG conversion is slow. Coverage thresholds are enforced (100% statements/lines/functions, 90% branches).

## Architecture

This is a small TypeScript library published to npm. Source lives in `src/`, compiled output goes to `out/` (the published artifact).

**Data flow:** `comparePdf(actualPdf, expectedPdf, opts)` →
1. Validates and normalizes inputs: `string`, `Buffer`, `ArrayBuffer`, or `SharedArrayBuffer`; string inputs can be constrained by `allowedInputRoot`
2. Discovers rendered page numbers via `pdfToPng` metadata-only calls — **sequentially**, not in parallel (concurrent document renders corrupt the shared PDF.js worker state and can cause "Invalid page request" errors)
3. Builds a page-number keyed comparison plan
4. Renders only the needed pages, one page at a time, via `pdfToPng`
5. Compares each rendered page pair via synchronous `comparePng` from `png-visual-compare`
6. Returns `false` if any page exceeds the applicable threshold or if one side is missing a planned page

**Key constraints:**
- `pdfToPng` document renders must remain sequential. `Promise.all` causes "Invalid page request" errors when PDFs have different page counts due to shared PDF.js worker state.
- Page rendering is intentionally bounded-memory: plan first, then render/compare per page instead of holding both full documents in memory.
- Page comparison is still sequential even after upgrading to `png-visual-compare` 6.x. That dependency now exposes async/ported comparison entry points, but this library should not parallelize page comparison without a benchmark and safety review.

**`excludedAreas` matching:** entries in `ComparePdfOptions.excludedAreas` are matched to pages by their `pageNumber` field (1-based, not array index). An entry with `pageNumber: 1` applies to the first page regardless of its position in the array.

**`ComparePngOptions` surface:** `comparePdf` forwards `excludedAreas`, `excludedAreaColor`, `diffFilePath`, and `throwErrorOnInvalidInputData` to `png-visual-compare`. The `ExcludedPageArea.matchingThreshold` field is still applied inside `comparePdf` as a per-page threshold override rather than being forwarded downstream.

**Public API** (exported from `src/index.ts`):
- `comparePdf(actualPdf: PdfInput, expectedPdf: PdfInput, opts?: ComparePdfOptions): Promise<boolean>`
- `ComparePdfOptions` type
- `PdfInput` type
- `ExcludedPageArea` type

**Dependencies:**
- `pdf-to-png-converter` — renders PDF pages to PNG buffers using PDF.js plus prebuilt `@napi-rs/canvas` binaries (Node `>=24`)
- `png-visual-compare` — pixel-level PNG comparison with exclusion zone support

## Test Structure

Tests are in `__tests__/` and use Vitest. Test PDFs are in `test-data/`. Most Vitest suites import directly from `../src`, but `__tests__/published-artifacts/` verifies the built package surface via self-references to `pdf-visual-compare`, so those checks require `./out/` to be current. Run `npm test` for the full validation path; use `npm run build` first if you want to execute the published-surface checks directly.

## Mistake Logging

Log one compact event per mistake (20-40 tokens, no filler):

```text
Ctx:
Err:
Cause:
Fix:
Rule:
```

Store project-specific mistakes in this `CLAUDE.md` file under this section; keep generalizable rules in global memory. Do not rely on an uncommitted `.claude/memory` path.
