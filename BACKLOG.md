# Security Backlog — CTF Vulnerability Hunt

> Iteration tracker: **3 of 3 complete** · Loop stopped.

---

## VULN-001 · TOCTOU bypass of `allowedInputRoot` via post-resolve symlink swap

**Severity:** HIGH (sandbox bypass — arbitrary file read)
**Component:** `src/internal/normalizePdfInput.ts`
**Discovered:** iteration 1

### Summary
The `allowedInputRoot` option promises to constrain string PDF inputs to a configured workspace directory. The validation uses `realpathSync` to canonicalize the path, then `statSync` + `openSync` to read the file. The dev/ino TOCTOU defense only protects the window **between** `statSync` and `openSync`. An attacker with write access inside `allowedInputRoot` can swap the file with a symlink **after** `realpathSync` but **before** `statSync`, and the read will succeed against a target outside the sandbox.

### Vulnerable code (`src/internal/normalizePdfInput.ts:25-55`)

```typescript
if (typeof inputFile === 'string') {
    const resolvedInputPath = resolve(inputFile);
    assertStringPathWithinAllowedInputRoot(resolvedInputPath, inputLabel, allowedInputRoot);
    let inputFileDescriptor: number | undefined;

    try {
        const canonicalInputPath = realpathSync(resolvedInputPath);             // (1) T0
        assertStringPathWithinAllowedInputRoot(canonicalInputPath, ...);        // (2) passes
        const canonicalInputStats = statSync(canonicalInputPath);               // (3) follows symlink!
        if (!canonicalInputStats.isFile()) { throw ... }
        inputFileDescriptor = openSync(canonicalInputPath, 'r');                // (4) follows symlink!

        if (allowedInputRoot) {
            const openedInputStats = fstatSync(inputFileDescriptor);
            if (openedInputStats.dev !== canonicalInputStats.dev ||
                openedInputStats.ino !== canonicalInputStats.ino) {              // (5) match → no error
                throw new ComparePdfConfigurationError(...);
            }
        }
        return readFileSync(inputFileDescriptor);                                // (6) leaks target
```

### Exploit timeline (race scenario A)

1. T0 — `realpathSync('/uploads/user.pdf')` → `/uploads/user.pdf` (regular file at this moment).
2. T1 — `assertStringPathWithinAllowedInputRoot` passes.
3. **T2 — attacker (same untrusted user) replaces `/uploads/user.pdf` with a symlink → `/etc/passwd`.**
4. T3 — `statSync` follows the symlink, returns stats for `/etc/passwd`, `isFile()` is true.
5. T4 — `openSync` follows the symlink, opens `/etc/passwd`.
6. T5 — `fstatSync(fd).dev/ino` equals `canonicalInputStats.dev/ino` (both describe `/etc/passwd`) → defense does NOT trigger.
7. T6 — `readFileSync(fd)` returns the contents of `/etc/passwd`.

The dev/ino defense only catches a swap that happens **between** steps (3) and (4) — it cannot detect a swap that happens **before** (3) because both stat calls observe the post-swap target.

### Impact
- Read of any file the host process can access — defeats the documented `allowedInputRoot` sandbox.
- The bytes are passed to `pdfToPng`, which will throw on non-PDF content, but the read has already occurred. Depending on how `ComparePdfRenderingError` surfaces the cause to callers (and any logging hooks), partial bytes may be observable to the attacker as a side channel.
- Even without leak-back, on hostile filesystems this lets an attacker force the process to read files it must not touch (e.g., `/proc/self/environ`, secrets in mounted volumes).

### Preconditions
- `allowedInputRoot` is configured (this is the only mode the bug undermines; without it, the API explicitly trusts string paths).
- Attacker can race writes inside `allowedInputRoot` (typical for upload directories shared with untrusted users).

### Suggested fix (any one is sufficient)
1. **`O_NOFOLLOW` at open** — `openSync(canonicalInputPath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW)`. Refuses to open if the final component is a symlink, eliminating both race windows.
2. **`lstatSync` before stat** — after `realpathSync`, call `lstatSync(canonicalInputPath)` and reject if `isSymbolicLink()`. Re-check that `lstat`'s dev/ino equal `fstatSync(fd)` to close the residual window.
3. **Re-canonicalize after open** — call `realpathSync(canonicalInputPath)` a second time after the open and confirm it equals the first canonical path and is still within `allowedInputRoot`.

