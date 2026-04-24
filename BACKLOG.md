# BACKLOG

Consolidated backlog merged from the current code review, `BACKLOG_GEMINI.md`, and `TASKS.md`.

Only active, non-duplicate items are retained here. Obsolete items that are already fixed in the
current codebase were intentionally dropped.

## P1

### ARC-001 — Decouple the public API from upstream dependency types
**Area:** Architecture, Type System

**Problem**  
`ComparePdfOptions` exposes `PdfToPngOptions` directly, and `ExcludedPageArea` exposes `Area` /
`Color` from `png-visual-compare`. The library API is therefore the accidental union of two
dependency APIs rather than a stable domain contract.

**Technical rationale**  
This creates long-term coupling: upstream type changes become downstream breaking changes,
unsupported upstream flags appear supported by this library, and the package cannot evolve
independently of its adapters.

**Implementation direction**  
Introduce library-owned public types such as `PdfInput`, `PdfRenderOptions`, `PageExclusion`, and
`ComparePdfOptions`. Move `pdf-to-png-converter` and `png-visual-compare` usage behind internal
adapter modules.

**Acceptance criteria**  
1. Public exported option types no longer import or re-export upstream option shapes directly.
2. Internal adapters map library-owned types to dependency-specific types.
3. A dependency version change that renames or adds an option does not require a public API change in this package.

### TS-001 — Fix the public input type so it exactly matches supported runtime inputs
**Area:** Type System, Public API

**Problem**  
The exported TypeScript contract does not exactly match the set of runtime-supported and
consumer-facing input shapes.

**Technical rationale**  
This is a public `.d.ts` contract bug. TypeScript consumers should not need type assertions for
documented happy paths, and supported runtime inputs should not be broader than the published type
surface.

**Implementation direction**  
Create and export a shared `PdfInput` type. Decide the supported set explicitly (`string | Buffer`,
or `string | Buffer | ArrayBufferLike`, or `string | Uint8Array` if broader binary input is
desired), then align runtime guards, README examples, and tests to that decision.

**Acceptance criteria**  
1. The published type signature matches the supported runtime inputs exactly.
2. Buffer-based usage compiles without type assertions.
3. There is a test covering every supported binary input variant.

### TS-002 — Narrow `pdfToPngConvertOptions` to the subset that is valid for comparison
**Area:** Type System, Reliability

**Problem**  
The current API accepts the full `PdfToPngOptions`, including combinations that are incompatible
with `comparePdf` such as `returnMetadataOnly: true` or `returnPageContent: false`.

**Technical rationale**  
This is a hidden runtime contract: callers can pass values that compile cleanly and then fail during
comparison because page image content is missing.

**Implementation direction**  
Define a library-specific render options type that excludes unsupported flags. For any remaining
edge cases that cannot be encoded in types alone, validate them up front and throw a configuration
error before rendering begins.

**Acceptance criteria**  
1. Unsupported render flags cannot be passed without a compile-time error or a dedicated configuration error.
2. `comparePdf` never reaches the page comparison loop with `content: undefined` due to a supported option combination.
3. Tests cover both accepted and rejected render option combinations.

### VAL-001 — Validate numeric configuration explicitly instead of relying on plain `number`
**Area:** Reliability, Type System

**Problem**  
`compareThreshold`, `matchingThreshold`, and `pageNumber` are documented as constrained values but
are effectively treated as unconstrained `number`s at runtime.

**Technical rationale**  
This leaves false-positive paths open. For example, `compareThreshold: NaN` makes
`pageCompareResult > pageThreshold` always evaluate to `false`, which can incorrectly mark
different PDFs as equal.

**Implementation direction**  
Add explicit runtime guards for finite integer values:
- `compareThreshold` and `matchingThreshold` must be finite non-negative integers
- `pageNumber` must be a finite positive integer  
Throw a dedicated configuration error when validation fails.

