# TypeScript 7 Migration

## Goal

Use the TypeScript 7 native compiler for repository type-checking and package
builds, while preserving the TypeScript 6 compiler API that the codemap
generator and `typescript-eslint` still require.

## Constraints

- TypeScript 7.0 does not expose the legacy JavaScript compiler API. Its main
  export is `./lib/version.cjs`; everything else is published under `unstable/*`
  subpaths.
- `scripts/generate-codemap.ts` imports `typescript` and uses `createProgram`
  and the TypeChecker to build `CODEMAP.md`.
- `typescript-eslint` 8.x declares a peer range of `typescript >=4.8.4 <6.1.0`.
- TypeScript is a development dependency only. The published package exposes no
  TypeScript dependency, so the split toolchain affects development and CI only.

## Dependency layout

| `devDependencies` entry | Resolves to                      | Purpose                                                         |
| ----------------------- | -------------------------------- | --------------------------------------------------------------- |
| `@typescript/native`    | `typescript@~7.0.2`              | Native compiler used by `build` and `test:types`                |
| `typescript`            | `@typescript/typescript6@~6.0.2` | TypeScript 6 compiler API used by ESLint and the codemap script |

The compatibility package depends on `@typescript/old` (`npm:typescript@^6`),
which supplies the real TypeScript 6.0.3 implementation and the `tsserver`
binary. Binary names do not collide: the compatibility package publishes its own
compiler as `tsc6`, so a clean `npm ci` links `node_modules/.bin/tsc` to the
native compiler.

The `build` and `test:types` scripts nonetheless invoke the native compiler by
its full package path so compiler selection cannot drift with install history:

```sh
node ./node_modules/@typescript/native/bin/tsc --pretty -p ./tsconfig.prod.json
node ./node_modules/@typescript/native/bin/tsc --pretty -p ./tsconfig.json
```

Both ranges are tilde-pinned. A TypeScript 7 minor release can introduce new
type errors, and the compatibility package must stay inside the support window
that `typescript-eslint` declares.

## Source and configuration changes

None. `tsconfig.json` and `tsconfig.prod.json` type-check clean under
TypeScript 7 without modification, and no source file needed changes.

## Editor configuration

`.vscode/` is not tracked in this repository, so editor settings must be adjusted
locally. If your `.vscode/settings.json` sets
`"typescript.tsdk": "node_modules/typescript/lib"`, remove that entry. The path
now resolves to the compatibility package, whose `lib/` contains no
`tsserver.js`, so VS Code cannot start a workspace TypeScript service from it.
The native package ships no language server either — its editor support is a
separate extension. Without the setting, VS Code falls back to its bundled
TypeScript.

## Verification

Performed on 2026-07-29 with Node.js 24.18.0 and npm 12.0.1:

- Emitted output is byte-identical between TypeScript 6.0.3 and TypeScript 7.0.2.
  Both compilers built `tsconfig.prod.json` into separate directories; `diff -r`
  reported no differences across all 82 emitted files, and the `out/cli.js`
  shebang is preserved.
- `node_modules` was deleted and `npm ci` run from the regenerated lockfile:
  `typescript` resolves to `@typescript/typescript6@6.0.2`, `require('typescript').version`
  reports `6.0.3` with `createProgram` present, and the native compiler reports
  `Version 7.0.2`.
- `npm test` passed end to end: clean, lint, codemap check, license check,
  build, type check, artifact check, and Vitest with coverage thresholds.
- `npm pack --dry-run` passed with package contents limited to `out`.

### Installation note

A plain `npm install` after editing `package.json` retained the previously
locked `typescript@6.0.3` instead of substituting the compatibility alias. The
alias had to be installed explicitly:

```sh
npm install --save-dev "typescript@npm:@typescript/typescript6@~6.0.2"
```

A subsequent clean `npm ci` confirmed the corrected lockfile is reproducible.

## Follow-up

Reassess once TypeScript 7.1 provides a stable compiler API and
`typescript-eslint` declares support for it. At that point, try replacing both
aliases with a single plain `typescript@7` dependency, restore the plain `tsc`
invocations, and remove this compatibility layout if codemap generation,
linting, and the full test suite pass.

## Rollback

Remove `@typescript/native`, restore `typescript` to `~6.0.3`, revert the
`build` and `test:types` scripts to plain `tsc`, regenerate the lockfile, and
rerun the verification steps above.
