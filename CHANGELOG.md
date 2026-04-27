# Changelog

All notable user-visible changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/).

> Historical release notes were not previously maintained in this repository. The seeded entries below include only details that are supportable from the current repository state and git history.

## [Unreleased]

### Changed

- Narrowed `PdfRenderOptions` to comparison-safe render settings and reject runtime attempts to disable page content or enable parallel rendering.

## [4.0.0] - 2026-04-24

### Removed

- Windows support. The package now declares Linux and macOS as the supported operating systems.

### Changed

- Updated package metadata and project documentation to describe the library as a PDF visual comparison tool with no external system package dependencies.