**Acceptance criteria**  
1. `NaN`, `Infinity`, negative values, and fractional values are rejected for thresholds.
2. `pageNumber <= 0`, fractional values, and non-finite values are rejected.
3. Tests prove invalid numeric values cannot silently produce a passing comparison.

### ARC-002 — Replace page matching-by-index/name with a comparison plan keyed by `pageNumber`
**Area:** Architecture, Correctness

**Problem**  
Exclusion lookup uses loop index, while page pairing uses rendered page `name`. Both are fragile and
couple correctness to render order and filename generation.

**Technical rationale**  
This breaks down as soon as the caller uses partial page processing (`pagesToProcess`) or custom
output masks. Page semantics belong to page numbers, not array position or generated filenames.

**Implementation direction**  
Build a page comparison plan keyed by page number. Index both rendered outputs by `pageNumber`,
resolve exclusions by `pageNumber`, and compare the selected page set explicitly instead of
searching by generated name.

**Acceptance criteria**  
1. `pagesToProcess` works correctly with exclusions and thresholds tied to page numbers.
2. Custom `outputFileMaskFunc` does not affect page pairing.
3. Missing pages are reported deterministically without relying on filename mismatches.

### REL-001 — Introduce typed library errors and stop using comparator invalid-input behavior as control flow
**Area:** Error Handling, Reliability

**Problem**  
The function mixes handwritten `Error` strings, raw dependency errors, and a control-flow path that
relies on `comparePng(..., '', { throwErrorOnInvalidInputData: false })`.

**Technical rationale**  
Consumers cannot reliably distinguish invalid input, configuration mistakes, render failures, and
true content mismatches. This weakens debuggability and makes integration code brittle.

**Implementation direction**  
Create explicit error classes such as `ComparePdfInputError`, `ComparePdfConfigurationError`,
`ComparePdfRenderError`, and `ComparePdfComparisonError`. Detect missing page content and missing
counterpart pages before calling `comparePng`, and wrap dependency failures with `cause`.

**Acceptance criteria**  
1. All thrown library errors use stable classes with stable messages.
2. Dependency exceptions are wrapped with `cause`.
3. The comparator is not invoked with placeholder invalid input solely to produce a mismatch.

### DOC-001 — Eliminate public contract drift across README, JSDoc, and emitted declarations
**Area:** Documentation, Public API

**Problem**  
The repository already shows contract drift: input types, exclusion matching semantics, and option
behavior are described inconsistently across source comments, README content, emitted declarations,
and runtime code.

**Technical rationale**  
This is a current consumer-facing bug surface, not future polish. For a library package, contract
drift creates integration errors, bad examples, and misleading IntelliSense.

**Implementation direction**  
Audit all public API docs against runtime behavior after the type and architecture fixes above.
Prefer generating API docs from exported types or at least co-locating documentation with the source
of truth.

**Acceptance criteria**  
1. README, JSDoc, and emitted `.d.ts` files describe the same supported input types.
2. Exclusion matching is documented consistently as page-number based or changed consistently if the implementation changes.
3. Non-functional options such as `excludedAreaColor` are either documented as unsupported/deprecated or removed from the public contract.

### CI-001 — Run the full validation pipeline in `publish.yml` before publishing
**Area:** DevOps / CI, Release Safety

**Problem**  
The publish workflow builds and publishes the package but does not run the repository’s full
validation pipeline first.

**Technical rationale**  
This allows a release to pass compilation and still publish while tests or other required checks
would fail in the normal development workflow.

**Implementation direction**  
Run `npm test` in the publish workflow before `npm publish` so the release path matches the
repository’s validated path.

**Acceptance criteria**  
1. `publish.yml` runs `npm test` before publishing.
2. A failing test blocks package publication.
3. The workflow does not duplicate or bypass repository-level validation steps.

## P2

### API-001 — Add a structured result API and keep `comparePdf` as a boolean convenience wrapper
**Area:** Architecture, Extensibility

