# Copilot Instructions

## Commands

```sh
npm run build          # Compile TypeScript to ./out/
npm run test           # lint + license check + build + vitest with coverage
npm run lint           # ESLint only
npm run lint:fix       # ESLint with auto-fix
```

Run a single test file:
```sh
npx vitest run __tests__/1.compare.equal.pdf.files.test.ts
```

Run tests in Docker (used for CI parity):
```sh
npm run test:docker
```

> `npm run test` runs `pretest` first: clean → lint → license check → build. Run `npm run build` before running tests directly if skipping `pretest`.

## Architecture

This is a TypeScript library with a single public API: `comparePdf(actualPdf, expectedPdf, opts?)`.

**Pipeline:** `comparePdf` (src/comparePdf.ts)
1. Validates inputs (file path existence or Buffer type)
2. Converts both PDFs to arrays of PNG pages in parallel via `pdfToPng` (`pdf-to-png-converter`)
3. Ensures the longer array is `actualPdfPngPages` to avoid index out-of-bounds
4. For each page, calls `comparePng` (`png-visual-compare`) with per-page excluded areas and threshold
5. Returns `true` if all pages are within `compareThreshold` pixel difference count

**Key dependencies:**
- `pdf-to-png-converter` — converts PDF pages to PNG buffers (no system binaries needed)
- `png-visual-compare` — pixel-level PNG diff, writes diff images to `comparePdfOutput/` by default

**Public exports** (`src/index.ts`): `comparePdf`, `ComparePdfOptions`, `ExcludedPageArea`

**Build output**: `./out/` (TypeScript compiled, declarations included). Only `./out` is published to npm.

## Key Conventions

- Source files use `.js` extensions in imports (e.g., `'./comparePdf.js'`) even though the source is TypeScript — required by `moduleResolution: node16`.
- `excludedAreas` is indexed by page position (0-based array index), not by `pageNumber` value. The `pageNumber` field on `ExcludedPageArea` is metadata only; matching is done by array index.
- `compareThreshold` is an **absolute pixel count** (not a 0–1 ratio) when used in practice — the README example of `0.1` is misleading; see test 5 where threshold values are in the tens of thousands.
- Test files are numbered with a prefix (`1.`, `2.`, …) to control execution order and group related scenarios.
- Test data PDFs live in `./test-data/`; diff outputs go to `./test-results/` (cleaned before each test run).
- Default diffs output folder is `./comparePdfOutput` (defined in `src/const.ts`).