Option 1 is the smallest diff and matches what `assertPathAndExistingAncestorsAreNotSymbolicLinks` does for the diff side of the API.

### Suggested regression test
Add a test that:
- Creates `tmpRoot/safe.pdf` as a real PDF copy.
- Configures `allowedInputRoot: tmpRoot`.
- Monkey-patches `realpathSync` (or uses a real race via `fs.promises.rename` in a tight loop) so that, after the first `realpathSync` call returns, `safe.pdf` is replaced by a symlink to `/etc/passwd`.
- Asserts that `comparePdf` throws a `ComparePdfConfigurationError` rather than reading the target.

### References
- CWE-367: Time-of-check Time-of-use (TOCTOU) Race Condition
- CWE-59: Improper Link Resolution Before File Access ('Link Following')

---

## VULN-002 · TOCTOU bypass of `diffsOutputFolder` symlink defenses → arbitrary file write

**Severity:** HIGH (sandbox bypass — arbitrary file write/overwrite when diffs are enabled)
**Component:** `src/internal/comparePlannedPage.ts` + `src/internal/diffOutputGuards.ts`
**Discovered:** iteration 2

### Summary
When `writeDiffs: true`, the library carefully checks that the resolved `diffFilePath` and every existing ancestor segment is **not** a symlink, then re-runs the check after `mkdir -p`, then canonicalizes the parent directory. After all checks pass, the diff PNG is written by `png-visual-compare`'s `comparePng`. The final segment is intentionally skipped by the symlink walker because the diff file does not yet exist — and there is no atomic open or `O_NOFOLLOW` between the last check and the actual write. An attacker who can write inside `diffsOutputFolder` (or any subdirectory of it) can win a small race window to plant a symlink at `diffFilePath`, redirecting the write to any path the host process can reach.

### Vulnerable call sequence (`src/internal/comparePlannedPage.ts:41-50`)

```typescript
if (diffFilePath) {
    assertDiffOutputPathUsesRealFilesystemEntries(diffFilePath, normalizedOptions.diffsOutputFolder); // (a) walk segments, lstat each existing one
    ensureDiffOutputDirectory(diffFilePath, normalizedOptions.diffsOutputFolder);                     // (b) mkdir -p dirname(diffFilePath)
    assertDiffOutputPathUsesRealFilesystemEntries(diffFilePath, normalizedOptions.diffsOutputFolder); // (c) re-walk after mkdir
    assertCanonicalDiffOutputPath(diffFilePath, normalizedOptions.diffsOutputFolder);                 // (d) realpath of parent dir only
}

let mismatchCount: number;
try {
    mismatchCount = comparePng(planEntry.actualPage.content, planEntry.expectedPage.content, comparePngOptions); // (e) writes to diffFilePath
```

And the walker (`src/internal/diffOutputGuards.ts:37-59`):

```typescript
for (const segment of relativeDiffPath.split(sep)) {
    currentPath = resolve(currentPath, segment);
    if (!pathExistsWithoutFollowingSymlinks(currentPath)) {
        return;                       // ← final segment usually does not exist yet → never lstat'd
    }
    assertPathIsNotSymbolicLink(currentPath, diffsOutputFolder);
}
```