**Problem**  
A single `boolean` return value hides page-level mismatch counts, threshold decisions, diff paths,
and page-count mismatch details.

**Technical rationale**  
The current API makes diagnostics depend on filesystem side effects. Any richer use case requires
either breaking changes or more hidden behavior.

**Implementation direction**  
Add `comparePdfDetailed()` returning a result object with per-page status, mismatch counts,
thresholds, and diff paths. Keep `comparePdf()` as a convenience wrapper that returns
`result.isEqual`.

**Acceptance criteria**  
1. The detailed API exposes page-level comparison outcomes without requiring file inspection.
2. The existing boolean API remains backward-compatible.
3. Tests assert both the detailed result structure and the boolean wrapper behavior.

### ARC-003 — Split `comparePdf.ts` into orchestration, validation, planning, and adapter modules
**Area:** Code Organization, Maintainability

**Problem**  
`comparePdf.ts` currently combines input validation, option normalization, renderer constraints,
page matching, diff path generation, threshold logic, and final result aggregation.

**Technical rationale**  
This is manageable today only because the feature surface is small. It is the main maintainability
hotspot for future features such as richer results, new renderers, alternative comparators, or
progress callbacks.

**Implementation direction**  
Extract private modules such as `validateInput.ts`, `normalizeOptions.ts`, `planComparison.ts`,
`comparePages.ts`, `PdfRenderer.ts`, and `ImageComparator.ts`. Keep the top-level function as a thin
orchestration layer.

**Acceptance criteria**  
1. `comparePdf.ts` no longer owns validation, option normalization, page planning, and comparison implementation directly.
2. At least four extracted modules exist with focused unit tests: validation, option normalization, comparison planning, and dependency adapters.
3. Rendering and image comparison are invoked through internal interfaces rather than inline dependency calls inside the main exported function.

### PERF-001 — Move from whole-document rendering to page-wise or bounded-batch comparison
**Area:** Performance, Scalability

**Problem**  
Both PDFs are fully rendered into memory before comparison begins.

**Technical rationale**  
Peak memory grows with document size and render scale, which will become a bottleneck for larger
PDFs or higher-resolution comparisons.

**Implementation direction**  
Render and compare pages incrementally, or use a bounded batch size. Free page buffers as soon as a
page comparison finishes. Preserve the documented sequential rendering workaround if the underlying
renderer still requires it.

**Acceptance criteria**  
1. Peak memory usage no longer scales with the full page count of both documents.
2. Large multi-page comparisons complete without holding both full rendered documents in memory.
3. A regression test or benchmark demonstrates bounded memory behavior for multi-page input.

### PERF-002 — Replace repeated linear lookups in the comparison loop with maps keyed by page number
**Area:** Performance, Correctness

**Problem**  
The comparison loop repeatedly performs `.find()` lookups against `expectedPdfPngPages` and
`excludedAreas`.

**Technical rationale**  
That turns page comparison into quadratic behavior for larger PDFs and compounds the fragility of the
current page-matching scheme.

**Implementation direction**  
Build maps for expected pages and page exclusions before the comparison loop. Prefer `pageNumber`
keys over generated file names.

**Acceptance criteria**  
1. Page lookup in the comparison loop is O(1).
2. The implementation no longer calls `.find()` on the full expected-page collection per page.
3. The change preserves current behavior for existing fixtures and custom page selections.

### API-002 — Remove, deprecate, or implement `excludedAreaColor`
**Area:** Public API, Maintainability

**Problem**  
`ExcludedPageArea.excludedAreaColor` is publicly documented but has no runtime effect.

**Technical rationale**  
Dead public options erode trust in both typings and docs. They also create future compatibility
pressure because consumers may believe they are relying on supported behavior.

**Implementation direction**  
Choose one path explicitly: wire the option through if the downstream comparator supports it, or
deprecate/remove it from the public type and README until it becomes functional.

