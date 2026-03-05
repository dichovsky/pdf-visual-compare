# Code Review Improvements

Comprehensive audit of the `pdf-visual-compare` repository against modern TypeScript / Node.js best
practices, covering Security, Performance, Code Quality, Architecture, Testing, Documentation,
Dependencies, DevOps / CI, Docker & Deployment, and Developer Experience.

---

## Security

### [P1] Run Docker container as a non-root user

**Problem**
The `Dockerfile` contains no `USER` directive, so the container process runs as `root`.

**Impact**
A container breakout or exploited vulnerability in a dependency gives an attacker full root access
to the host system.

**Solution**
Add a dedicated non-root user and switch to it before running the application:

```dockerfile
RUN groupadd --gid 1001 appgroup && useradd --uid 1001 --gid appgroup --shell /bin/sh appuser
USER appuser
```

**Files**
`Dockerfile`

---

### [P1] Pin GitHub Actions to a commit SHA

**Problem**
`actions/checkout@v6` and `actions/setup-node@v6` are referenced by a floating major-version tag.
If the tag is moved (intentionally or via supply-chain attack), the pipeline executes arbitrary code.
Note: as of this audit, `v6` does not exist for either action (latest is `v4`), which also means the
workflows will fail as soon as GitHub resolves these references.

**Impact**
Supply-chain attack vector; incorrect action versions may also silently change build behavior.

**Solution**
Pin each action to a specific, reviewed commit SHA and keep a readable alias comment:

```yaml
- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
- uses: actions/setup-node@39370e3970a6d050c480ffad4ff0ed4d3fdee5af # v4.1.0
```

**Files**
`.github/workflows/test.yml`, `.github/workflows/publish.yml`

---

### [P2] Validate `diffsOutputFolder` to prevent path traversal

**Problem**
`opts.diffsOutputFolder` is accepted from callers without any validation and passed directly to
`resolve()` and file-write operations inside `png-visual-compare`. A caller could supply a path such
as `../../etc` to write diff images outside the intended directory.

**Impact**
Path traversal — diff images could overwrite arbitrary files on disk when the library is used in an
uncontrolled context.

**Solution**
Validate that the resolved `diffsOutputFolder` stays within an expected root, or at minimum document
clearly that callers are responsible for sanitising this value. For library-level protection, add a
check that the resolved path does not escape the working directory (or a user-specified root).

**Files**
`src/comparePdf.ts`

---

### [P2] Do not install devDependencies inside the Docker image

**Problem**
`RUN npm ci` installs all dependencies (including devDependencies) into the image. This inflates the
image with build-only tools that are never needed at runtime and increases the attack surface.

**Impact**
Larger attack surface; unnecessary packages included in a shipped artefact.

**Solution**
Either use `npm ci --omit=dev` for a production install, or (better) use a multi-stage build where
the test stage installs everything and the final stage installs only production dependencies (see
Docker task below).

**Files**
`Dockerfile`

---

## Performance

### [P1] Fix "Invalid page request" crash when PDFs have different page counts (CI failure)

**Problem**
`comparePdf.ts` passes the **same** `pdfToPngConvertOpts` object reference to both parallel
`pdfToPng()` calls. `pdf-to-png-converter` mutates this object internally (e.g., it writes back
`pagesToProcess` based on the actual PDF page count). When the two PDFs have different page counts,
one call overwrites `pagesToProcess` with values valid for its PDF; the other call then tries to
fetch non-existent pages and throws `Error: Invalid page request`.

This is an active CI failure visible in run `22488913018` (test: *should return false for non equal
PDF files, pages amount not match*).

**Impact**
Test suite fails on CI; any real-world comparison of PDFs with different page counts throws an
unhandled error instead of returning `false`.

**Solution** *(already applied in this PR)*
Pass a separate shallow copy of the options to each call so that mutations in one invocation cannot
affect the other:

```typescript
let [actualPdfPngPages, expectedPdfPngPages] = await Promise.all([
    pdfToPng(actualPdf, { ...pdfToPngConvertOpts }),
    pdfToPng(expectedPdf, { ...pdfToPngConvertOpts }),
]);
```

**Files**
`src/comparePdf.ts`

---