### Exploit timeline
1. Attacker controls (or shares) `diffsOutputFolder`, e.g. a CI scratch dir or a multi-tenant `/tmp/diffs/<run-id>` path.
2. T0–T3 — all four guards run; `diffFilePath` does not exist yet, so the final-segment lstat is skipped (the walker `return`s when it hits a non-existent segment).
3. **T3 → T4** — attacker races `symlink('/etc/anything-writable', diffFilePath)` (or `/var/lib/<service>/state.json`, a sibling user's home dir, a CI artifact path, etc.).
4. T4 — `comparePng` opens `diffFilePath` with normal `fs.writeFileSync` semantics (`O_WRONLY|O_CREAT|O_TRUNC`), which **follows symlinks**, and writes the diff PNG bytes through the symlink to the attacker's target.

The race window between (d) and (e) is sub-millisecond, but a busy-loop replacing the file (`unlink` + `symlink`) wins reliably given enough invocations — and in CI scenarios the attacker only needs to win once to overwrite a state file, drop a `~/.ssh/authorized_keys`, or clobber a config the next pipeline step trusts. The library cannot rely on `png-visual-compare`'s open flags because that dependency is not documented to use `O_NOFOLLOW` — and even if it did today, that is an undocumented internal of a transitive dep, not a contractual guarantee of this library.

### Why the existing defenses miss this
- `assertPathIsNotSymbolicLink` is correct for **existing** path segments, but the diff file itself is intentionally created later by `comparePng`. The walker explicitly bails on the first non-existent segment, so the final segment is never lstat'd.
- `assertCanonicalDiffOutputPath` only `realpathSync`'s `dirname(diffFilePath)`. It deliberately ignores the file's last component. A symlink planted at the leaf passes this check trivially.
- The double-walk around `ensureDiffOutputDirectory` closes a narrower race on the **parent** directory but not on the **leaf**.

### Impact
- Arbitrary file overwrite under the privileges of the process running `comparePdf`. The written content is a binary PNG buffer — a corrupted/diff image — which is enough to:
  - Destroy CI artifacts, lockfiles, or coverage reports outside `diffsOutputFolder`.
  - Clobber config files into invalid PNG bytes (denial-of-service against any service that re-reads them).
  - Combined with predictable filenames (`diff_comparePdf_<page>.png`) and parallel test runs, this is exploitable in multi-tenant CI runners.
- Defeats the explicit symlink-walking defenses the library already ships, so the residual risk is silently mis-estimated by users who read the validation code.

### Preconditions
- `writeDiffs: true` (off by default, but on for any consumer that writes diffs for triage — common in test suites).
- Attacker has write access inside `diffsOutputFolder`. Per the README, this folder is "trusted" — but the library still spends real effort fighting symlinks, indicating the threat is in scope. The defenses just don't fully close the loop.
- For per-page `diffFilePath` override, the path the attacker needs to plant is predictable (caller-provided). For the auto-generated path, the leaf is `diff_<pageName>` where `<pageName>` follows the default mask `comparePdf_<pageNumber>.png` — also predictable.

### Suggested fix
Pre-create the diff file atomically inside the validated, canonicalized parent directory **before** calling `comparePng`, using `openSync(diffFilePath, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600)` then `closeSync`. This:

1. Refuses to follow a pre-existing symlink at the leaf (`O_NOFOLLOW`).
2. Refuses to use a pre-existing file at all (`O_EXCL`) — if it exists, abort.
3. Makes the leaf a real, non-symlink, attacker-not-owned regular file before any third-party code touches the path.

Then either:
- (a) Let `comparePng` open the existing file with `O_TRUNC` semantics (follows symlinks, but the leaf is now a real file, so safe), **and** re-lstat after the write to detect tampering during the write.
- (b) Better: open with `O_NOFOLLOW` ourselves, pass an `fs.WriteStream`/fd to `comparePng` if its API supports it. If not, file an upstream issue and use (a) as the interim mitigation.

Belt-and-suspenders: after `comparePng` returns, `lstatSync(diffFilePath)` must report `isFile()` and the same inode as the pre-created file. If not, unlink and throw `ComparePdfConfigurationError`.

### Suggested regression test
- Set `writeDiffs: true`, `diffsOutputFolder: tmpRoot`.
- Spawn a background worker that, in a tight loop, does `unlinkSync` + `symlinkSync('/tmp/poc-target', diffFilePath)`.
- Run `comparePdf` against two PDFs known to differ on page 1.
- Assert: `/tmp/poc-target` is **not** created, and `comparePdf` either succeeds with a real diff file or throws — never writes to the symlinked target.

### References
- CWE-367: Time-of-check Time-of-use (TOCTOU) Race Condition
- CWE-61: UNIX Symbolic Link (Symlink) Following
- CWE-732: Incorrect Permission Assignment for Critical Resource (when the write succeeds on a state file with looser perms than the diff folder)

---

## VULN-003 · Unvalidated `pdfToPngConvertOptions.outputFolder` breaks sandbox parity → arbitrary file write

**Severity:** MEDIUM (inconsistent sandbox surface — arbitrary file write in multi-tenant deployments)
**Component:** `src/internal/renderPdfPages.ts` + `src/internal/normalizeComparisonOptions.ts`
**Discovered:** iteration 3

### Summary
The library exposes three filesystem-side-effect options to callers:

| Option | Validated against absolute paths? | Validated against symlinks? | Symlink TOCTOU hardened? |
|---|---|---|---|
| `allowedInputRoot` (input reads) | Yes — input paths must resolve within it | Yes (`assertPathAndExistingAncestors…`) | Yes (after VULN-001 fix) |
| `diffsOutputFolder` (diff writes) | Yes — diff leaves must stay within it | Yes (`assertPathAndExistingAncestors…`, walker, canonical check) | Yes (after VULN-002 fix) |
| **`pdfToPngConvertOptions.outputFolder`** (intermediate PDF→PNG renders) | **No** | **No** | **No** |

`runPdfToPng` forwards the user-supplied `outputFolder` verbatim into `pdf-to-png-converter`, with the only transformation being `join(outputFolder, sourceLabel)` where `sourceLabel` is the hard-coded literal `'actual'`/`'expected'`. There is no path normalization, no absolute-path rejection, no symlink check anywhere in the path, no constraint to any sandbox, and no allowedInputRoot/`diffsOutputFolder` reuse. The rendering dependency then writes PNG files to whatever location the caller (or a downstream attacker controlling the option) supplied.

### Vulnerable code (`src/internal/renderPdfPages.ts:75-98`)

```typescript
async function runPdfToPng(
    pdfFile: PdfInput,
    pdfToPngConvertOpts: PdfToPngOptions,
    sourceLabel: 'actual' | 'expected',
): Promise<PngPageOutput[]> {
    try {
        const renderedPages = await pdfToPng(toRenderablePdfInput(pdfFile), {
            ...pdfToPngConvertOpts,
            outputFolder: pdfToPngConvertOpts.outputFolder
                ? join(pdfToPngConvertOpts.outputFolder, sourceLabel)  // ← only join, no validation
                : undefined,
        });
```

And the path that lets it reach this code unchecked (`src/internal/normalizeComparisonOptions.ts:104-119`):

```typescript
function validatePdfRenderOptions(pdfRenderOptions: ComparePdfOptions['pdfToPngConvertOptions']): void {
    if (pdfRenderOptions === undefined) {
        return;
    }
    if (pdfRenderOptions === null || typeof pdfRenderOptions !== 'object' || Array.isArray(pdfRenderOptions)) {
        throw new ComparePdfConfigurationError('pdfToPngConvertOptions must be an object.');
    }
    const unsupportedOptions = UNSUPPORTED_PDF_RENDER_OPTIONS.filter((optionName) => optionName in pdfRenderOptions);
    if (unsupportedOptions.length > 0) {
        throw new ComparePdfConfigurationError(/* parallel-rendering options banned */);
    }
}
```

Only `processPagesInParallel`/`concurrencyLimit`/etc. are rejected. `outputFolder`, `outputFileMaskFunc`, and `pdfFilePassword` flow through with **zero** path or content validation.

### Exploit timeline (confused-deputy scenario)

1. A consumer wraps `comparePdf` in a service exposed to untrusted clients — e.g. a SaaS that lets users diff their own PDFs for regression testing.
2. The wrapper carefully sets `allowedInputRoot: '/tenants/<id>/uploads'` and `diffsOutputFolder: '/tenants/<id>/diffs'`. Both are validated by the library against symlinks and arbitrary paths. The wrapper reasonably assumes filesystem isolation is complete.
3. Client submits a comparison request with `pdfToPngConvertOptions: { outputFolder: '/etc/cron.d', outputFileMaskFunc: () => 'evil.png' }`.
4. `comparePdf` accepts the options. `runPdfToPng` calls `join('/etc/cron.d', 'actual')` and hands the result to `pdf-to-png-converter`.
5. `pdf-to-png-converter` writes a PNG file to `/etc/cron.d/actual/evil.png` — under whatever uid the process runs as. In a Dockerized CI runner that is root (common for `pdf-to-png-converter`'s prebuilt-canvas requirements), this clobbers arbitrary system files.

A second variant uses `outputFolder: '/tenants/<other-id>/...'` to cross tenant boundaries even when the per-process user is locked down.

### Why this passes review unnoticed
- The README/JSDoc on `PdfRenderOptions.outputFolder` only says *"Folder path where intermediate PNG files are written."* — silent on whether the value is sanitized.
- The two siblings (`allowedInputRoot`, `diffsOutputFolder`) ship with thorough sandbox validation, which reads as the library's contract. The asymmetry on `pdfToPngConvertOptions.outputFolder` is invisible without reading the rendering code.
- Tests exercise the option for happy paths only (`__tests__/8.compare.with.custom.pdf.options.test.ts`) — no malicious or out-of-sandbox path is asserted to be rejected.

### Impact
- **Arbitrary file write** (PNG bytes) anywhere the host process can write, including:
  - System config dirs in containerized CI (`/etc/cron.d`, `/etc/ld.so.preload`, `/root/.ssh/`).
  - Other tenants' workspaces in shared CI runners.
  - Build-output directories the wrapper believes are isolated.
- **Sandbox escape** when the wrapper consumer trusts that the library's sandboxing applies uniformly. The library validates two of three filesystem-affecting options; the third silently leaks.

### Preconditions
- The consumer treats `comparePdf` options as untrusted input (multi-tenant or service deployment).
- The consumer's threat model assumes filesystem side effects are constrained because `allowedInputRoot` and `diffsOutputFolder` are validated.

Single-tenant CI usage (the library's primary use case) is unaffected — there the caller fully controls the option and the threat model is benign. But the option is part of the public API surface; nothing in the type system or docs warns consumers that exposing it to untrusted callers is unsafe.

### Suggested fix (in order of effort)
1. **Document the trust boundary.** Add a JSDoc note on `PdfRenderOptions.outputFolder` (and `pdfFilePassword`) stating: *"Treated as caller-controlled. NOT validated against `allowedInputRoot`/`diffsOutputFolder` and not constrained against symlinks or absolute paths. Do not expose this option to untrusted callers."* Mirror the wording already present on `diffsOutputFolder` so the asymmetry is visible.
2. **Reuse `diffsOutputFolder` as the sandbox root when set.** In `normalizeComparisonOptions`, when `pdfToPngConvertOptions.outputFolder` is provided alongside `diffsOutputFolder`, validate the former is within the latter via `assertPathWithinDiffsOutputFolder`-style logic. Apply the same symlink walker (`assertPathAndExistingAncestorsAreNotSymbolicLinks`) to it.
3. **Introduce a dedicated `allowedRenderOutputRoot` option** that mirrors `allowedInputRoot`'s constraint semantics for renderer output. Opt-in by callers who need it; backwards compatible.
4. **Reject absolute paths by default** when `allowedInputRoot` is set — that already signals the caller is operating in sandboxed mode, so the renderer's output folder being unconstrained is almost certainly an oversight.

Option 1 is a 5-minute documentation fix that closes the bug under "documented contract" semantics. Option 2 is the cleanest hardening — it reuses an existing trust boundary the user already opted into.

### Suggested regression tests
- With `diffsOutputFolder: tmpDiffs` and `pdfToPngConvertOptions.outputFolder: '../escape'`, assert `comparePdf` rejects the configuration with `ComparePdfConfigurationError` (after fix 2 or 3).
- With `pdfToPngConvertOptions.outputFolder` pointing inside a directory whose ancestor is a symlink, assert rejection (after fix 2 or 3).
- Update the API-surface tests to cover the documentation change (after fix 1).

### References
- CWE-22: Improper Limitation of a Pathname to a Restricted Directory ('Path Traversal')
- CWE-732: Incorrect Permission Assignment for Critical Resource
- CWE-441: Unintended Proxy or Intermediary ('Confused Deputy')

---

## Loop terminated

All 3 iterations complete. VULN-001 and VULN-002 have been fixed and merged via PR #48. VULN-003 is documentation/hardening — see suggested fixes for follow-up scope.