**Acceptance criteria**  
1. The runtime behavior matches the public type and documentation.
2. If retained, there is a test proving the option changes output.
3. If removed or deprecated, the migration path is documented.

### SEC-001 — Validate or explicitly sandbox `diffsOutputFolder`
**Area:** Security, Reliability

**Problem**  
`diffsOutputFolder` is accepted as arbitrary input and resolved into a filesystem write location
without any library-level constraints.

**Technical rationale**  
In untrusted or service-style usage, this allows path traversal or accidental writes outside the
intended artifact directory.

**Implementation direction**  
Either validate that diff output stays inside an allowed root or make the API explicitly
“trusted input only” and document that clearly. If the library keeps writing to disk by default, it
should own the safety story.

**Acceptance criteria**  
1. The package either enforces an output root or documents the trust requirement unambiguously.
2. Paths escaping the configured root are rejected with a configuration error.
3. Tests cover both valid and rejected output paths.

### SEC-002 — Define the trust boundary for string input paths
**Area:** Security, Public API

**Problem**  
`actualPdf` and `expectedPdf` accept arbitrary string paths and only validate existence before
passing those files to the renderer.

**Technical rationale**  
That is acceptable for trusted local test usage, but in service-style or multi-tenant usage it
allows reads outside an expected workspace. The package currently has no explicit trust model for
this behavior.

**Implementation direction**  
Either document string path inputs as trusted-only or add an optional allowed-root mechanism that
rejects paths outside a configured workspace. Keep binary input support as the safer alternative for
untrusted environments.

**Acceptance criteria**  
1. The API docs describe whether string path inputs are trusted-only or constrained by configuration.
2. If an allowed-root option exists, out-of-root paths are rejected with a configuration error.
3. Tests cover both accepted in-root paths and rejected out-of-root paths.

### TS-003 — Turn input validation into an assertion function that narrows to the supported input type
**Area:** Type System, Maintainability

**Problem**  
`validateInputFileType` performs runtime checks but does not express the narrowed input contract via
an assertion signature.

**Technical rationale**  
This misses an opportunity to make the supported input type explicit inside the implementation and
reduces the value of the runtime guard to TypeScript.

**Implementation direction**  
After `PdfInput` is finalized, change the validator to use an `asserts input is PdfInput` signature
and keep the accepted input set synchronized with the public type.

**Acceptance criteria**  
1. The validator narrows to the exported input type.
2. Call sites no longer rely on separate implicit assumptions about the accepted input shape.
3. Tests cover all supported and rejected input forms.

### OPS-001 — Run the Docker image as a non-root user
**Area:** Security, Operations

**Problem**  
The repository’s container image runs as `root`.

**Technical rationale**  
Even for a test-focused image, defaulting to root expands blast radius in the event of a container
escape or dependency-level exploit.

**Implementation direction**  
Add a dedicated non-root user and switch to it before the container command runs.

**Acceptance criteria**  
1. The image defines and uses a non-root user.
2. The test command still runs successfully under that user.
3. Mounted test output remains writable without requiring root.

### OPS-002 — Slim the Docker image by avoiding runtime installation of dev-only tooling
**Area:** Operations, Dependency Management

**Problem**  
The current image installs the full development dependency tree even though the final runtime only
needs enough tooling to execute the intended container command.

**Technical rationale**  
This increases image size, attack surface, and dependency churn.

**Implementation direction**  
Use a multi-stage Docker build or otherwise separate build/test dependencies from the final runtime
layer. If the image is test-only by design, document that explicitly and scope the image to that
purpose.

**Acceptance criteria**  
1. The final image contains only the dependencies required for its declared purpose.
2. The repository documents whether the image is test-only or a distributable runtime artifact.
3. Image size or dependency count is measurably reduced without breaking container-based testing.

