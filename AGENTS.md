# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

```sh
npm run build          # Compile TypeScript to ./out (runs clean first)
npm run lint           # Run Oxlint and fail on warnings
npm run lint:fix       # Apply Oxlint fixes
npm run format         # Format files with Oxfmt
npm run format:check   # Verify formatting
npm run test:types     # Type-check all repo TypeScript, including the built-package fixture
npm run test:artifacts # Verify built entry points/export map behavior and npm pack contents
npm test               # Check formatting, lint, licenses, build, types, package artifacts and test coverage
npx vitest run         # Run tests without the pre-steps (faster for iteration)
npx vitest run __tests__/1.compare.equal.pdf.files.test.ts  # Run a single test file
npm run clean          # Remove ./out, ./coverage, ./test-results, ./comparePdfOutput
node ./out/cli.js a.pdf b.pdf  # Run the built CLI (published entry point: `npx pdf-visual-compare`)
```

Tests have a 90-second timeout (`vitest.config.mjs`) because PDF-to-PNG conversion is slow. Coverage thresholds are enforced (100% statements/lines/functions, 90% branches).

Use Node 26 or newer. The local `typescript` dependency supplies the TypeScript 7 compiler for both the build and type checks.

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
- Keep page comparison sequential. Benchmark and review the renderer and comparator together before introducing parallel comparisons.
- All caller-supplied filesystem roots (`allowedInputRoot`, `diffsOutputFolder`, `pdfToPngConvertOptions.outputFolder`) share a single sandbox-parity contract: non-empty string, must resolve to a directory when it already exists, and may not traverse a symbolic link at the leaf or any existing ancestor. The shared symlink-rejection + path-containment primitives live in `src/internal/securePath.ts` — keep CWE-59 / CWE-61 fixes consolidated there.
- `pdfToPngConvertOptions.outputFolder` additionally takes library ownership of leaf-directory creation: the resolved path and the `actual/`/`expected/` namespace subdirectories are pre-created and re-asserted (`lstat`) to be real directories during normalization, closing the residual validate→render TOCTOU window (CWE-367) that the path walker cannot cover. Replicate that pattern for any future caller that lets a third-party writer create files inside a user-supplied folder.

**`excludedAreas` matching:** entries in `ComparePdfOptions.excludedAreas` are matched to pages by their `pageNumber` field (1-based, not array index). An entry with `pageNumber: 1` applies to the first page regardless of its position in the array.

**`ComparePngOptions` surface:** `comparePdf` forwards `excludedAreas`, `excludedAreaColor`, `diffFilePath`, and `throwErrorOnInvalidInputData` to `png-visual-compare`. The per-page `ExcludedPageArea.matchingThreshold` (pixels) and `matchingThresholdPercent` (0–100) are applied inside `comparePdf` as threshold overrides rather than being forwarded downstream.

**Thresholds:** `compareThreshold` (absolute differing-pixel count) and the optional `compareThresholdPercent` (0–100) combine with **OR semantics** — a page passes when within EITHER threshold, so a percentage relaxes (never tightens) the pixel default. `mismatchPercent = mismatchCount / (max(actualWidth, expectedWidth) * max(actualHeight, expectedHeight)) * 100` — the normalized comparison canvas `png-visual-compare` extends both pages onto (`normalizeImages.js`), so the value stays within `[0, 100]` for differing sizes/aspect ratios. Computed in `comparePlannedPage`, rolled up into `ComparePdfDetailedResult.summary` (`src/internal/mismatchStats.ts`). The percentage-threshold *decision* uses the unrounded value (`computeUnroundedMismatchPercent`); only the reported `mismatchPercent` is rounded to 4 decimals (`computeMismatchPercent`) — deciding against the rounded value would let a tiny nonzero mismatch that rounds to 0% pass a strict `compareThresholdPercent: 0`.

**Page selection:** `ComparePdfOptions.pages` (a `"1-3,5,7"` spec or a `number[]`) filters the comparison plan in `comparePdf.ts` after page discovery, so only selected pages are rendered. Parsing lives in `src/internal/parsePageRange.ts` (bounded by `MAX_SELECTED_PAGES`); a selection matching no rendered page throws instead of passing vacuously.

**Public API** (exported from `src/index.ts`):

- `comparePdf(actualPdf, expectedPdf, opts?): Promise<boolean>` and `comparePdfDetailed(actualPdf, expectedPdf, opts?): Promise<ComparePdfDetailedResult>`
- Reports: `toJsonReport(result)` and `toJUnitReport(result)` serialize a detailed result to JSON / JUnit XML (`src/serialize/*`)
- Error classes: `ComparePdfError` plus `ComparePdfConfigurationError`, `ComparePdfInputError`, `ComparePdfRenderingError`, `ComparePdfComparisonError`
- Types: `ComparePdfOptions`, `ComparePdfDetailedResult`, `ComparePdfPageResult`, `ComparePdfPageStatus`, `ComparePdfSummary`, `PdfInput`, `PdfRenderOptions`, `PageExclusion` (alias `ExcludedPageArea`), `PageArea`, `RgbColor`

**CLI:** `npx pdf-visual-compare <actual.pdf> <expected.pdf> [--threshold N] [--threshold-percent N] [--pages "1-3,5"] [--format text|json|junit] [--out dir] [--fail-on-diff]`; exit codes `0`/`1`/`2`. Hand-rolled (no `commander`) — bin `out/cli.js`, logic in `src/cli/*` (dependency-injection-tested), shim `src/cli.ts` (shebang preserved by `tsc`, excluded from coverage like `index.ts`).

**Dependencies:**

- `pdf-to-png-converter` — renders PDF pages to PNG buffers using PDF.js plus prebuilt `@napi-rs/canvas` binaries
- `png-visual-compare` — pixel-level PNG comparison with exclusion zone support

## Test Structure

Tests are in `__tests__/` and use Vitest. Test PDFs are in `test-data/`. `tsconfig.json` is the workspace/dev config and includes all repo `.ts` files, including `__tests__/published-artifacts/consumer-types.ts`, which verifies the built package surface via a self-reference to `pdf-visual-compare`. That means `npm run test:types` still requires `./out/` to be current. Run `npm test` for the full validation path; use `npm run build` first if you want to execute the published-surface checks directly.

## Mistake Logging

Log one compact event per mistake (20-40 tokens, no filler):

```text
Ctx:
Err:
Cause:
Fix:
Rule:
```

Store project-specific mistakes in this `AGENTS.md` file under this section; keep generalizable rules in global memory. Do not rely on an uncommitted `.Codex/memory` path.

```text
Ctx: Comparator upgrade
Err: Claimed Node 26 was required
Cause: Read upstream main
Fix: Checked the published tarball
Rule: Verify engines in the exact npm release
```
