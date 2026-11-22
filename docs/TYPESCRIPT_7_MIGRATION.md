# TypeScript 7 Migration

## Goal

Use the TypeScript 7 native compiler for the type checks and the package build
of the repository. Keep the TypeScript 6 compiler API, because the codemap
generator and `typescript-eslint` still need it.

## Constraints

- TypeScript 7.0 does not have the legacy JavaScript compiler API. Its main
  export is `./lib/version.cjs`. All other exports are in `unstable/*`
  subpaths.
- `scripts/generate-codemap.ts` imports `typescript`. It uses `createProgram`
  and the TypeChecker to make `CODEMAP.md`.
- `typescript-eslint` 8.x declares a peer range of `typescript >=4.8.4 <6.1.0`.
- TypeScript is only a development dependency. The published package has no
  TypeScript dependency. Thus, the split toolchain has an effect only on
  development and CI.

## Dependency layout

| `devDependencies` entry | Resolves to                      | Purpose                                                         |
| ----------------------- | -------------------------------- | --------------------------------------------------------------- |
| `@typescript/native`    | `typescript@~7.0.2`              | Native compiler used by `build` and `test:types`                |
| `typescript`            | `@typescript/typescript6@~6.0.2` | TypeScript 6 compiler API used by ESLint and the codemap script |

The compatibility package uses `@typescript/old` (`npm:typescript@^6`).
`@typescript/old` gives the real TypeScript 6.0.3 implementation and the
`tsserver` binary. The binary names do not collide. The compatibility package
publishes its compiler as `tsc6`. Thus, a clean `npm ci` links
`node_modules/.bin/tsc` to the native compiler.

But the `build` and `test:types` scripts run the native compiler by its full
package path. Thus, the selected compiler does not change with the install
history:

```sh
node ./node_modules/@typescript/native/bin/tsc --pretty -p ./tsconfig.prod.json
node ./node_modules/@typescript/native/bin/tsc --pretty -p ./tsconfig.json
```

Both ranges use a tilde (`~`) pin for these reasons:

- A TypeScript 7 minor release can cause new type errors.
- The compatibility package must stay in the version range that
  `typescript-eslint` supports.

## Source and configuration changes

None. `tsconfig.json` and `tsconfig.prod.json` type-check with no errors in
TypeScript 7 without changes. No source file needed changes.

## Editor configuration

This repository does not track `.vscode/`. Thus, you must change the editor
settings locally.

If your `.vscode/settings.json` sets
`"typescript.tsdk": "node_modules/typescript/lib"`, remove that entry. That path
now resolves to the compatibility package. The `lib/` folder of that package does not
contain `tsserver.js`. Thus, VS Code cannot start a workspace TypeScript service
from that path.

The native package also does not include a language server. Its editor support
is a separate extension. Without the setting, VS Code uses its bundled
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

Examine this layout again when these two conditions are true:

- TypeScript 7.1 has a stable compiler API.
- `typescript-eslint` declares support for that API.

Then do these steps:

1. Try to replace the two aliases with one plain `typescript@7` dependency.
2. Change the scripts back to plain `tsc` commands.
3. If codemap generation, linting, and the full test suite pass, remove this
   compatibility layout.

## Rollback

1. Remove `@typescript/native`.
2. Change `typescript` back to `~6.0.3`.
3. Change the `build` and `test:types` scripts back to plain `tsc`.
4. Make the lockfile again.
5. Do the verification steps above again.