### [P3] Consider parallelising per-page PNG comparisons

**Problem**
The `forEach` loop in `comparePdf` calls `comparePng` synchronously for each page. For multi-page
PDFs this is sequential even though pages are independent.

**Impact**
Slight throughput reduction for large PDFs; `comparePng` itself is synchronous in
`png-visual-compare`, so the benefit is limited to I/O within that function.

**Solution**
If `png-visual-compare` exposes an async variant in a future version, switch to `Promise.all` over
the pages array. For now, document the limitation as a known design constraint.

**Files**
`src/comparePdf.ts`

---

## Code Quality

### [P2] Replace `any` with `unknown` in `validateInputFileType`

**Problem**
`validateInputFileType(inputFile: any)` accepts any value without TypeScript enforcement. This
weakens type safety across the call sites.

**Impact**
Type errors that TypeScript could catch are silently ignored; future refactors may miss invalid
usages.

**Solution**
Change the parameter type to `unknown` and use proper type-narrowing guards (which already exist in
the function body):

```typescript
function validateInputFileType(inputFile: unknown): void { … }
```

**Files**
`src/comparePdf.ts`

---

### [P2] Remove redundant optional chaining on already-defaulted variable

**Problem**
Inside `comparePdf`, `opts` has a default value of `{}`, yet later references use `opts?.` optional
chaining (e.g., `opts?.diffsOutputFolder`, `opts?.compareThreshold`, `opts?.excludedAreas`,
`opts?.pdfToPngConvertOptions`).

**Impact**
Misleading — it implies `opts` can be `null`/`undefined` even though it cannot after defaulting.
Reduces code clarity.

**Solution**
Replace `opts?.` with `opts.` for all accesses after the default parameter assignment.

**Files**
`src/comparePdf.ts`

---

### [P2] Spreading `pdfToPngConvertOptions` into `ComparePngOptions` passes unknown fields

**Problem**
`comparePngOpts` is built by spreading `opts?.pdfToPngConvertOptions` (a `PdfToPngOptions` object):

```typescript
const comparePngOpts: ComparePngOptions = {
    ...opts?.pdfToPngConvertOptions,
    ...excludedAreas[index],
    throwErrorOnInvalidInputData: false,
};
```

`PdfToPngOptions` contains fields irrelevant to `ComparePngOptions` (e.g., `viewportScale`,
`disableFontFace`, `pagesToProcess`, etc.). These are forwarded silently and may accidentally
override legitimate `ComparePngOptions` fields if names clash.

**Impact**
Silent option pollution; potential unexpected behavior in `png-visual-compare`.

**Solution**
Only spread the fields from `PdfToPngOptions` that are intentionally shared with `ComparePngOptions`
(currently none), or remove the spread entirely:

```typescript
const comparePngOpts: ComparePngOptions = {
    ...excludedAreas[index],
    throwErrorOnInvalidInputData: false,
};
```

**Files**
`src/comparePdf.ts`

---

### [P2] Non-null assertion on `pngPage.content`

**Problem**
`pngPage.content!` uses a non-null assertion. If `pdf-to-png-converter` ever returns a page with
`content: undefined`, this will produce a runtime error with a poor error message rather than a
clean diagnostic.

**Impact**
Masking potential upstream changes; runtime crash without context.

**Solution**
Add an explicit guard or a descriptive error:

```typescript
if (!pngPage.content) {
    throw new Error(`Page content is undefined for page: ${pngPage.name}`);
}
```

**Files**
`src/comparePdf.ts`

---

### [P3] `Dockerfile` filename should follow the standard `Dockerfile` convention

**Problem**
The Docker build file is named `dockerfile` (all lowercase) instead of the conventional `Dockerfile`.

**Impact**
`docker build .` uses `Dockerfile` as the default filename. The current name requires an explicit
`-f dockerfile` flag. It may also confuse IDE tooling, syntax highlighters, and contributors.

**Solution**
Rename `dockerfile` to `Dockerfile`.

**Files**
`Dockerfile`

---

### [P3] `DEFAULT_DIFFS_FOLDER` resolved relative to CWD, not module location

**Problem**
`const.ts` resolves `DEFAULT_DIFFS_FOLDER` relative to `process.cwd()` at module load time. If the
library consumer runs their test runner from a different working directory, diff images land in an
unexpected location.

