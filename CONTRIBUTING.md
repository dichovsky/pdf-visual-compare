# Contributing

Thank you for your contribution to `pdf-visual-compare`.

This guide uses the scripts, CI workflows, and release process that the repository has now. With this guide, you can set up the repository, validate a change, and submit it. You do not need other information.

For the rules about prose in this repository, refer to the [writing guide](docs/WRITING_GUIDE.md).

## Prerequisites

- Node.js 26 (`.nvmrc`)
- npm
- Docker (optional, for test runs in a Linux container that is almost the same as CI)
- macOS or Linux for local development

## Clone and install

```sh
git clone https://github.com/dichovsky/pdf-visual-compare.git
cd pdf-visual-compare
npm ci
```

## Development tools

The build and type checks use the TypeScript 7 compiler that `npm ci` installs. Use the npm scripts to run the same tools as CI.

## Project layout

- `src/` — library source
- `__tests__/` — Vitest tests for public behavior and regressions
- `test-data/` — PDF fixtures in the repository
- `out/` — build output and the contents of the published package
- `.github/workflows/` — CI and release automation

## Canonical validation commands

Use the repository scripts, not ad hoc commands.

```sh
npm run clean          # Remove build and test artifacts
npm run build          # Clean + compile TypeScript to ./out
npm run lint           # Run Oxlint and fail on warnings
npm run lint:fix       # Apply Oxlint fixes
npm run format         # Format files with Oxfmt
npm run format:check   # Check formatting
npm run test:license   # Validate allowed production dependency licenses
npm run test:types     # Type-check all repo TypeScript, including the published-surface fixture
npm run test:artifacts # Verify exports and npm pack contents from ./out
npm test               # Full validation pipeline + Vitest coverage
npm run test:docker    # Build Docker image and run tests in the container
```

### What `npm test` covers

`npm test` is the main validation command before a pull request. It checks formatting, lint, and production dependency licenses. It also checks the build, consumer types, package artifacts, and test coverage.

## Fast local iteration

To get faster results while you develop, run these commands:

```sh
npm run build
npx vitest run
npx vitest run __tests__/1.compare.equal.pdf.files.test.ts
```

Run `npm run build` first when the type checks or the artifact checks need an up-to-date `./out/`.

## Docker workflow

The Docker workflow gives local validation in a Linux container that is almost the same as CI.

```sh
npm run docker:build
npm run docker:run
# or
npm run test:docker
```

Notes:

- `npm run test:docker` is the only supported local entry point for the Docker tests.
- `docker:run` mounts `./test-results` into the container.
- `predocker:run` prepares that folder automatically.
- `docker:run` uses the POSIX shell `$PWD` environment variable. Thus, it is supported only in macOS and Linux shells.
- Use Docker when you want a clean test run in a container. The container is almost the same as the Ubuntu CI environment.

## Contributor expectations

### Before you open a pull request

- Keep the changes in the scope of the task.
- Update the documentation when the public API, the validation behavior, or the workflows change.
- Add or update tests for changes to behavior.
- Run `npm test` locally for changes to code.
- Run `npm run test:docker` when a change can operate differently on Linux. Also run it when the behavior of a change depends on the file system or on processes.

### When touching public API or validation behavior

Keep these surfaces aligned:

- The runtime behavior in `src/`
- The README examples and option descriptions
- The package surface in `./out/`
- The type-level validation that `npm run test:types` does
- The artifact and export verification that `npm run test:artifacts` does

This alignment is most important for typed errors, rules for input paths and folder boundaries, and exported types.

### Tests and fixtures

- Put automated tests in `__tests__/`.
- When possible, use the fixtures that are in `test-data/`.
- Keep generated artifacts in `test-results/` or `comparePdfOutput/`. You can delete both folders at any time.

## CI expectations

GitHub Actions runs on pushes and pull requests.

CI behavior:

- `test.yml` runs one job on `ubuntu-24.04`.
- CI upgrades to `npm@latest` before it installs dependencies. `publish.yml` does the same upgrade before `prepublishOnly`. Thus, an npm version that breaks the release tooling causes a failure in CI, not only during a publish.
- CI installs dependencies with `npm ci`.
- CI runs `npm test`.

`npm test` includes the build, the consumer type verification, the artifact verification, and the coverage. Thus, we recommend that you use it as the canonical local check before you ask for a review.

### Required status checks for merges to `main`

Pull requests to `main` must pass these required GitHub status checks before a merge:

- `test`

This name is the exact check name of the job in the `CI` workflow in `.github/workflows/test.yml`.
The `Publish Package` workflow is only for releases. It is not part of the merge gate for `main`.

If the job names of the CI workflow change, update this file and the `main` required checks together.
Then the documented policy agrees with the repository settings.

A matrix in the job changes the check name. A matrix job reports as `test (<values>)`, not `test`.
Every pull request is then blocked without a message until you update the list of required checks.

## Release expectations

The `.github/workflows/publish.yml` workflow publishes the package automatically.

Release flow:

1. A GitHub Release is published.
2. The workflow runs `npm ci`.
3. The workflow runs `npm run prepublishOnly`, which runs `npm test`.
4. The workflow runs `npm publish --ignore-scripts --provenance`.

Thus, a release must pass the same validation pipeline as normal development before the workflow publishes it.

## Pull request guidance

We recommend that your pull request description include these items:

- What changed
- Why it changed
- Any effect on the API or the behavior
- How you validated it locally
- Whether you updated the documentation or the tests

If your change has an effect on one of these items, write that clearly in the pull request:

- Comparison semantics
- Rendering constraints
- Path validation
- Exported types
- Error classes
