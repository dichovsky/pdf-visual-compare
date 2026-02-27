# Copilot Instructions

## Commands

```sh
npm run build          # Compile TypeScript → ./out/ (runs clean first via prebuild)
npm run clean          # Delete ./out/, ./coverage/, ./test-results/, ./comparePdfOutput/
npm run test           # Full pipeline: clean → lint → license check → build → vitest --coverage
npm run lint           # ESLint only (no build)
npm run lint:fix       # ESLint with auto-fix
npm run test:license   # Verify all production dependencies use approved licenses
npm run test:docker    # Build Docker image and run tests inside it (Linux parity)
```

Run a single test file directly (skips `pretest`; requires `./out/` to be up to date):
```sh
npx vitest run __tests__/1.compare.equal.pdf.files.test.ts
```

Run Docker steps individually:
```sh
npm run docker:build   # docker build → image: test-pdf-visual-compare
npm run docker:run     # docker run (mounts ./test-results into container)
```

> `npm run test` always runs `pretest` first (clean → lint → license → build). If you want to skip
> that pipeline and run vitest directly, run `npm run build` first, then `npx vitest run`.

---

## Project Structure

```
pdf-visual-compare/
├── src/
│   ├── index.ts                  # Public entry point — re-exports comparePdf + types
│   ├── comparePdf.ts             # Core implementation
│   ├── const.ts                  # DEFAULT_DIFFS_FOLDER constant
│   └── types/
│       ├── ComparePdfOptions.ts  # Options type for comparePdf()
│       └── ExcludedPageArea.ts   # Per-page exclusion zone type
├── __tests__/                    # Vitest test files (numbered for ordering)
│   ├── 1.compare.equal.pdf.files.test.ts
│   ├── 2.compare.non.equal.pdf.files.test.ts
│   ├── 3.compare.non.equal.pdfs.with.exclusion.test.ts
│   ├── 4.compare.pdf.exceptions.test.ts
│   ├── 5.compare.threshold.test.ts
│   ├── 6.compare.equal.pdf.buffers.test.ts
│   ├── 7.compare.non.equal.pdf.buffers.test.ts
│   └── 8.compare.with.custom.pdf.options.test.ts
├── test-data/                    # PDF fixtures used by tests
│   ├── pdf1.pdf                  # 2-page reference PDF
│   ├── pdf11.pdf                 # Visual duplicate of pdf1.pdf (equal)
│   ├── pdf2.pdf                  # 2-page PDF that visually differs from pdf1.pdf
│   └── pdf3.pdf                  # Different page count from pdf1.pdf
├── out/                          # TypeScript build output (gitignored; npm published)
├── .github/
│   ├── workflows/
│   │   ├── test.yml              # CI: run tests on push (Ubuntu + Windows)
│   │   └── publish.yml           # CD: publish to npm on GitHub release
│   └── copilot-instructions.md   # This file
├── tsconfig.json
├── eslint.config.mjs
├── vitest.config.mjs
├── .prettierrc
├── Dockerfile                    # Node 20, runs docker:test
└── package.json
```

---

## Architecture

This library exposes a single async function: `comparePdf(actualPdf, expectedPdf, opts?)`.

### Pipeline (`src/comparePdf.ts`)

```
actualPdf / expectedPdf
        │
        ▼
1. validateInputFileType()
   ├── Buffer → accepted
   ├── string + file exists → accepted
   ├── string + file missing → throw "PDF file not found: <path>"
   └── other → throw "Unknown input file type."
        │
        ▼
2. Merge pdfToPngConvertOptions defaults
   ├── viewportScale defaults to 2.0 (if not provided)
   └── outputFileMaskFunc defaults to (n) => `comparePdf_${n}.png`
        │
        ▼
3. Validate compareThreshold >= 0 (throws if negative)
        │
        ▼
4. Promise.all([pdfToPng(actual), pdfToPng(expected)])
   - Both PDFs converted to PNG arrays in parallel
   - Uses pdf-to-png-converter (pure JavaScript, no native binaries)
        │
        ▼
5. Ensure actualPdfPngPages.length >= expectedPdfPngPages.length
   - If not, swap arrays (prevents index-out-of-bounds on the forEach)
        │
        ▼
6. forEach over actualPdfPngPages pages:
   ├── Build ComparePngOptions from excludedAreas[index] (0-based index, not pageNumber)
   ├── diffFilePath = resolve(diffsOutputFolder, `diff_${pngPage.name}`)
   ├── Find matching expected page by name (pngPage.name)
   │   └── If no matching page → passes empty string as expected content (will produce diff)
   ├── comparePng(actual.content, expected.content, opts)
   └── If result > compareThreshold → documentCompareResult = false
        │
        ▼
7. Returns boolean (true = within threshold, false = differences exceed threshold)
```

### Dependencies

