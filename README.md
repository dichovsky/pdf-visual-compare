# pdf-visual-compare

Visual regression testing library for PDFs in Js/Ts without binary and OS dependencies.

[![Tests on push](https://github.com/dichovsky/pdf-visual-compare/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/dichovsky/pdf-visual-compare/actions/workflows/test.yml)

## Getting started

Installation:

```sh
npm install -D pdf-visual-compare
```

## Example

```javascript
  const result: boolean = await comparePdf('./pdf1.pdf', './pdf2.pdf');

  // If you want to configure comparing process, use the following props

  const result: boolean = await comparePdf('./pdf1.pdf', './pdf2.pdf', {
  diffsOutputFolder?: string; // Folder to write output PNG files with differences
  pdfToPngConvertOptions?: {
    viewportScale: 2.0, // The desired scale of PNG viewport. Default value is 2.0.
    disableFontFace: false, //When `false`, fonts will be rendered using a built-in font renderer that constructs the glyphs with primitive path commands. Default value is true.
    useSystemFonts: false, // When `true`, fonts that aren't embedded in the PDF document will fallback to a system font. Default value is false.
    pdfFilePassword: 'pa$$word', // Password for encrypted PDF.
    outputFolder: 'output/folder', // Folder to write output PNG files. If not specified, PNG output will be available only as a Buffer content, without saving to a file.
    outputFileMask: 'buffer', // Output filename mask. Default value is 'buffer'.
    pagesToProcess: [1, 3, 11],   // Subset of pages to convert (first page = 1), other pages will be skipped if specified.
    strictPagesToProcess: false // When `true`, will throw an error if specified page number in pagesToProcess is invalid, otherwise will skip invalid page. Default value is false.
    verbosityLevel: 0 // Verbosity level. ERRORS: 0, WARNINGS: 1, INFOS: 5. Default value is 0.
  };
  excludedAreas?: ExcludedPageArea[]; // Areas list to exclude from comparing for each PDF page. Empty array by default.
  compareThreshold?: number; // Comparing threshold, ranges from 0 to 1. Smaller values make the comparison more sensitive. 0.1 by default.
});

```

## Buy Me A Coffee

In case you want support my work

[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://buymeacoffee.com/dichovsky)