### TEST-001 — Add type-level and published-artifact verification to the test strategy
**Area:** Testing Strategy, Release Safety

**Problem**  
The current suite validates runtime behavior well, but it does not type-check consumer-style usage
against the published declarations and it does not verify the built package entry point.

**Technical rationale**  
That is why public typing drift can survive even while the tests stay green.

**Implementation direction**  
Add a dedicated `typecheck` script that includes tests and example usage, plus at least one
integration test that imports the built `out/index.js` artifact or validates the package export map
after build.

**Acceptance criteria**  
1. CI fails if consumer-style TypeScript usage no longer compiles.
2. CI fails if the built package entry point or export map is broken.
3. Buffer-based example usage is covered by type-level verification.

### TEST-002 — Add edge-case tests for numeric validation and page subset semantics
**Area:** Testing Strategy, Reliability

**Problem**  
Critical boundary behavior is currently untested: `NaN`, `Infinity`, non-integer thresholds, invalid
`pageNumber` values, and `pagesToProcess` interactions with exclusions and page pairing.

**Technical rationale**  
These are precisely the areas where the current implementation has hidden contracts and high risk of
silent false positives.

**Implementation direction**  
Add focused tests for invalid numeric inputs, partial-page comparisons, missing counterpart pages,
and explicit error-class assertions once the error model is introduced.

**Acceptance criteria**  
1. Invalid numeric configuration values are rejected consistently.
2. Partial page processing has deterministic behavior with exclusions and thresholds.
3. Error tests assert specific error types and messages rather than only truthy throwing behavior.

## P3

### API-003 — Make diff generation an explicit behavior instead of an implicit side effect
**Area:** Architecture, Developer Experience

**Problem**  
A function that returns `boolean` writes files to disk by default, with the default path derived from
the current working directory.

**Technical rationale**  
This is surprising library behavior and makes the function harder to use in CI workers, monorepos,
sandboxed environments, and test processes with restricted write permissions.

**Implementation direction**  
Add an explicit switch such as `writeDiffs` or move diff generation behind the detailed result API.
Resolve the default output path lazily at call time, not module load time.

**Acceptance criteria**  
1. Callers can compare PDFs without producing disk output unless they opt in.
2. The default output path is resolved at execution time, not import time.
3. The README clearly documents when files are written and where.

### REL-002 — Replace the `existsSync` pre-check with direct error wrapping or document the TOCTOU tradeoff
**Area:** Reliability, Security

**Problem**  
The implementation performs a separate existence check before handing a path to the renderer.

**Technical rationale**  
That creates a time-of-check to time-of-use gap and duplicates part of the downstream file-opening
responsibility.

**Implementation direction**  
Either remove the pre-check and wrap the downstream file-read error into a stable library error, or
document the tradeoff if the explicit existence message is retained intentionally.

**Acceptance criteria**  
1. The file-opening path has a single source of truth for failure.
2. Callers still receive a stable, documented error for missing files.
3. The implementation no longer relies on a separate preflight existence check without documenting why.

### DOC-002 — Add `CONTRIBUTING.md`
**Area:** Documentation, Developer Experience

**Problem**  
The repository has no contributor guide covering local setup, validation commands, workflow
expectations, or release basics.

**Technical rationale**  
That increases friction for outside contributors and makes process knowledge live only in scattered
scripts and repository conventions.

**Implementation direction**  
Add `CONTRIBUTING.md` with setup, `npm test`, Docker-based testing expectations, branching/PR
guidance, and release validation steps.

**Acceptance criteria**  
1. New contributors can set up and validate the project from the guide alone.
2. The document references the canonical validation commands used by the repository.
3. The guide covers both local and CI-relevant expectations.

### DOC-003 — Add `CHANGELOG.md`
**Area:** Documentation, Release Management

**Problem**  
The repository does not maintain a changelog describing user-visible changes between releases.

**Technical rationale**  
That makes upgrades harder for consumers and obscures breaking or behavioral changes over time.