| Package | Role |
|---------|------|
| `pdf-to-png-converter` | Converts PDF pages to PNG `Buffer`s. Pure JS, no system binaries (uses pdfjs-dist internally). Supports file paths and `ArrayBufferLike` inputs, passwords, partial page processing, parallel rendering. |
| `png-visual-compare` | Pixel-level PNG diff. Accepts `Buffer` or file path. Returns absolute pixel difference count. Writes diff images to disk. Supports exclusion rectangles and per-comparison thresholds. |

---

## Public API

### `comparePdf(actualPdf, expectedPdf, opts?)`

**Signature:**
```typescript
function comparePdf(
    actualPdf: string | ArrayBufferLike,
    expectedPdf: string | ArrayBufferLike,
    opts?: ComparePdfOptions,
): Promise<boolean>
```

**Returns:** `true` if all pages are within the configured pixel threshold, `false` otherwise.

**Throws:**
- `Error: PDF file not found: <path>` — string path that does not exist on disk
- `Error: Unknown input file type.` — input is neither `Buffer` nor `string`
- `Error: Compare Threshold cannot be less than 0.` — `opts.compareThreshold < 0`

---

### `ComparePdfOptions`

```typescript
type ComparePdfOptions = {
    diffsOutputFolder?: string;          // Default: "./comparePdfOutput" (resolved absolute path)
    compareThreshold?: number;           // Default: 0 (pixel-perfect). Absolute pixel count, NOT a percentage.
    excludedAreas?: readonly ExcludedPageArea[];  // Default: []
    pdfToPngConvertOptions?: PdfToPngOptions;     // Forwarded to pdf-to-png-converter
};
```

**`pdfToPngConvertOptions` defaults applied inside `comparePdf`:**
- `viewportScale`: `2.0` (applied only when not provided by the caller)
- `outputFileMaskFunc`: `(n) => "comparePdf_${n}.png"` (applied only when not provided)

All other `PdfToPngOptions` fields are passed through as-is. Useful options:
- `pagesToProcess: number[]` — compare only specific pages (1-based)
- `pdfFilePassword: string` — handle encrypted PDFs
- `disableFontFace: boolean` — default `true` in pdf-to-png-converter
- `useSystemFonts: boolean` — default `false`
- `enableXfa: boolean` — default `false`
- `outputFolder: string` — save intermediate PNGs to disk

---

### `ExcludedPageArea`

```typescript
type ExcludedPageArea = {
    pageNumber: number;          // Informational only — matching uses array index
    excludedAreas?: Area[];      // [{ x1, y1, x2, y2 }] in pixels at viewportScale
    excludedAreaColor?: Color;   // { r, g, b } 0–255; fill color in diff images
    diffFilePath?: string;       // Override diff image output path for this page
    matchingThreshold?: number;  // Per-page threshold, overrides compareThreshold
};
```

`Area` and `Color` are imported from `png-visual-compare`.

---

## Key Conventions

### `excludedAreas` is matched by array index, not `pageNumber`

The `pageNumber` field on `ExcludedPageArea` is **metadata only** — it has no effect on which page the exclusion is applied to. Matching is strictly positional: `excludedAreas[0]` applies to page 1, `excludedAreas[1]` to page 2, etc.

```typescript
// This excludes an area on page 1 (index 0) and another on page 2 (index 1),
// regardless of what pageNumber values are set:
excludedAreas: [
    { pageNumber: 1, excludedAreas: [{ x1: 700, y1: 375, x2: 790, y2: 400 }] },
    { pageNumber: 2, excludedAreas: [{ x1: 680, y1: 240, x2: 955, y2: 465 }] },
]
```

### `compareThreshold` is an absolute pixel count

`compareThreshold` is the **maximum number of differing pixels** allowed across the compared PNGs — not a ratio or percentage. The constant `14058` appears in test 5 as a real-world difference between `pdf1.pdf` and `pdf2.pdf` at `viewportScale: 2.0`.

- `compareThreshold: 0` → pixel-perfect match required
- `compareThreshold: 14058` → up to 14 058 differing pixels allowed
- `compareThreshold: -1` → throws immediately

### `.js` extensions in TypeScript imports

All intra-package imports use `.js` extensions despite the source being TypeScript:
```typescript
import { DEFAULT_DIFFS_FOLDER } from './const.js';
```
This is required by `"moduleResolution": "node16"` in `tsconfig.json`. The TypeScript compiler maps `.js` back to `.ts` sources at compile time.

### Page matching by name

When pages of differing counts are compared, the expected page is found by `pngPage.name` equality, not by index. If no matching name is found, an empty string is passed to `comparePng`, which will produce a non-zero diff ensuring the comparison fails.

### Array swap for different page counts

If `actualPdfPngPages.length < expectedPdfPngPages.length`, the two arrays are **swapped** so that the longer one is always `actualPdfPngPages`. This ensures the `forEach` loop iterates over every page, guaranteeing a mismatch is detected when page counts differ.

---

## Testing

