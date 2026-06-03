# Contributing

Thanks for contributing to `pdf-visual-compare`.

This guide is intentionally tied to the repository's current scripts, CI workflows, and release process so you can set up, validate, and submit changes without needing extra context.

## Prerequisites

- Node.js 24 (`.nvmrc`)
- npm
- Docker (optional, for Linux-parity test runs)
- macOS or Linux for local development

The package declares `node >=24`, and this repository's local and CI default is Node 24.

## Clone and install

```sh
git clone https://github.com/dichovsky/pdf-visual-compare.git
cd pdf-visual-compare
npm ci
```

## Project layout

- `src/` — library source
- `__tests__/` — Vitest coverage for public behavior and regressions
- `test-data/` — checked-in PDF fixtures
- `out/` — build output and published package contents
- `.github/workflows/` — CI and release automation

## Canonical validation commands

Use the repository scripts instead of ad hoc commands.

```sh
npm run clean          # Remove build and test artifacts
npm run build          # Clean + compile TypeScript to ./out
npm run lint           # ESLint
npm run lint:fix       # ESLint with auto-fix
npm run test:license   # Validate allowed production dependency licenses
npm run test:types     # Type-check all repo TypeScript, including the published-surface fixture
npm run test:artifacts # Verify exports and npm pack contents from ./out
npm test               # Full validation pipeline + Vitest coverage
npm run test:docker    # Build Docker image and run tests in the container
```

### What `npm test` covers

`npm test` is the main pre-PR validation command. It runs:

1. `npm run clean`
2. `npm run lint`
3. `npm run test:license`
4. `npm run build`
5. `npm run test:types`
6. `npm run test:artifacts`
7. `vitest run --coverage`

If you only run one command before opening a PR, run `npm test`.

## Fast local iteration

For faster feedback while developing:

```sh
npm run build
npx vitest run
npx vitest run __tests__/1.compare.equal.pdf.files.test.ts
```

Run `npm run build` first when you need `./out/` to be current for type or artifact checks.

## Docker workflow

Docker is used for local Linux-parity validation.

```sh
npm run docker:build
npm run docker:run
# or
npm run test:docker
```

Notes:

- `npm run test:docker` is the single supported local entry point for the Docker test path.
- `docker:run` mounts `./test-results` into the container.
- `predocker:run` prepares that directory automatically.
- `docker:run` relies on the POSIX shell `$PWD` environment variable and is supported on macOS/Linux shells only.
- Use Docker when you want a clean containerized test run close to the Ubuntu CI environment.

## Contributor expectations

### Before you open a pull request

- Keep changes scoped to the task.
- Update docs when public API, validation behavior, or workflows change.
- Add or update tests for behavior changes.
- Run `npm test` locally for code changes.
- Run `npm run test:docker` when a change could behave differently on Linux or depends on filesystem/process behavior.

### When touching public API or validation behavior

Please keep these surfaces aligned:

- runtime behavior in `src/`
- README examples and option descriptions
- emitted package surface from `./out/`
- type-level validation checked by `npm run test:types`
- artifact/export verification checked by `npm run test:artifacts`

This is especially important for typed errors, input/path-boundary rules, and exported types.

### Tests and fixtures

- Put automated tests in `__tests__/`.
- Reuse fixtures from `test-data/` when possible.
- Keep generated artifacts under `test-results/` or `comparePdfOutput/`; both are disposable.

## CI expectations

GitHub Actions runs on pushes and pull requests.

Current CI behavior:

- `test.yml` runs on `ubuntu-24.04` and `macos-15`
- CI installs dependencies with `npm ci`
- CI runs `npm run lint`
- CI runs `npm run test:license`
- CI runs `npm test`

Because `npm test` already includes build, consumer type verification, artifact verification, and coverage, contributors should treat it as the canonical local check before asking for review.

### Required status checks for merges to `main`

Pull requests targeting `main` must pass these required GitHub status checks before merge:

- `test (ubuntu-24.04)`
- `test (macos-15)`

These are the exact matrix job check names produced by the `CI` workflow in `.github/workflows/test.yml`.
The release-only `Publish Package` workflow is not part of the merge gate for `main`.

If the CI workflow job names or matrix values change, update this document and the `main` branch
protection required-check list together so the documented policy matches repository settings.

## Release expectations

Publishing is automated from `.github/workflows/publish.yml`.

Current release flow:

1. GitHub Release is published
2. workflow runs `npm ci`
3. workflow runs `npm run prepublishOnly` (which maps to `npm test`)
4. workflow runs `npm publish --ignore-scripts --provenance`

That means a release must pass the same validation pipeline used for normal development before it is published.

## Pull request guidance

A good PR description should include:

- what changed
- why it changed
- any API or behavior impact
- how you validated it locally
- whether docs/tests were updated

If your change affects comparison semantics, rendering constraints, path validation, exported types, or error classes, call that out explicitly in the PR.
