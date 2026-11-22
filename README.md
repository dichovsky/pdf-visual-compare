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
    - [Comparing PDF binary inputs](#comparing-pdf-binary-inputs)
- [CLI](#cli)
- [API](#api)
    - [comparePdf](#comparepdfactualpdf-expectedpdf-options)
    - [comparePdfDetailed](#comparepdfdetailedactualpdf-expectedpdf-options)
    - [ComparePdfOptions](#comparepdfoptions)
    - [ComparePdfDetailedResult](#comparepdfdetailedresult)
    - [ComparePdfPageResult](#comparepdfpageresult)
    - [ComparePdfPageStatus](#comparepdfpagestatus)
    - [ComparePdfSummary](#comparepdfsummary)
    - [toJsonReport / toJUnitReport](#tojsonreport--tojunitreport)
    - [PdfRenderOptions](#pdfrenderoptions)
    - [PageExclusion](#pageexclusion)
    - [PageArea](#pagearea)
    - [RgbColor](#rgbcolor)
- [Support](#support)

---

## Requirements

- Node.js >= 24
- Supported runtimes: Linux and macOS. The CI job runs only on Linux. macOS is supported, but no CI job runs on macOS.
- Windows is not supported.

## Docker

Use the Docker image only to run tests locally or in a container. The image is a small test runner.
It installs only the dependencies that are necessary to run Vitest on the source and fixtures in the
repository.

---

## Installation

```sh
npm install -D pdf-visual-compare
```

`pdf-visual-compare` uses `pdf-to-png-converter` 4.x. This dependency includes prebuilt native canvas
bindings from `@napi-rs/canvas`. Thus, external system packages are not necessary. Callers must use
Node.js 24 or later.

## Validation

```sh
npm run test:types      # Type-check all repository TypeScript, including the published-surface fixture
npm run test:artifacts  # Verify the built package entry points and npm pack contents
npm test                # Full pipeline: clean → lint → license check → build → type/artifact checks → vitest --coverage
```

`npm run test:types` includes the published-surface fixture in `__tests__/published-artifacts/`.
Thus, `./out/` must be up to date before you run it. `npm test` updates `./out/` automatically.

## Repository merge policy

Pull requests to `main` must pass this required GitHub status check:

- `test`

This check name is the name of the job in the `CI` workflow (`.github/workflows/test.yml`).
For the contributor workflow and the merge expectations, refer to [`CONTRIBUTING.md`](./CONTRIBUTING.md).

---

## Usage

### Basic comparison

```typescript
import { comparePdf } from 'pdf-visual-compare';

const isEqual = await comparePdf('./actual.pdf', './expected.pdf');
// true  → the two PDFs are equal
// false → the two PDFs are not equal
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
    // Write diff images to disk. Default: false
    writeDiffs: true,

    // Trusted diff output folder. The comparison writes diff images to this folder.
    // Generated diff paths and per-page diffFilePath values must stay in this folder.
    // If the path exists, it must be a folder.
    // Default: ./comparePdfOutput
    diffsOutputFolder: 'test-results/diffs',

    // Optional input root for string PDF paths. When set, actualPdf and expectedPdf
    // must resolve to a path in this folder. If not, comparePdf throws ComparePdfConfigurationError.
    allowedInputRoot: '.',

    // Pixel threshold: the maximum number of different pixels on an equal page.
    // 0 = a pixel-perfect match is necessary (default). Must be a finite non-negative integer.
    compareThreshold: 200,

    // Optional percentage threshold (0–100). The comparison uses it TOGETHER WITH compareThreshold.
    // A page is equal when it is in EITHER threshold. Thus, a percentage makes the pixel default less strict.
    compareThresholdPercent: 1.5,

    // Optional page selection: a range or a number[].
    // If the selection contains no rendered page of the two PDFs, the comparison throws an error.
    pages: '1-3,5,7',

    // Page exclusions. Each entry applies to the page with the same `pageNumber` (1-based).
    // `pageNumber: 1` → first page, `pageNumber: 2` → second page, and so on.
    // Pixel coordinates are on the rendered PNG at the viewportScale that you set.
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
        // The renderer writes rendered pages to output/pngs/actual and output/pngs/expected.
        outputFolder: 'output/pngs',
        outputFileMaskFunc: (pageNumber) => `page_${pageNumber}.png`,
        pagesToProcess: [1, 3],
        verbosityLevel: 0,
    },
};

const isEqual = await comparePdf('./actual.pdf', './expected.pdf', options);
```

### Comparing PDF binary inputs

`comparePdf` accepts file paths and these binary inputs: `Buffer`, `ArrayBuffer`, and
`SharedArrayBuffer`. Before the renderer starts, the library normalizes `SharedArrayBuffer` inputs.

By default, string paths are only for trusted local files. If you must accept path strings from callers,
we recommend that you use one of these methods:

- Set `allowedInputRoot` to keep the paths in a specified folder.
- Use binary inputs.

The library writes diff images only when `writeDiffs: true`. When you enable `writeDiffs`, use a
trusted folder for `diffsOutputFolder`. Keep all `diffFilePath` values in that folder. The diff output folder
boundary is valid only on a trusted local file system during the comparison.

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

## CLI

Use the command-line interface (CLI) to compare two PDFs in a terminal. You do not need a test file.

```sh
npx pdf-visual-compare actual.pdf expected.pdf
```

```text
Usage: pdf-visual-compare <actual.pdf> <expected.pdf> [options]

Options:
  -t, --threshold <n>          Max differing pixels allowed per page (default 0)
      --threshold-percent <n>  Max differing pixels as a percent (0-100); a page passes
                               when within EITHER the pixel OR the percent threshold
  -p, --pages <spec>           Compare only these pages, e.g. "1-3,5,7"
  -f, --format <type>          Output format: text | json | junit (default text)
  -o, --out <dir>              Write diff PNGs into <dir>
      --fail-on-diff           Exit with code 1 when differences are found
  -h, --help                   Show this help
  -v, --version                Print the version
      --                       Treat all following arguments as file paths
```

**Exit codes:** `0` success, `1` differences found (only with `--fail-on-diff`), `2` usage or runtime error.

CI example: this command makes the job fail when a page is not equal. It also writes a JUnit report.

```sh
npx pdf-visual-compare actual.pdf expected.pdf --fail-on-diff --format junit > pdf-report.xml
```

The CLI is a thin wrapper around `comparePdfDetailed()`. Each flag sets a `ComparePdfOptions` property:

- `--threshold` sets `compareThreshold`.
- `--threshold-percent` sets `compareThresholdPercent`.
- `--pages` sets `pages`.
- `--out` sets `writeDiffs` and `diffsOutputFolder`.

---

## API

### `comparePdf(actualPdf, expectedPdf, options?)`

| Parameter     | Type                             | Description                                   |
| ------------- | -------------------------------- | --------------------------------------------- |
| `actualPdf`   | `PdfInput`                       | File path or binary input of the actual PDF   |
| `expectedPdf` | `PdfInput`                       | File path or binary input of the expected PDF |
| `options`     | `ComparePdfOptions` _(optional)_ | Comparison options                            |

Returns `Promise<boolean>`. This function is a backward-compatible wrapper around
`comparePdfDetailed()`. The promise resolves to `result.isEqual`.

The library pairs rendered pages by the `pageNumber` (1-based) that the renderer gives. It does not
use the generated PNG file names or the position of the entries in `excludedAreas`. If a page number
in the comparison plan has no rendered counterpart in one PDF, the comparison returns `false`.

The library makes the comparison plan first. Then it renders and compares one page at a time, to
limit the memory usage for PDFs with many pages. `png-visual-compare` 6.x has more asynchronous
comparison entry points. This library calls `comparePng()` sequentially. The library will not compare pages in parallel until a
benchmark and a safety review of the dependency support the change.

String inputs are trusted file paths that the caller controls, unless you set
`options.allowedInputRoot`. When you set `allowedInputRoot`, the two string inputs must resolve to
paths in that folder. After the library validates the boundary, it opens and reads the string inputs
immediately. Thus, the renderer uses the bytes and does not open the caller paths again.

When `options.writeDiffs` is `true`, the library writes diff images to `options.diffsOutputFolder`.
This folder is a trusted diff output folder. Generated diff paths and all `excludedAreas[].diffFilePath`
values must resolve to paths in that folder. The diff output folder boundary is valid only on a trusted local file
system during the comparison. If you set `diffsOutputFolder`, the library validates it, also
when `writeDiffs` is `false`.

**Throws:**

- `ComparePdfInputError: PDF file not found: <path>` — when a string argument points to a file that does not exist.
- `ComparePdfInputError: PDF path is not a file: <path>` — when a string argument points to a folder or to a different path that is not a file.
- `ComparePdfInputError: Failed to read PDF file: <path>` — when a string argument exists, but the library cannot open or read it. The `cause` property contains the original file system exception.
- `ComparePdfInputError: Unknown input file type.` — when an argument is not a `string`, `Buffer`, `ArrayBuffer`, or `SharedArrayBuffer`.
- `ComparePdfConfigurationError: Options must be an object.` — when an untyped caller gives a third argument that is not an object.
- `ComparePdfConfigurationError: diffsOutputFolder must be a non-empty string.` — when an untyped caller gives a diff output folder that is not a string or that is blank.
- `ComparePdfConfigurationError: diffsOutputFolder must point to a directory when it already exists: <path>` — when the diff output folder path exists as a file.
- `ComparePdfConfigurationError: allowedInputRoot must be a non-empty string.` — when an untyped caller gives an input root that is not a string or that is blank.
- `ComparePdfConfigurationError: allowedInputRoot does not exist: <path>` — when `allowedInputRoot` points to a path that does not exist.
- `ComparePdfConfigurationError: allowedInputRoot must point to an existing directory: <path>` — when `allowedInputRoot` points to a file, not to a folder.
- `ComparePdfConfigurationError: actualPdf must resolve within allowedInputRoot: <path>` / `expectedPdf must resolve within allowedInputRoot: <path>` — when a string PDF input resolves to a path outside the input root.
- `ComparePdfConfigurationError: excludedAreas must be an array.` — when an untyped caller gives an `excludedAreas` value that is not an array.
- `ComparePdfConfigurationError: Each excludedAreas entry must be an object.` — when an untyped caller gives an item in `excludedAreas` that is not an object.
- `ComparePdfConfigurationError: Diff output path must stay within diffsOutputFolder: <path>` — when a generated diff path or an `excludedAreas[].diffFilePath` value resolves to a path outside the diff output folder.
- `ComparePdfConfigurationError: Compare Threshold must be a finite non-negative integer.` — when `options.compareThreshold` is negative, fractional, `NaN`, or infinite.
- `ComparePdfConfigurationError: Matching Threshold must be a finite non-negative integer.` — when `excludedAreas[].matchingThreshold` is negative, fractional, `NaN`, or infinite.
- `ComparePdfConfigurationError: Page Number must be a finite positive integer.` — when `excludedAreas[].pageNumber` is `<= 0`, fractional, `NaN`, or infinite.
- `ComparePdfConfigurationError: Compare Threshold Percent must be a finite number between 0 and 100.` — when `options.compareThresholdPercent` is negative, more than 100, `NaN`, or infinite.
- `ComparePdfConfigurationError: Matching Threshold Percent must be a finite number between 0 and 100.` — when `excludedAreas[].matchingThresholdPercent` is negative, more than 100, `NaN`, or infinite.
- `ComparePdfConfigurationError: pages selection matched no rendered page in either PDF.` — when `options.pages` selects only page numbers that are not in the actual PDF and not in the expected PDF.
- `ComparePdfConfigurationError: pages ...` — when `options.pages` is not correct for a different reason. Examples: an empty selection, a descending range, a page number that is not a positive safe integer, or too many selected pages.
- `ComparePdfConfigurationError: pdfToPngConvertOptions must be an object.` — when an untyped caller gives render options that are not an object.
- `ComparePdfConfigurationError: Unsupported pdfToPngConvertOptions properties: ...` — when an untyped caller gives render options that skip page content or enable parallel rendering.
- `ComparePdfConfigurationError: pdfToPngConvertOptions.outputFolder must be a non-empty string.` — when an untyped caller gives a render output folder that is not a string or that is blank.
- `ComparePdfConfigurationError: pdfToPngConvertOptions.outputFolder must point to a directory when it already exists: <path>` — when the render output folder path exists as a file.
- `ComparePdfConfigurationError: pdfToPngConvertOptions.outputFolder must not traverse a symbolic link: <path>` — when the render output folder or any existing folder above it in the path is a symbolic link. The library also throws this error after `mkdir`, when it finds a symbolic link at the resolved folder. A symbolic link at a pre-created `actual/` or `expected/` subfolder also causes this error. The library examines the path and the existing folders above it with the same rules as `diffsOutputFolder`.
- `ComparePdfConfigurationError: pdfToPngConvertOptions.outputFolder must point to a writable directory: <path>` — when the library cannot make the resolved render output folder or its `actual/` and `expected/` subfolders. For example, a file can be at the path of the folder.
- `ComparePdfRenderingError: Failed to render actual PDF pages.` / `Failed to render expected PDF pages.` — when the PDF renderer dependency fails. The `cause` property contains the original dependency exception.
- `ComparePdfRenderingError: Rendered page content is missing for page: <page-name>.` — when the renderer returns a page without binary PNG content.
- `ComparePdfComparisonError: Failed to compare rendered PDF page <page-number>.` — when the PNG comparator dependency fails. The `cause` property contains the original dependency exception.

### `comparePdfDetailed(actualPdf, expectedPdf, options?)`

This function accepts the same parameters as `comparePdf()`. It returns
`Promise<ComparePdfDetailedResult>`.

Use this function when you need these data and do not want to examine the file system:

- The mismatch count of each page
- The thresholds that the comparison applied
- The paths of the diff images
- The pages that have no counterpart, in a fixed order

### `PdfInput`

```typescript
type PdfInput = string | Buffer | ArrayBufferLike;
```

By default, `string` values are trusted local file paths. The library opens and reads them before the
renderer starts. In environments that are not trusted, we recommend that you use binary inputs or
set `ComparePdfOptions.allowedInputRoot`.

### `ComparePdfOptions`

| Property                  | Type                 | Default              | Description                                                                                                                                                          |
| ------------------------- | -------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `writeDiffs`              | `boolean`            | `false`              | Enables diff image writing to disk                                                                                                                                   |
| `diffsOutputFolder`       | `string`             | `./comparePdfOutput` | Trusted diff output folder. The library validates it when you set it. The library writes diff images to it only when `writeDiffs` is `true`                          |
| `allowedInputRoot`        | `string`             | `undefined`          | Optional input root. String PDF inputs must resolve to paths in this folder. When omitted, string paths are trusted inputs that the caller controls                  |
| `compareThreshold`        | `number`             | `0`                  | Pixel threshold: the maximum number of different pixels on an equal page. Must be a finite non-negative integer                                                      |
| `compareThresholdPercent` | `number`             | `undefined`          | Optional percentage threshold (0–100). The library uses it together with `compareThreshold`. A page is equal when it is in EITHER threshold                          |
| `pages`                   | `string \| number[]` | `undefined`          | Selects the pages to compare (for example, `"1-3,5,7"` or `[1, 2, 3]`). A selection that contains no rendered page causes an error                                   |
| `excludedAreas`           | `PageExclusion[]`    | `[]`                 | Page exclusions for each rendered `pageNumber` (1-based). The library ignores entries for pages that are not rendered. For a duplicate page, the first entry applies |
| `pdfToPngConvertOptions`  | `PdfRenderOptions`   | see below            | Options that the renderer uses before the comparison                                                                                                                 |

### `ComparePdfDetailedResult`

| Property                  | Type                     | Description                                                                      |
| ------------------------- | ------------------------ | -------------------------------------------------------------------------------- |
| `isEqual`                 | `boolean`                | `true` when every planned page comparison is in its threshold                    |
| `actualPageCount`         | `number`                 | Number of rendered pages from the actual PDF                                     |
| `expectedPageCount`       | `number`                 | Number of rendered pages from the expected PDF                                   |
| `compareThreshold`        | `number`                 | Document-level pixel threshold that the comparison used                          |
| `compareThresholdPercent` | `number \| null`         | Document-level percentage threshold that the caller gave, or `null` when not set |
| `writeDiffs`              | `boolean`                | `true` when diff image writing was enabled for the comparison                    |
| `diffsOutputFolder`       | `string \| null`         | Resolved diff output folder, or `null` when diff image writing is disabled       |
| `pages`                   | `ComparePdfPageResult[]` | Page results in the order of `pageNumber`                                        |
| `summary`                 | `ComparePdfSummary`      | Document-level summary of `pages`                                                |

### `ComparePdfPageResult`

| Property           | Type                   | Description                                                                                                           |
| ------------------ | ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `pageNumber`       | `number`               | 1-based rendered page number                                                                                          |
| `status`           | `ComparePdfPageStatus` | `matched`, `mismatched`, `missing-actual`, or `missing-expected`                                                      |
| `isEqual`          | `boolean`              | `true` when this page is in its applicable threshold                                                                  |
| `threshold`        | `number`               | Pixel threshold that the comparison applied to this page                                                              |
| `thresholdPercent` | `number \| null`       | Percentage threshold that the comparison applied to this page, or `null` when not set                                 |
| `mismatchCount`    | `number \| null`       | Mismatch count from the comparator, or `null` when the page was not compared                                          |
| `mismatchPercent`  | `number \| null`       | Mismatch percentage of the comparison canvas (larger width × larger height), or `null` when the page was not compared |
| `diffFilePath`     | `string \| null`       | Diff image path, or `null` when the page was not compared or when diff image writing is disabled                      |
| `actualPageName`   | `string \| null`       | Name of the actual rendered page, from the renderer                                                                   |
| `expectedPageName` | `string \| null`       | Name of the expected rendered page, from the renderer                                                                 |

### `ComparePdfPageStatus`

```typescript
type ComparePdfPageStatus = 'matched' | 'mismatched' | 'missing-actual' | 'missing-expected';
```

### `ComparePdfSummary`

`ComparePdfDetailedResult.summary` is a document-level summary. The library calculates it only from
the page results.

| Property             | Type     | Description                                                                        |
| -------------------- | -------- | ---------------------------------------------------------------------------------- |
| `totalPages`         | `number` | Number of planned page entries (the same as `pages.length`)                        |
| `matchedPages`       | `number` | Number of pages in their applicable threshold                                      |
| `mismatchedPages`    | `number` | Number of compared pages that are not in their applicable threshold (`mismatched`) |
| `missingPages`       | `number` | Number of pages without a counterpart (`missing-actual` or `missing-expected`)     |
| `maxMismatchPercent` | `number` | Largest `mismatchPercent` of a page. `0` when no page was compared                 |
| `totalMismatchCount` | `number` | Sum of `mismatchCount` for the compared pages                                      |

### `toJsonReport` / `toJUnitReport`

These functions serialize a `ComparePdfDetailedResult` for CI artifacts and tools. Both functions are
pure functions. The package entry point exports them.

```typescript
import { comparePdfDetailed, toJsonReport, toJUnitReport } from 'pdf-visual-compare';

const result = await comparePdfDetailed('./actual.pdf', './expected.pdf');

const json = toJsonReport(result); // formatted JSON. JSON.parse gives the same result object.
const junit = toJUnitReport(result); // JUnit XML: one <testcase> for each page, a <failure> for each page that is not equal
```

| Function                | Returns  | Description                                                        |
| ----------------------- | -------- | ------------------------------------------------------------------ |
| `toJsonReport(result)`  | `string` | Formatted JSON of the full detailed result                         |
| `toJUnitReport(result)` | `string` | JUnit XML report. Failures show mismatched pages and missing pages |

### `PdfRenderOptions`

`PdfRenderOptions` is the stable render contract of this library. The library adapts it internally to
the current PDF renderer. It is not a direct re-export of a type from a dependency.

| Property             | Type                             | Description                                                                                                                                                             |
| -------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `viewportScale`      | `number`                         | Scale factor that the renderer applies before it renders                                                                                                                |
| `disableFontFace`    | `boolean`                        | Use built-in fonts, not embedded fonts                                                                                                                                  |
| `useSystemFonts`     | `boolean`                        | Let the renderer use system fonts as fallbacks                                                                                                                          |
| `enableXfa`          | `boolean`                        | Render XFA form data                                                                                                                                                    |
| `pdfFilePassword`    | `string`                         | Password for encrypted PDFs                                                                                                                                             |
| `outputFolder`       | `string`                         | Render output folder. Must be a non-empty path that does not traverse a symbolic link. The library writes to `actual/` and `expected/` subfolders to prevent collisions |
| `outputFileMaskFunc` | `(pageNumber: number) => string` | Function that makes the PNG file names                                                                                                                                  |
| `pagesToProcess`     | `number[]`                       | 1-based pages to render                                                                                                                                                 |
| `verbosityLevel`     | `number`                         | Log level of the renderer                                                                                                                                               |

`comparePdf()` always renders the page content and always calls the renderer sequentially.
`PdfRenderOptions` does not include these renderer flags: `returnPageContent`, `returnMetadataOnly`,
`processPagesInParallel`, and `concurrencyLimit`. When an untyped JavaScript caller sets one of
these flags, the library throws an error.

`pdfToPngConvertOptions.outputFolder` sets the folder for the rendered pages. It is independent of
`diffsOutputFolder`, which applies only to diff image paths. When you set `outputFolder`, the library
writes the two PDFs to the `actual/` and `expected/` subfolders of that folder. Thus, custom file
name masks do not cause collisions.

The library validates the render output folder with the same rules as `diffsOutputFolder`:

- The value must be a non-empty string.
- If the path exists, it must be a folder.
- The path must not traverse a symbolic link at the leaf or at any existing folder above it in the path.

The library also makes the leaf folders itself. It makes the resolved folder and the `actual/` and
`expected/` subfolders. Then it makes sure again that each one is a real folder, not a symbolic link.
These steps occur before the first render call. The path check alone cannot close the time window
between the validation and the render (TOCTOU). These steps close that window. Thus, an attacker
cannot replace a future write destination with a symbolic link before the renderer writes its first
file (CWE-59 / CWE-61 / CWE-367).

### `PageExclusion`

| Property                   | Type         | Description                                                                                                                             |
| -------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `pageNumber`               | `number`     | 1-based page number for this page exclusion (`1` = first page, `2` = second page, and so on). Must be a finite positive integer         |
| `excludedAreas`            | `PageArea[]` | Excluded areas: rectangles that the comparison does not examine                                                                         |
| `excludedAreaColor`        | `RgbColor`   | Fill color for `excludedAreas` before the comparison. When omitted, `png-visual-compare` uses its default blue `{ r: 0, g: 0, b: 255 }` |
| `diffFilePath`             | `string`     | Diff image path for this page. The resolved path must stay in `diffsOutputFolder`                                                       |
| `matchingThreshold`        | `number`     | Pixel threshold for this page. Replaces the document-level `compareThreshold` for this page. Must be a finite non-negative integer      |
| `matchingThresholdPercent` | `number`     | Percentage threshold (0–100) for this page. Replaces the document-level `compareThresholdPercent` for this page                         |

`ExcludedPageArea` is also exported. It is a backward-compatible alias of `PageExclusion`.

The library ignores an entry when no rendered page has its `pageNumber`. If two or more entries have
the same `pageNumber`, the library uses only the first entry.

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

`RgbColor` is an RGB color object for the diff options:

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