**Impact**
Confusing default behavior; diffs may be scattered across the filesystem in monorepo setups.

**Solution**
Document clearly that `DEFAULT_DIFFS_FOLDER` is CWD-relative, and encourage callers to always
supply an explicit `diffsOutputFolder`. Alternatively, evaluate resolving relative to the calling
module's `__dirname`/`import.meta.url`.

**Files**
`src/const.ts`

---

### [P3] Disable ESLint rules are too broad

**Problem**
`eslint.config.mjs` disables `@typescript-eslint/no-explicit-any` and
`@typescript-eslint/no-require-imports` globally across the entire project rather than at the
specific call sites that need them.

**Impact**
Legitimate violations in new code pass silently; the original suppressions were needed only for
specific usages.

**Solution**
Re-enable both rules globally and add inline `// eslint-disable-next-line` comments only at the
two actual locations that require them (`validateInputFileType` and any `require()` call).

**Files**
`eslint.config.mjs`, `src/comparePdf.ts`

---

## Architecture

### [P2] `pageNumber` field in `ExcludedPageArea` is misleading

**Problem**
`ExcludedPageArea.pageNumber` is documented as "Informational only — matching is performed by array
index, not this value." This means callers who set `pageNumber: 3` on the first element of
`excludedAreas` will have their exclusion applied to page 1 (index 0), not page 3.

**Impact**
High likelihood of user error; the API surface is confusing and counter-intuitive.

**Solution**
Either (a) implement index-by-`pageNumber` matching so the field is semantically meaningful, or
(b) rename the field to `label`/`comment` and update all docs to remove the suggestion that it
relates to page selection. Option (a) is more intuitive for end users.

**Files**
`src/types/ExcludedPageArea.ts`, `src/comparePdf.ts`, `README.md`

---

### [P2] Array swap silently changes which PDF is treated as "actual"

**Problem**
When `actualPdfPngPages.length < expectedPdfPngPages.length`, the arrays are swapped so the longer
one becomes `actualPdfPngPages`. The diff file is then named after the expected PDF's pages rather
than the actual PDF's pages, and the comparison direction is reversed.

**Impact**
Diff images may be named incorrectly; callers relying on diff file names for debugging see
unexpected output.

**Solution**
Instead of swapping, iterate over both arrays and produce a per-page result that handles the missing
pages explicitly. If page counts differ, immediately record a mismatch for the surplus pages and
continue rather than silently reordering.

**Files**
`src/comparePdf.ts`

---

### [P3] Single-file `comparePdf.ts` mixes validation, option-defaulting, and comparison logic

**Problem**
`comparePdf.ts` handles input validation, default option construction, PDF-to-PNG conversion, and
page comparison all in one function. For a library of this size this is acceptable, but growth will
make it harder to maintain.

**Impact**
Reduced maintainability as the feature set grows.

**Solution**
Consider extracting `buildPdfToPngOptions()` and `buildComparePngOptions()` as private helpers to
keep `comparePdf` focused on the orchestration pipeline.

**Files**
`src/comparePdf.ts`

---

## Testing

### [P1] No test covers the case where `pngPage.content` is undefined/null

**Problem**
The `pngPage.content!` non-null assertion is never exercised by a test. If content can be undefined,
this code path is entirely untested.

**Impact**
Silent runtime crash with no coverage safety net.

**Solution**
Add a test (or mock) that simulates a `PngPageOutput` with `content: undefined` and asserts that a
useful error is thrown.

**Files**
`__tests__/4.compare.pdf.exceptions.test.ts`, `src/comparePdf.ts`

---

### [P2] Tests for exception messages are too vague

**Problem**
Exception tests use `.rejects.toThrow(Error)` without asserting the **message**. This means a test
would pass even if a completely different error was thrown.

**Impact**
False-positive green tests; regressions in error message content are undetected.

**Solution**
Assert the specific error messages, e.g.:

```typescript
await expect(...).rejects.toThrow('PDF file not found: ./test-data/NOT_actual.pdf');
await expect(...).rejects.toThrow('Unknown input file type.');
await expect(...).rejects.toThrow('Compare Threshold cannot be less than 0.');
```

