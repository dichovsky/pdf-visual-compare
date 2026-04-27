# pdf-visual-compare

<p align="center">
  <strong>Visual regression testing library for PDFs in JavaScript/TypeScript without external system package dependencies</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/pdf-visual-compare">
    <img src="https://img.shields.io/npm/v/pdf-visual-compare.svg?style=flat-square" alt="npm version">
  </a>
  <a href="https://www.npmjs.com/package/pdf-visual-compare">
    <img src="https://img.shields.io/npm/dm/pdf-visual-compare.svg?style=flat-square" alt="npm downloads">
  </a>
  <a href="https://github.com/dichovsky/pdf-visual-compare/actions/workflows/test.yml">
    <img src="https://github.com/dichovsky/pdf-visual-compare/actions/workflows/test.yml/badge.svg?branch=main" alt="Tests">
  </a>
  <a href="https://github.com/dichovsky/pdf-visual-compare/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/dichovsky/pdf-visual-compare?style=flat-square" alt="License">
  </a>
</p>

---

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Usage](#usage)
    - [Basic comparison](#basic-comparison)
    - [Detailed comparison results](#detailed-comparison-results)
    - [Comparison with options](#comparison-with-options)
    - [Comparing PDF buffers](#comparing-pdf-buffers)
- [API](#api)
    - [comparePdf](#comparepdfactualpdf-expectedpdf-options)
    - [comparePdfDetailed](#comparepdfdetailedactualpdf-expectedpdf-options)
    - [ComparePdfOptions](#comparepdfoptions)
    - [ComparePdfDetailedResult](#comparepdfdetailedresult)
    - [ComparePdfPageResult](#comparepdfpageresult)
    - [ComparePdfPageStatus](#comparepdfpagestatus)
    - [PdfRenderOptions](#pdfrenderoptions)
    - [PageExclusion](#pageexclusion)
    - [PageArea](#pagearea)
    - [RgbColor](#rgbcolor)
- [Support](#support)

---

## Requirements

- Node.js >= 24
- Supported and CI-validated runtimes: Linux and macOS
- Windows is not supported

## Docker

The Docker image is for local/containerized test execution only. It builds a slim test runner that
installs just the dependencies needed to execute Vitest against the checked-in source and fixtures.

---

## Installation

```sh
npm install -D pdf-visual-compare
```

`pdf-visual-compare` now depends on `pdf-to-png-converter` 4.x, which ships prebuilt native canvas
bindings through `@napi-rs/canvas`. No external system packages are required, but consumers must use
Node 24 or newer.

## Validation

```sh
npm run test:types      # Compile a consumer-style TypeScript fixture against the built package types
npm run test:artifacts  # Verify the built package entry points and npm pack contents
npm test                # Full pipeline: clean → lint → license check → build → type/artifact checks → vitest --coverage
```

`npm run test:types` and `npm run test:artifacts` validate the built/published package surface, so
they expect `./out/` to be up to date. `npm test` handles that automatically.

## Repository merge policy

For pull requests targeting `main`, the required GitHub status checks are:

- `test (ubuntu-24.04)`
- `test (macos-15)`

Those check names come from the matrix jobs in the `CI` workflow (`.github/workflows/test.yml`).
See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the contributor workflow and merge expectations.

---

## Usage

### Basic comparison

```typescript
import { comparePdf } from 'pdf-visual-compare';

const isEqual = await comparePdf('./actual.pdf', './expected.pdf');
// true  → PDFs are visually identical
// false → PDFs differ
```

### Detailed comparison results

```typescript
import { comparePdfDetailed } from 'pdf-visual-compare';

const result = await comparePdfDetailed('./actual.pdf', './expected.pdf', {
    compareThreshold: 25,
});

console.log(result.isEqual);
console.log(result.actualPageCount, result.expectedPageCount);
console.log(result.pages[0]);
```

### Comparison with options

```typescript
import type { ComparePdfOptions } from 'pdf-visual-compare';
import { comparePdf } from 'pdf-visual-compare';

const options: ComparePdfOptions = {
    // Enable diff PNG output explicitly. Default: false
    writeDiffs: true,

    // Trusted root folder for diff PNG images written when differences are found.
    // Generated diff paths and per-page diffFilePath overrides must stay inside this folder.
    // If the path already exists, it must be a directory.
    // Default: ./comparePdfOutput
    diffsOutputFolder: 'test-results/diffs',

    // Optional trust boundary for string PDF paths. When set, both actualPdf and expectedPdf
    // must resolve inside this directory or comparePdf throws ComparePdfConfigurationError.
    allowedInputRoot: '.',

    // Maximum number of differing pixels allowed before the comparison fails.
    // 0 = pixel-perfect match required (default). Must be a finite non-negative integer.
    compareThreshold: 200,

    // Per-page exclusion zones, matched by the `pageNumber` field (1-based).
    // `pageNumber: 1` → first page, `pageNumber: 2` → second page, etc.
    // Pixel coordinates are relative to the rendered PNG at the configured viewportScale.
    excludedAreas: [
        {
            pageNumber: 1,
            excludedAreas: [{ x1: 700, y1: 375, x2: 790, y2: 400 }],
        },
        {
            pageNumber: 2,
            excludedAreas: [{ x1: 680, y1: 240, x2: 955, y2: 465 }],
        },
    ],

    pdfToPngConvertOptions: {
        viewportScale: 2.0,
        disableFontFace: true,
        useSystemFonts: false,
        enableXfa: false,
        pdfFilePassword: 'pa$$word',
        // Renderer intermediate files are written under output/pngs/actual and output/pngs/expected.
        outputFolder: 'output/pngs',
        outputFileMaskFunc: (pageNumber) => `page_${pageNumber}.png`,
        pagesToProcess: [1, 3],
        verbosityLevel: 0,
    },
};

const isEqual = await comparePdf('./actual.pdf', './expected.pdf', options);
```

### Comparing PDF binary inputs

`comparePdf` accepts file paths plus these binary inputs: `Buffer`, `ArrayBuffer`, and
`SharedArrayBuffer`. `SharedArrayBuffer` inputs are normalized internally before rendering.

String paths are intended for trusted local usage by default. If you need to accept caller-provided
path strings, set `allowedInputRoot` to constrain them to a specific workspace, or prefer binary
inputs instead.

Diff PNGs are written only when `writeDiffs: true`. When enabled, treat `diffsOutputFolder` as a
trusted write root and keep any `diffFilePath` overrides inside that directory. This boundary
assumes a trusted local filesystem while the comparison is running.

```typescript
import { readFileSync } from 'node:fs';
import { comparePdf } from 'pdf-visual-compare';

const actual = readFileSync('./actual.pdf');
const expected = readFileSync('./expected.pdf');

const isEqual = await comparePdf(actual, expected);
```

```typescript
import { readFileSync } from 'node:fs';
import { comparePdf, type PdfInput } from 'pdf-visual-compare';

const actualBuffer = readFileSync('./actual.pdf');
const expectedBuffer = readFileSync('./expected.pdf');

const actual: PdfInput = actualBuffer.buffer.slice(
    actualBuffer.byteOffset,
    actualBuffer.byteOffset + actualBuffer.byteLength,
);
const expected: PdfInput = expectedBuffer.buffer.slice(
    expectedBuffer.byteOffset,
    expectedBuffer.byteOffset + expectedBuffer.byteLength,
);

const isEqual = await comparePdf(actual, expected);
```

---

## API

### `comparePdf(actualPdf, expectedPdf, options?)`

| Parameter     | Type                             | Description                                        |
| ------------- | -------------------------------- | -------------------------------------------------- |
| `actualPdf`   | `PdfInput`                       | File path or supported binary PDF input under test |
| `expectedPdf` | `PdfInput`                       | File path or supported binary reference PDF        |
| `options`     | `ComparePdfOptions` _(optional)_ | Comparison configuration                           |

Returns `Promise<boolean>` — a backwards-compatible convenience wrapper over
`comparePdfDetailed()` that resolves to `result.isEqual`.

Rendered pages are paired by the renderer-reported `pageNumber` (1-based), not by generated PNG
file names or by the position of entries inside `excludedAreas`. If one side is missing a rendered
counterpart for a page number in the comparison plan, the comparison returns `false`.

The library discovers the page plan first, then renders and compares one page at a time to keep
memory bounded on multi-page PDFs. `png-visual-compare` 6.x now exposes additional async/ported
comparison entry points, but this library still uses sequential `comparePng()` calls until a
benchmark and dependency-level safety review justify parallel execution.

String inputs are trusted caller-controlled file paths unless `options.allowedInputRoot` is set. If
`allowedInputRoot` is configured, both string inputs must resolve within that directory. After
boundary validation, string inputs are opened and read immediately so rendering operates on bytes
instead of reopening caller paths later.

When `options.writeDiffs` is `true`, diff outputs are written under `options.diffsOutputFolder`,
which acts as a trusted write root. Auto-generated diff paths and any
`excludedAreas[].diffFilePath` overrides must resolve within that directory. This boundary assumes a
trusted local filesystem while the comparison is running. If `diffsOutputFolder` is provided, it is
still validated even when `writeDiffs` is `false`.

**Throws:**

- `ComparePdfInputError: PDF file not found: <path>` — when a string argument points to a non-existent file.
- `ComparePdfInputError: PDF path is not a file: <path>` — when a string argument points to an existing directory or other non-file path.
- `ComparePdfInputError: Failed to read PDF file: <path>` — when a string argument exists but the library cannot open or read it. The original filesystem exception is attached as `cause`.
- `ComparePdfInputError: Unknown input file type.` — when an argument is not a `string`, `Buffer`, `ArrayBuffer`, or `SharedArrayBuffer`.
- `ComparePdfConfigurationError: Options must be an object.` — when an untyped caller passes a non-object third argument.
- `ComparePdfConfigurationError: diffsOutputFolder must be a non-empty string.` — when an untyped caller passes a non-string or blank diff root.
- `ComparePdfConfigurationError: diffsOutputFolder must point to a directory when it already exists: <path>` — when the configured diff root already exists as a file.
- `ComparePdfConfigurationError: allowedInputRoot must be a non-empty string.` — when an untyped caller passes a non-string or blank path boundary.
- `ComparePdfConfigurationError: allowedInputRoot does not exist: <path>` — when `allowedInputRoot` points to a missing path.
- `ComparePdfConfigurationError: allowedInputRoot must point to an existing directory: <path>` — when `allowedInputRoot` points to a file instead of a directory.
- `ComparePdfConfigurationError: actualPdf must resolve within allowedInputRoot: <path>` / `expectedPdf must resolve within allowedInputRoot: <path>` — when a string PDF input escapes the configured root.
- `ComparePdfConfigurationError: excludedAreas must be an array.` — when an untyped caller passes a non-array `excludedAreas` value.
- `ComparePdfConfigurationError: Each excludedAreas entry must be an object.` — when an untyped caller passes a non-object item inside `excludedAreas`.
- `ComparePdfConfigurationError: Diff output path must stay within diffsOutputFolder: <path>` — when an auto-generated diff path or `excludedAreas[].diffFilePath` override escapes the configured diff root.
- `ComparePdfConfigurationError: Compare Threshold must be a finite non-negative integer.` — when `options.compareThreshold` is negative, fractional, `NaN`, or infinite.
- `ComparePdfConfigurationError: Matching Threshold must be a finite non-negative integer.` — when `excludedAreas[].matchingThreshold` is negative, fractional, `NaN`, or infinite.
- `ComparePdfConfigurationError: Page Number must be a finite positive integer.` — when `excludedAreas[].pageNumber` is `<= 0`, fractional, `NaN`, or infinite.
- `ComparePdfConfigurationError: pdfToPngConvertOptions must be an object.` — when an untyped caller passes a non-object render configuration.
- `ComparePdfConfigurationError: Unsupported pdfToPngConvertOptions properties: ...` — when an untyped caller passes render settings that would skip page content or enable parallel rendering.
- `ComparePdfRenderingError: Failed to render actual PDF pages.` / `Failed to render expected PDF pages.` — when the PDF renderer dependency fails. The original dependency exception is attached as `cause`.
- `ComparePdfRenderingError: Rendered page content is missing for page: <page-name>.` — when the renderer returns a page without binary PNG content.
- `ComparePdfComparisonError: Failed to compare rendered PDF page <page-number>.` — when the PNG comparator dependency fails. The original dependency exception is attached as `cause`.

### `comparePdfDetailed(actualPdf, expectedPdf, options?)`

Accepts the same parameters as `comparePdf()` and returns
`Promise<ComparePdfDetailedResult>`.

Use this API when you need page-level mismatch counts, applied thresholds, diff output paths, or
deterministic missing-page information without inspecting the filesystem.

### `PdfInput`

```typescript
type PdfInput = string | Buffer | ArrayBufferLike;
```

`string` values are trusted local file paths by default. They are opened and read before rendering.
For untrusted environments, prefer binary inputs or set `ComparePdfOptions.allowedInputRoot`.

### `ComparePdfOptions`

| Property                 | Type               | Default              | Description                                                                                 |
| ------------------------ | ------------------ | -------------------- | ------------------------------------------------------------------------------------------- |
| `writeDiffs`             | `boolean`          | `false`              | Enables diff PNG output on disk                                                             |
| `diffsOutputFolder`      | `string`           | `./comparePdfOutput` | Trusted diff-output root; validated when provided, and used for written diff PNGs only when `writeDiffs` is `true` |
| `allowedInputRoot`       | `string`           | `undefined`          | Optional root directory that constrains string PDF inputs; when omitted, string paths are trusted caller-controlled inputs |
| `compareThreshold`       | `number`           | `0`                  | Maximum number of differing pixels allowed before comparison fails; must be a finite non-negative integer |
| `excludedAreas`          | `PageExclusion[]`  | `[]`                 | Per-page exclusion zones matched by rendered `pageNumber` (1-based); non-rendered pages are ignored and the first duplicate entry for a page wins |
| `pdfToPngConvertOptions` | `PdfRenderOptions` | see below            | Options for rendering PDF pages before comparison                                           |

### `ComparePdfDetailedResult`

| Property            | Type                     | Description                                                  |
| ------------------- | ------------------------ | ------------------------------------------------------------ |
| `isEqual`           | `boolean`                | `true` when every planned page comparison is within threshold |
| `actualPageCount`   | `number`                 | Number of rendered pages produced from the actual PDF        |
| `expectedPageCount` | `number`                 | Number of rendered pages produced from the expected PDF      |
| `compareThreshold`  | `number`                 | Document-level threshold supplied to the comparison          |
| `writeDiffs`        | `boolean`                | `true` when diff PNG writing was enabled for the comparison  |
| `diffsOutputFolder` | `string \| null`         | Resolved base diff output folder, or `null` when disabled    |
| `pages`             | `ComparePdfPageResult[]` | Page-level outcomes sorted by `pageNumber`                  |

### `ComparePdfPageResult`

| Property           | Type                   | Description                                                         |
| ------------------ | ---------------------- | ------------------------------------------------------------------- |
| `pageNumber`       | `number`               | 1-based rendered page number                                        |
| `status`           | `ComparePdfPageStatus` | `matched`, `mismatched`, `missing-actual`, or `missing-expected`    |
| `isEqual`          | `boolean`              | `true` when this page is within its applicable threshold            |
| `threshold`        | `number`               | Threshold actually applied to this page                             |
| `mismatchCount`    | `number \| null`       | Comparator mismatch count, or `null` when the page was not compared |
| `diffFilePath`     | `string \| null`       | Diff PNG output path, or `null` when the page was not compared      |
| `actualPageName`   | `string \| null`       | Renderer-reported actual page image name                            |
| `expectedPageName` | `string \| null`       | Renderer-reported expected page image name                          |

### `ComparePdfPageStatus`

```typescript
type ComparePdfPageStatus = 'matched' | 'mismatched' | 'missing-actual' | 'missing-expected';
```

### `PdfRenderOptions`

`PdfRenderOptions` is this library's stable rendering contract. It is adapted internally to the
current PDF renderer and is not a direct re-export of an upstream dependency type.

| Property             | Type                             | Description                                  |
| -------------------- | -------------------------------- | -------------------------------------------- |
| `viewportScale`      | `number`                         | Scale factor applied before rendering        |
| `disableFontFace`    | `boolean`                        | Use built-in fonts instead of embedded fonts |
| `useSystemFonts`     | `boolean`                        | Allow system font fallbacks                  |
| `enableXfa`          | `boolean`                        | Render XFA form data                         |
| `pdfFilePassword`    | `string`                         | Password for encrypted PDFs                  |
| `outputFolder`       | `string`                         | Folder for intermediate PNG files; this library writes under `actual/` and `expected/` subfolders to avoid collisions |
| `outputFileMaskFunc` | `(pageNumber: number) => string` | Custom PNG filename generator                |
| `pagesToProcess`     | `number[]`                       | 1-based pages to render                      |
| `verbosityLevel`     | `number`                         | Renderer verbosity level                     |

`comparePdf()` always renders page content and always calls the renderer sequentially. The following
upstream renderer flags are intentionally excluded from `PdfRenderOptions` and are rejected at runtime
for untyped JavaScript callers: `returnPageContent`, `returnMetadataOnly`, `processPagesInParallel`,
and `concurrencyLimit`.

`pdfToPngConvertOptions.outputFolder` controls renderer intermediate files independently from
`diffsOutputFolder`, which only constrains diff PNG output paths. When `outputFolder` is set, this
library writes the two compared PDFs into `actual/` and `expected/` subfolders beneath that root so
custom filename masks do not collide.

### `PageExclusion`

| Property            | Type         | Description                                                                                                      |
| ------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------- |
| `pageNumber`        | `number`     | 1-based page number this exclusion applies to (`1` = first page, `2` = second page, etc.); must be a finite positive integer |
| `excludedAreas`     | `PageArea[]` | Rectangles to exclude from comparison                                                                            |
| `excludedAreaColor` | `RgbColor`   | Fill colour applied to `excludedAreas` before comparison. When omitted, `png-visual-compare` uses its default blue `{ r: 0, g: 0, b: 255 }` |
| `diffFilePath`      | `string`     | Override the diff image output path for this page; the resolved path must stay inside `diffsOutputFolder`       |
| `matchingThreshold` | `number`     | Per-page pixel threshold, overrides the document-level `compareThreshold` for this page; must be a finite non-negative integer |

`ExcludedPageArea` remains exported as a backwards-compatible alias of `PageExclusion`.

Entries whose `pageNumber` does not correspond to a rendered page are ignored. If multiple entries
target the same `pageNumber`, only the first matching entry is used.

### `PageArea`

`PageArea` is a rectangle on a rendered PDF page:

```typescript
{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}
```

### `RgbColor`

`RgbColor` is an RGB colour object used in diff-related configuration:

```typescript
{
    r: number;
    g: number;
    b: number;
}
```

---

## Support

If you want to support my work, you can buy me a coffee.

[![Buy Me A Coffee](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://buymeacoffee.com/dichovsky)
