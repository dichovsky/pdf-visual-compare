# Changelog

All notable user-visible changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/).

> Historical release notes were not previously maintained in this repository. The entries below include only details that are supportable from the current repository state and git history.

## [Unreleased]

### Added

- **CLI** — `pdf-visual-compare <actual.pdf> <expected.pdf> [options]` (run via `npx pdf-visual-compare`). Options: `-t/--threshold`, `--threshold-percent`, `-p/--pages`, `-f/--format <text|json|junit>`, `-o/--out`, `--fail-on-diff`, `-h/--help`, `-v/--version`. Exit codes: `0` success, `1` differences found with `--fail-on-diff`, `2` usage or runtime error.
- `ComparePdfOptions.pages` — restrict the comparison to a subset of pages, as a range-spec string (`"1-3,5,7"`) or an array of 1-based page numbers (`[1, 2, 3, 5, 7]`). A selection that matches no rendered page in either PDF throws a `ComparePdfConfigurationError` rather than passing vacuously.
- `ComparePdfOptions.compareThresholdPercent` and per-page `PageExclusion.matchingThresholdPercent` — an optional percentage threshold evaluated alongside the existing pixel-count threshold. A page passes when it is within EITHER threshold, so a percentage relaxes (never tightens) the pixel-count default.
- Per-page change statistics on `ComparePdfPageResult`: `mismatchPercent` (differing pixels as a percentage of the rendered page area) and `thresholdPercent` (the applied percentage threshold, or `null`).
- Document-level rollup on `ComparePdfDetailedResult`: a new `summary` (`ComparePdfSummary` — page counts by status, `maxMismatchPercent`, `totalMismatchCount`) plus `compareThresholdPercent`.
- `toJsonReport(result)` and `toJUnitReport(result)` — serialize a `ComparePdfDetailedResult` to pretty JSON or a JUnit XML report (one `<testcase>` per page). Both are exported from the package entry point.
- New exported type `ComparePdfSummary`.

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

- **BREAKING:** Minimum Node.js raised from `>=20` to `>=24` (required by the bundled `@napi-rs/canvas` native binaries pulled in through `pdf-to-png-converter` 4.x).
- **BREAKING:** `ComparePdfOptions.pdfToPngConvertOptions` is now typed as the library-owned `PdfRenderOptions` instead of the downstream `PdfToPngOptions`. It is narrowed to comparison-safe render settings — the downstream rendering-control properties `returnPageContent`, `returnMetadataOnly`, `processPagesInParallel`, and `concurrencyLimit` are rejected at runtime with a `ComparePdfConfigurationError`.
- **BREAKING:** `excludedAreas` entries are now typed via `PageExclusion` (`ExcludedPageArea` remains exported), with area and color fields using the library-owned `PageArea` and `RgbColor` types instead of downstream types.
- `comparePdf` now accepts `Buffer` as an explicit input type in addition to `string` and `ArrayBufferLike`.
- Upgraded runtime dependencies: `pdf-to-png-converter` `~3.18.0` → `~4.1.1` and `png-visual-compare` `~5.1.0` → `~6.2.0`; with the latter, `ExcludedPageArea.excludedAreaColor` is now applied at render time.
- Updated the package description to present the library as a PDF visual comparison tool with no external system package dependencies.

### Removed

- **BREAKING:** Windows support. The internal `pdfToPngWindowsCompat` module was removed, and the package now declares only `darwin` and `linux` in `os`.

### Security

- Added `allowedInputRoot` sandboxing with symlink rejection for string PDF input paths (CWE-59 / CWE-61).
- Hardened `diffsOutputFolder` and `pdfToPngConvertOptions.outputFolder` against symlink traversal and validate→use (TOCTOU) races (CWE-367); diff PNGs are now written via a tempfile and atomically renamed into place.