**Implementation direction**  
Add `CHANGELOG.md` using a consistent format such as Keep a Changelog and start recording
release-visible changes.

**Acceptance criteria**  
1. The repository contains a changelog with at least the current release line documented.
2. Future release changes have a standard place to be recorded.
3. Breaking changes can be identified from the changelog without reading raw git history.

### DEP-001 — Remove `@types/pngjs` if verification shows it is unused directly by this repository
**Area:** Dependency Management

**Problem**  
`@types/pngjs` appears to be a direct devDependency even though the repository does not import
`pngjs` directly in source or tests.

**Technical rationale**  
Unused direct dependencies add maintenance overhead, license surface, and avoidable install cost.

**Implementation direction**  
Verify that removing `@types/pngjs` causes no type-check or test regressions. If it is only needed
transitively, remove it from direct devDependencies.

**Acceptance criteria**  
1. The repository builds and tests successfully without `@types/pngjs` as a direct dependency, or the dependency is justified in documentation.
2. The direct dependency list contains only packages required by this repository’s own source, tests, or tooling.
3. The lockfile is updated consistently if the dependency is removed.

### CI-002 — Make `docker:run` cross-platform or explicitly Unix-only
**Area:** DevOps / CI, Developer Experience

**Problem**  
The `docker:run` script uses a shell-specific working-directory expansion that is not portable across
all supported contributor environments.

**Technical rationale**  
This creates a broken local workflow for Windows users even though the repository otherwise targets
cross-platform development and CI.

**Implementation direction**  
Replace the path interpolation with a cross-platform approach or document the shell requirement and
provide a supported alternative.

**Acceptance criteria**  
1. The Docker-based local workflow works on both Unix-like shells and Windows, or the supported shell requirement is documented clearly.
2. The repository exposes a single documented way to run the Docker test path locally.
3. The script no longer depends on undocumented shell-specific behavior.

### CI-003 — Document and enforce required status checks for merges to `main`
**Area:** DevOps / CI, Governance

**Problem**  
There is no repository-level documentation of required checks before merge.

**Technical rationale**  
Even strong CI workflows provide less value if protected branches do not require them.

**Implementation direction**  
Document the required CI checks and align repository branch protection with that policy.

**Acceptance criteria**  
1. Contributor-facing docs state which checks must pass before merge.
2. Repository branch protection requires the intended CI checks.
3. The documented merge policy matches the configured repository policy.

### DX-001 — Standardize the container build file name to `Dockerfile`
**Area:** Developer Experience, Tooling

**Problem**  
The repository uses a lowercase `dockerfile` instead of the conventional `Dockerfile`.

**Technical rationale**  
This is easy to miss, can break default tooling assumptions, and reduces consistency with Docker
ecosystem conventions.

**Implementation direction**  
Rename the file to `Dockerfile` and keep scripts/docs aligned with the standard name.

**Acceptance criteria**  
1. The repository uses `Dockerfile` with the standard capitalization.
2. Docker commands work without an explicit `-f` override.
3. Any scripts or docs referencing the old filename are updated.

### PERF-003 — Only parallelize page comparison if the comparator surface supports safe async execution
**Area:** Performance

**Problem**  
Per-page PNG comparison is currently synchronous, which limits throughput, but speculative
parallelization could reintroduce subtle dependency or resource issues.

**Technical rationale**  
The renderer already has a known concurrency constraint. Any attempt to optimize throughput should be
gated by clear comparator capabilities instead of assumption-driven parallelism.

**Implementation direction**  
Evaluate page-comparison parallelism only after renderer/comparator boundaries exist and comparator
execution can be proven safe under concurrency.

**Acceptance criteria**  
1. Any parallelization work is backed by a benchmark and dependency-level safety review.
2. Comparison throughput changes do not regress correctness or determinism.
3. The implementation preserves the documented sequential renderer constraint.