**Files**
`__tests__/4.compare.pdf.exceptions.test.ts`

---

### [P2] No test for `ArrayBufferLike` input types other than `Buffer`

**Problem**
The type signature accepts `ArrayBufferLike` (which includes `ArrayBuffer` and `SharedArrayBuffer`)
but tests only pass `Buffer` instances. `Buffer.isBuffer()` returns `false` for plain `ArrayBuffer`,
so those inputs fall through to the `Unknown input file type` error path.

**Impact**
The documented API contract (`ArrayBufferLike`) is broader than what is actually supported; callers
using `ArrayBuffer` will receive a confusing error.

**Solution**
Either add `ArrayBuffer` to the `Buffer.isBuffer` check (widening support) or narrow the public
type to `Buffer` and update documentation accordingly. Either way, add a test that exercises the
chosen behavior.

**Files**
`src/comparePdf.ts`, `src/types/ComparePdfOptions.ts` (indirectly), `__tests__/`

---

### [P2] Coverage threshold not enforced in `vitest.config.mjs`

**Problem**
`vitest.config.mjs` collects coverage but does not set `thresholds`. The README claims 100%
coverage, but nothing enforces this in CI.

**Impact**
Coverage regressions go unnoticed in pull requests.

**Solution**
Add coverage thresholds:

```javascript
coverage: {
    provider: 'v8',
    exclude: ['**/index.ts'],
    thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
    },
},
```

**Files**
`vitest.config.mjs`

---

### [P3] Test imports use `'../src'` instead of the published entry point

**Problem**
All test files import `{ comparePdf }` from `'../src'` (the raw TypeScript source). This bypasses
the compiled `./out/` entry point and means tests never validate that the `exports` map and compiled
output actually work.

**Impact**
Publishing a broken `./out/` directory would not be caught by the test suite.

**Solution**
Consider adding a separate integration test that imports from `'../out/index.js'` (after a build)
to verify the published artefact.

**Files**
`__tests__/*.test.ts`, `vitest.config.mjs`

---

### [P3] Missing test for `DEFAULT_DIFFS_FOLDER` constant

**Problem**
`src/const.ts` has no dedicated test. Specifically, the behavior of `resolve('./comparePdfOutput')`
expanding to an absolute CWD-relative path is not verified.

**Impact**
Const.ts has no coverage signal if the constant's default value changes.

**Solution**
Add a minimal test asserting that `DEFAULT_DIFFS_FOLDER` is an absolute path ending with
`comparePdfOutput`.

**Files**
`src/const.ts`, `__tests__/`

---

## Documentation

### [P2] `README.md` API table lists `string | Buffer` but actual type is `string | ArrayBufferLike`

**Problem**
The `comparePdf` parameter table shows:

> `actualPdf` — `string | Buffer`

The actual TypeScript signature accepts `string | ArrayBufferLike`.

**Impact**
Misleading documentation; callers who pass non-`Buffer` `ArrayBufferLike` values may be surprised
by the actual runtime behavior (see Testing issue above).

**Solution**
Either align the documentation with the real type (`string | ArrayBufferLike`) or align the
implementation with the documented type (`string | Buffer`).

**Files**
`README.md`, `src/comparePdf.ts`

---

### [P2] No `CONTRIBUTING.md`

**Problem**
There is no guide for contributors covering how to set up the dev environment, run tests, submit
pull requests, or follow the code style.

**Impact**
Friction for external contributors; inconsistent PRs.

**Solution**
Add a `CONTRIBUTING.md` covering: clone & install, running `npm test`, Prettier/ESLint setup,
branch naming, PR checklist, and the release process.

**Files**
`CONTRIBUTING.md` *(new file)*

---

### [P3] No `CHANGELOG.md`

**Problem**
There is no changelog tracking what changed between versions.

**Impact**
Users upgrading cannot easily understand breaking changes.

**Solution**
Add a `CHANGELOG.md` following Keep a Changelog format, with at least an entry for the current
version and retrospective entries for major past versions.

**Files**
`CHANGELOG.md` *(new file)*

---

### [P3] `ExcludedPageArea.pageNumber` JSDoc says matching is by index, not page number

