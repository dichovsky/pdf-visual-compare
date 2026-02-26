# pdf-visual-compare

Visual regression testing library for PDFs in JavaScript/TypeScript without binary and OS dependencies.

[![Tests on push](https://github.com/dichovsky/pdf-visual-compare/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/dichovsky/pdf-visual-compare/actions/workflows/test.yml)

## Requirements

- Node.js >= 20

## Installation

```sh
npm install -D pdf-visual-compare
```

## Usage

### Basic comparison

```typescript
import { comparePdf } from 'pdf-visual-compare';

const isEqual = await comparePdf('./actual.pdf', './expected.pdf');
// true  → PDFs are visually identical
// false → PDFs differ
```

### Comparison with options

```typescript
import { comparePdf } from 'pdf-visual-compare';

const isEqual = await comparePdf('./actual.pdf', './expected.pdf', {
  // Folder for diff PNG images written when differences are found. Default: ./comparePdfOutput
  diffsOutputFolder: 'test-results/diffs',

  // Maximum number of differing pixels allowed before the comparison fails.
  // 0 = pixel-perfect match required (default). Must be >= 0.
  compareThreshold: 200,

  // Per-page exclusion zones, matched by array index (0-based).
  // Index 0 → first page, index 1 → second page, etc.
  // Pixel coordinates are relative to the rendered PNG at the configured viewportScale.
  excludedAreas: [
    {
      pageNumber: 1,
      excludedAreas: [
        { x1: 700, y1: 375, x2: 790, y2: 400 }, // dynamic timestamp on page 1
      ],
    },
    {
      pageNumber: 2,
      excludedAreas: [
        { x1: 680, y1: 240, x2: 955, y2: 465 }, // chart on page 2
      ],
    },
  ],

  pdfToPngConvertOptions: {
    viewportScale: 2.0,          // Rendering scale — higher means more detail. Default: 2.0.
    disableFontFace: true,       // Use built-in font renderer. Default: true.
    useSystemFonts: false,       // Fall back to system fonts for non-embedded fonts. Default: false.
    enableXfa: false,            // Enable XFA form rendering. Default: false.
    pdfFilePassword: 'pa$$word', // Password for encrypted PDFs.
    outputFolder: 'output/pngs', // Save intermediate PNG files here. Omit to keep in memory only.
    outputFileMaskFunc: (pageNumber) => `page_${pageNumber}.png`, // Custom PNG filename.
    pagesToProcess: [1, 3],      // Limit comparison to specific pages (1-based). Default: all pages.
    verbosityLevel: 0,           // 0 = errors only, 1 = warnings, 5 = info. Default: 0.
  },
});
```

### Comparing PDF buffers

Both file paths and `Buffer` instances are accepted as inputs:

```typescript
import { readFileSync } from 'node:fs';
import { comparePdf } from 'pdf-visual-compare';

const actual = readFileSync('./actual.pdf');
const expected = readFileSync('./expected.pdf');

const isEqual = await comparePdf(actual, expected);
```

## API

### `comparePdf(actualPdf, expectedPdf, options?)`

| Parameter     | Type                              | Description                               |
| ------------- | --------------------------------- | ----------------------------------------- |
| `actualPdf`   | `string \| Buffer`                | File path or buffer of the PDF under test |
| `expectedPdf` | `string \| Buffer`                | File path or buffer of the reference PDF  |
| `options`     | `ComparePdfOptions` _(optional)_  | Comparison configuration                  |

Returns `Promise<boolean>` — `true` if the PDFs are visually equivalent within the configured threshold, `false` otherwise.

**Throws:**
- `Error: PDF file not found: <path>` — when a string argument points to a non-existent file.
- `Error: Unknown input file type.` — when an argument is neither a string nor a Buffer.
- `Error: Compare Threshold cannot be less than 0.` — when `options.compareThreshold < 0`.

### `ComparePdfOptions`

| Property                 | Type                  | Default              | Description                                                                 |
| ------------------------ | --------------------- | -------------------- | --------------------------------------------------------------------------- |
| `diffsOutputFolder`      | `string`              | `./comparePdfOutput` | Folder where diff PNG images are written                                    |
| `compareThreshold`       | `number`              | `0`                  | Maximum number of differing pixels allowed before comparison fails          |
| `excludedAreas`          | `ExcludedPageArea[]`  | `[]`                 | Per-page exclusion zones; array index corresponds to page index (0-based)   |
| `pdfToPngConvertOptions` | `PdfToPngOptions`     | see below            | Options forwarded to [`pdf-to-png-converter`](https://github.com/dichovsky/pdf-to-png-converter) |

### `ExcludedPageArea`

| Property            | Type     | Description                                                                                         |
| ------------------- | -------- | --------------------------------------------------------------------------------------------------- |
| `pageNumber`        | `number` | Informational page number (matching is performed by array index, not this value)                    |
| `excludedAreas`     | `Area[]` | Rectangles to exclude. `Area` = `{ x1, y1, x2, y2 }` in pixels at the configured `viewportScale`  |
| `excludedAreaColor` | `Color`  | Fill color for excluded regions in diff images. `Color` = `{ r, g, b }` with values 0–255          |
| `diffFilePath`      | `string` | Override the diff image output path for this page                                                   |
| `matchingThreshold` | `number` | Per-page pixel threshold, overrides the document-level `compareThreshold` for this page             |

## Support

If you want to support my work, you can buy me a coffee.

[![Buy Me A Coffee](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://buymeacoffee.com/dichovsky)

