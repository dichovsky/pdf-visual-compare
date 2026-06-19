# Changelog

All notable user-visible changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/).

> Historical release notes were not previously maintained in this repository. The entries below include only details that are supportable from the current repository state and git history.

## [Unreleased]

## [4.0.0] - 2026-06-19

First 4.x release — a major release with breaking changes to the supported Node.js runtime, supported platforms, and public type surface, alongside a substantially expanded API. All changes below are relative to the last published release, 3.5.0.

### Added

- `comparePdfDetailed(actualPdf, expectedPdf, opts?)` — returns a structured, page-level comparison result (`ComparePdfDetailedResult`) alongside the existing boolean-returning `comparePdf`.
- Error class hierarchy for programmatic handling: `ComparePdfError` (base) plus `ComparePdfInputError`, `ComparePdfConfigurationError`, `ComparePdfRenderingError`, and `ComparePdfComparisonError`.
- New exported result types: `ComparePdfDetailedResult`, `ComparePdfPageResult`, and `ComparePdfPageStatus`.
- New exported input/option types that decouple the public API from downstream dependencies: `PdfInput`, `PdfRenderOptions`, `PageExclusion`, `PageArea`, and `RgbColor`.
- `ComparePdfOptions.allowedInputRoot` — constrains string PDF input paths to a trusted directory root for untrusted callers.
- `ComparePdfOptions.writeDiffs` — explicit control over whether diff PNGs are written to disk.
- `os` package metadata field declaring `darwin` and `linux` as the supported platforms.

### Changed

- **BREAKING:** Minimum Node.js raised from `>=20` to `>=24` (aligns with `pdf-to-png-converter` 4.x).
- **BREAKING:** `ComparePdfOptions.pdfToPngConvertOptions` is now typed as the library-owned `PdfRenderOptions` instead of the downstream `PdfToPngOptions`. It is narrowed to comparison-safe render settings — runtime attempts to disable page content or enable parallel rendering are rejected.
- **BREAKING:** `excludedAreas` entries are now typed via `PageExclusion` (`ExcludedPageArea` remains exported), with area and color fields using the library-owned `PageArea` and `RgbColor` types instead of downstream types.
- `comparePdf` now accepts `Buffer` as an explicit input type in addition to `string` and `ArrayBufferLike`.
- Upgraded runtime dependencies: `pdf-to-png-converter` `3.18.x` → `~4.1.1` and `png-visual-compare` `~5.1.0` → `~6.2.0`; with the latter, `ExcludedPageArea.excludedAreaColor` is now applied at render time.
- Updated the package description to present the library as a PDF visual comparison tool with no external system package dependencies.

### Removed

- **BREAKING:** Windows support. The internal `pdfToPngWindowsCompat` module was removed, and the package now declares only `darwin` and `linux` in `os`.

### Security

- Added `allowedInputRoot` sandboxing with symlink rejection for string PDF input paths (CWE-59 / CWE-61).
- Hardened `diffsOutputFolder` and `pdfToPngConvertOptions.outputFolder` against symlink traversal and validate→use (TOCTOU) races (CWE-367); diff PNGs are now written via a tempfile and atomically renamed into place.