**Problem**
The JSDoc for `pageNumber` says "Informational page number for readability. Matching is performed
by array index, not by this value." This is confusing and likely to be ignored by users who rely
on the field name.

**Impact**
Incorrect exclusion zones applied silently; hard-to-debug test failures.

**Solution**
Expand the JSDoc with a prominent `@remarks` warning and an example showing that the field at
index 0 applies to page 1 regardless of `pageNumber` value.

**Files**
`src/types/ExcludedPageArea.ts`

---

## Dependencies

### [P1] Several devDependencies specify versions that do not yet exist on npm

**Problem**
`package.json` specifies the following versions that did not exist at the time of this audit:

| Package | Specified | Latest stable |
|---|---|---|
| `vitest` | `^4.0.18` | `~2.x` |
| `@vitest/coverage-v8` | `^4.0.18` | `~2.x` |
| `eslint` | `^10.0.2` | `9.x` |
| `typescript` | `^5.9.3` | `5.7.x` |
| `rimraf` | `^6.1.3` | `5.x` |
| `@types/node` | `^25.3.2` | matching Node 22 LTS |

`npm ls` reports `UNMET DEPENDENCY` for all packages, meaning `npm install` / `npm ci` will fail in
a fresh environment, breaking local setup and CI.

**Impact**
`npm ci` fails; the repository is not installable; CI is broken.

**Solution**
Pin each devDependency to the latest stable version that exists. Run `npm install` after updating
`package.json` to regenerate `package-lock.json` with a valid dependency tree.

**Files**
`package.json`, `package-lock.json`

---

### [P2] `ts-node` is listed as a devDependency but is not used

**Problem**
`ts-node` appears in `devDependencies` but no script, config, or source file references it. `jiti`
is used instead (e.g., for ESLint config loading).

**Impact**
Unnecessary dependency increases install time, attack surface, and license exposure.

**Solution**
Remove `ts-node` from `devDependencies` and regenerate the lockfile.

**Files**
`package.json`

---

### [P2] `@types/pngjs` is a devDependency but is not directly used by source or tests

**Problem**
`@types/pngjs` provides types for the `pngjs` package. Neither `src/` nor `__tests__/` directly
imports `pngjs`; it is a transitive dependency of `png-visual-compare`.

**Impact**
Maintenance overhead; unnecessary package in the dependency tree.

**Solution**
Verify whether removing `@types/pngjs` causes any TypeScript errors. If not, remove it.

**Files**
`package.json`

---

### [P3] Production dependencies use `~` (patch) pinning instead of `^` (minor)

**Problem**
`"pdf-to-png-converter": "~3.14.0"` and `"png-visual-compare": "~4.1.0"` are pinned to patch
updates only. Minor updates (which may include performance improvements or bug fixes) require manual
intervention.

**Impact**
Callers may miss important updates; dependency management burden.

**Solution**
Evaluate upgrading to `^` range for minor-compatible updates, or document why strict patch pinning
is required (e.g., pixel-perfect rendering consistency).

**Files**
`package.json`

---

### [P3] `engines.yarn` set to `"please-use-npm"` — unconventional warning

**Problem**
`"yarn": "please-use-npm"` is not a valid semver range. While it communicates intent, it will
produce a warning or error in Yarn and may confuse tooling.

**Impact**
Minor: non-standard value may cause CI/tooling warnings.

**Solution**
Remove the `yarn` key from `engines` entirely, or document the npm-only policy in `CONTRIBUTING.md`
and use `.npmrc` / `.yarnrc.yml` to enforce it.

**Files**
`package.json`

---

## DevOps / CI

### [P1] `publish.yml` does not run tests before publishing

**Problem**
The publish workflow runs `npm run build` and `npm publish` but **not** `npm test`. A build that
passes compilation but fails tests can be published to npm.

**Impact**
Broken package versions published to the public registry.

**Solution**
Add `npm test` (or at minimum `npm run lint && npm run build && npm test`) before `npm publish`:

```yaml
- run: npm ci
- run: npm test
- run: npm publish
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Files**
`.github/workflows/publish.yml`

---

### [P1] GitHub Actions use non-existent action versions (`v6`)

**Problem**
Both `test.yml` and `publish.yml` reference `actions/checkout@v6` and `actions/setup-node@v6`.
These major versions do not exist (latest is `v4`). GitHub will fail to resolve the action and
the workflows will error.

**Impact**
All CI and CD pipelines are broken or at risk; this directly caused the observed CI failures.

**Solution**
Update to valid, pinned versions:

```yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
```

Or pin to a commit SHA (see Security section).

**Files**
`.github/workflows/test.yml`, `.github/workflows/publish.yml`

---

### [P2] `docker:run` script uses `$PWD` which fails on Windows PowerShell

**Problem**
`"docker:run": "docker run --rm -it -v $PWD/test-results:/usr/pkg/test-results ..."` uses the
Bash-specific `$PWD` variable, which is not available in Windows PowerShell or CMD.

**Impact**
`npm run docker:run` fails on Windows without WSL.

**Solution**
Use a cross-platform equivalent, or document that `docker:run` requires a Unix shell. For
cross-platform support, replace with:

```json
"docker:run": "docker run --rm -it -v %cd%/test-results:/usr/pkg/test-results test-pdf-visual-compare"
```

or use a helper script (`cross-env` / `scripts/docker-run.sh`).

**Files**
`package.json`

---

### [P2] No branch protection rules or required status checks documented

**Problem**
There is no record of branch protection rules requiring CI to pass before merging to `main`.

**Impact**
Broken code can be merged directly to `main` and subsequently published.

**Solution**
Enable branch protection on `main` requiring the `ubuntu` and `windows` CI jobs to pass before
merge. Document this in `CONTRIBUTING.md`.

**Files**
`.github/` (repository settings), `CONTRIBUTING.md` *(new file)*

---

### [P3] CI does not cache the build output (`./out/`)

**Problem**
`npm test` runs `clean → lint → license → build → vitest`. The compiled output is never cached
between CI runs.

**Impact**
Minor: each CI run re-compiles TypeScript unnecessarily.

**Solution**
Consider caching `./out/` keyed on the TypeScript source hash, or use
`actions/cache@v4` to cache `node_modules/` so that `npm ci` is faster.

**Files**
`.github/workflows/test.yml`

---

### [P3] No auto-merge or Dependabot configuration

**Problem**
There is no Dependabot or Renovate configuration to keep dependencies updated automatically.

**Impact**
Security patches and new compatible releases are missed until manually bumped.

**Solution**
Add `.github/dependabot.yml` with npm ecosystem updates on a weekly schedule:

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
```

**Files**
`.github/dependabot.yml` *(new file)*

---

## Docker & Deployment

### [P1] Use a multi-stage build to separate test environment from runtime image

**Problem**
The single-stage Dockerfile installs all dependencies (including devDependencies) and copies all
source files into the final image. The resulting image is used only for running tests, not for
production deployment, but the size is unnecessarily large.

**Impact**
Bloated image; longer pull times; unnecessary tools in the container attack surface.

**Solution**
Use a multi-stage build:

```dockerfile
FROM node:20-slim AS deps
WORKDIR /usr/pkg
COPY package*.json ./
RUN npm ci

FROM node:20-slim AS test
WORKDIR /usr/pkg
COPY --from=deps /usr/pkg/node_modules ./node_modules
COPY . .
RUN groupadd --gid 1001 appgroup && useradd --uid 1001 --gid appgroup --shell /bin/sh appuser
USER appuser
CMD ["npm", "run", "docker:test"]
```

**Files**
`Dockerfile`

---

### [P1] Use a slim or minimal base image

**Problem**
The Dockerfile uses `node:20` (the full Debian image, ~950 MB) instead of `node:20-slim` or
`node:20-alpine`.

**Impact**
Large image size increases pull times, storage costs, and attack surface.

**Solution**
Switch to `node:20-slim` (typically ~200 MB). Only switch to `alpine` after verifying that all
pure-JavaScript dependencies work without glibc.

**Files**
`Dockerfile`

---

### [P2] `.dockerignore` does not exclude `Dockerfile` and source map / config files

**Problem**
`.dockerignore` excludes `node_modules`, `test-results`, `coverage`, `out`, `.vscode`, `.github`,
and `.devcontainer`, but not `Dockerfile` itself, `tsconfig.json`, `eslint.config.mjs`,
`vitest.config.mjs`, `.prettierrc`, `.prettierignore`, or `*.md` files.