**Framework:** Vitest
**Config:** `vitest.config.mjs` — timeout: 90 000 ms per test, coverage via v8, `index.ts` excluded from coverage (it only re-exports).

**Test files** are in `__tests__/` and numbered for deterministic execution order:

| File | What it covers |
|------|----------------|
| `1.*` | Equal file paths → `true` |
| `2.*` | Non-equal files → `false`; mismatched page count → `false` |
| `3.*` | Non-equal PDFs become equal when differing regions are excluded |
| `4.*` | All error conditions: missing file (actual), missing file (expected), invalid type (actual), invalid type (expected), negative threshold |
| `5.*` | Threshold boundary: exact match, one below, one above, equal PDFs with threshold |
| `6.*` | Equal `Buffer` inputs → `true` |
| `7.*` | Non-equal `Buffer` inputs → `false`; mismatched page count via buffers → `false` |
| `8.*` | Custom `outputFileMaskFunc` and `viewportScale` pass through correctly |

**Test data** (`./test-data/`):
- `pdf1.pdf` / `pdf11.pdf` — visually identical 2-page PDFs
- `pdf2.pdf` — 2-page PDF that differs from `pdf1.pdf` by ~14 058 pixels (at scale 2.0)
- `pdf3.pdf` — different page count from `pdf1.pdf`

**Diff outputs** during test runs go to `./test-results/compare/<test-id>/` (e.g., `5-1`, `5-2`). The `./test-results/` directory is gitignored and cleaned before each `npm test`.

**Coverage:** 100% statements, branches, functions, and lines across `comparePdf.ts`, `const.ts`, and both type files.

---

## Build & Publish

**Build:**
```sh
npm run build   # → tsc --pretty, output in ./out/
```
TypeScript compiles `src/**/*` to `./out/`. Declaration files (`.d.ts`) are generated alongside each `.js` file. Source maps are not emitted.

**What is published to npm (`"files": ["./out"]`):**
```
out/
├── index.js / index.d.ts
├── comparePdf.js / comparePdf.d.ts
├── const.js / const.d.ts
└── types/
    ├── ComparePdfOptions.js / ComparePdfOptions.d.ts
    └── ExcludedPageArea.js / ExcludedPageArea.d.ts
```
Total published size: ~11 KB. Source files, tests, and config are excluded.

**Package entry points:**
- `"main": "./out/index.js"` — legacy CJS entry
- `"types": "./out/index.d.ts"` — TypeScript declarations
- `"exports"."."` — explicit exports map for bundlers and modern Node.js

**Publish workflow** (`.github/workflows/publish.yml`): triggered on GitHub release creation → `npm ci` → `npm test` → `npm publish` with `NODE_AUTH_TOKEN` from repository secrets.

---

## CI / CD

### test.yml — runs on every push (except `release/*` branches)

| Job | OS | Node |
|-----|----|------|
| `ubuntu` | ubuntu-latest | 24.x |
| `windows` | windows-latest | 22.x |

Both jobs: `npm ci` → `npm test`.

### publish.yml — runs on GitHub release creation

`ubuntu-latest`, Node 22.x: `npm ci` → `npm test` → `npm publish`.

---

## Code Style

**Prettier** (`.prettierrc`):
- `tabWidth: 4`, `useTabs: false`
- `singleQuote: true`, `semi: true`
- `trailingComma: "all"`, `printWidth: 120`
- `arrowParens: "always"`
- JSON files also use `tabWidth: 4`

**ESLint** (`eslint.config.mjs`):
- Extends `typescript-eslint` recommended rules
- `@typescript-eslint/no-explicit-any`: disabled — used in `validateInputFileType` for runtime duck-typing
- `@typescript-eslint/no-require-imports`: disabled
- Ignores: `coverage/`, `out/`, `node_modules/`

---

## TypeScript Configuration

```json
{
  "module": "nodenext",
  "moduleResolution": "node16",
  "target": "es2022",
  "lib": ["es2024", "ESNext.Array", "ESNext.Collection", "ESNext.Iterator"],
  "strict": true,
  "declaration": true,
  "outDir": "./out",
  "esModuleInterop": true,
  "skipLibCheck": true
}
```

- `module: nodenext` + `moduleResolution: node16` enforces explicit `.js` extensions in imports and aligns with Node.js native ESM resolution, even though the package compiles to CommonJS (no `"type": "module"` in `package.json`).
- `strict: true` enables all strictness flags (noImplicitAny, strictNullChecks, etc.).

---

## Adding New Features or Tests

1. **New option** → add field to `src/types/ComparePdfOptions.ts` (with JSDoc), use it in `src/comparePdf.ts`, document in README.
2. **New test** → create `__tests__/<next-number>.<descriptive-name>.test.ts`; use test data from `./test-data/` and write diffs to `./test-results/compare/<test-id>/`.
3. **Always** run `npm test` before committing — it enforces lint, license compliance, and full coverage.