**Impact**
Unnecessary files included in the image increase build context size and cache invalidation
frequency.

**Solution**
Add the following to `.dockerignore`:

```
dockerfile
Dockerfile
*.md
*.log
.prettierrc
.prettierignore
eslint.config.mjs
vitest.config.mjs
tsconfig.json
comparePdfOutput
```

**Files**
`.dockerignore`

---

### [P2] No `HEALTHCHECK` directive in the Dockerfile

**Problem**
The Dockerfile has no `HEALTHCHECK` instruction. Docker and orchestrators such as Kubernetes rely on
health checks to determine container readiness.

**Impact**
Without a health check, a container that starts but immediately fails will appear healthy to
orchestrators.

**Solution**
For a test-runner image this is less critical, but adding a minimal check is good practice:

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --retries=3 CMD node --version || exit 1
```

**Files**
`Dockerfile`

---

### [P3] No `docker-compose.yml` for reproducible local test execution

**Problem**
There is no `docker-compose.yml`. Contributors must know the exact `docker run` command (including
volume mounts) to reproduce Docker-based test runs.

**Impact**
Higher onboarding friction; inconsistent local Docker runs.

**Solution**
Add a `docker-compose.yml`:

```yaml
version: '3.9'
services:
  test:
    build: .
    volumes:
      - ./test-results:/usr/pkg/test-results
```

**Files**
`docker-compose.yml` *(new file)*

---

### [P3] Dockerfile does not set `NODE_ENV`

**Problem**
No `ENV NODE_ENV=test` is set in the Dockerfile. Some Node.js libraries (and `npm` itself) alter
their behavior based on this variable.

**Impact**
Inconsistent behavior between Docker and local test runs if `NODE_ENV` differs.

**Solution**
Add `ENV NODE_ENV=test` to the Dockerfile.

**Files**
`Dockerfile`

---

## Developer Experience

### [P2] No `.nvmrc` or `.node-version` file

**Problem**
The repository specifies `"node": ">=20"` in `engines` but provides no `.nvmrc` or `.node-version`
file to automatically select the correct Node.js version.

**Impact**
Contributors without the right Node.js version may encounter subtle issues; no tooling hint for
`nvm use`.

**Solution**
Add `.nvmrc` containing `20` (or the specific LTS version used in CI):

```
20
```

**Files**
`.nvmrc` *(new file)*

---

### [P2] No VS Code recommended extensions or settings

**Problem**
There are no `.vscode/extensions.json` or `.vscode/settings.json` files.

**Impact**
Contributors using VS Code must manually configure ESLint, Prettier, and TypeScript integrations.

**Solution**
Add `.vscode/extensions.json` recommending `dbaeumer.vscode-eslint`, `esbenp.prettier-vscode`, and
`ms-vscode.vscode-typescript-next`, and `.vscode/settings.json` enabling format-on-save with
Prettier.

**Files**
`.vscode/extensions.json` *(new file)*, `.vscode/settings.json` *(new file)*

---

### [P3] No pre-commit hook to enforce lint and formatting

**Problem**
There is no `husky` + `lint-staged` (or equivalent) configuration to run ESLint and Prettier
automatically before commits.

**Impact**
Lint or formatting violations can enter the repository and are only caught during the full `npm test`
pipeline.

**Solution**
Add `husky` and `lint-staged`:

```json
"lint-staged": {
    "*.ts": ["eslint --fix", "prettier --write"],
    "*.{json,md}": ["prettier --write"]
}
```

**Files**
`package.json`, `.husky/pre-commit` *(new file)*

---

### [P3] Missing `keywords` coverage for npm discoverability

**Problem**
`package.json` keywords do not include `typescript`, `testing`, `visual-diff`, or `node`, which are
common search terms for this type of library.

**Impact**
Reduced discoverability on npm.

**Solution**
Add relevant keywords to `package.json`:

```json
"keywords": ["pdf", "pdf regression", "pdf test", "pdf compare", "compare pdf", "pdf diff",
             "visual regression", "typescript", "testing", "visual-diff", "node"]
```

**Files**
`package.json`
