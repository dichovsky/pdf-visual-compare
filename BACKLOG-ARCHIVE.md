# Backlog Archive

> **Agent Rules:** Append completed tasks here. Add Impl: (Implementation details) and Rat: (Rationale/Why).

## 🔒 Security

- [x] 🔴 🐛 SEC: TOCTOU symlink swap bypasses `allowedInputRoot` (arbitrary file read)
    - **Impl:** `O_NOFOLLOW` on input fd open closes the `realpathSync`→`statSync`→`openSync` race (PR #48).
    - **Rat:** Attacker could swap the input path with a symlink after canonicalization, redirecting reads to files outside the sandbox (e.g. `/etc/passwd`).
- [x] 🔴 🐛 SEC: TOCTOU symlink at diff leaf → arbitrary file write
    - **Impl:** Stage diff write to a tempfile inside the validated parent and atomically rename into place; pre-create leaf with `O_CREAT|O_EXCL|O_NOFOLLOW` (PR #48).
    - **Rat:** Symlink walker skipped the non-existent leaf, letting attackers plant a symlink between validation and `comparePng` write to clobber arbitrary files.
- [x] 🔴 🐛 SEC: Unvalidated `pdfToPngConvertOptions.outputFolder` → arbitrary write (sandbox parity gap vs `allowedInputRoot`/`diffsOutputFolder`)
    - **Impl:** New `validateRenderOutputFolder` mirrors the `diffsOutputFolder` contract — non-empty string, dir-if-exists, no symlinks on the leaf or any existing ancestor — and additionally takes library ownership of leaf-directory creation: the resolved folder plus the `actual/`/`expected/` namespace subdirectories are pre-created and re-asserted via `lstat` to be real directories. Invoked from `normalizeComparisonOptions` so the resolved path replaces the caller-supplied value before reaching `pdfToPng`.
    - **Rat:** Without this guard, an attacker who can plant a symlink under the configured `outputFolder` (or any of its ancestors) could redirect the renderer's intermediate PNG writes outside the intended workspace (CWE-59 / CWE-61). The post-mkdir `lstat` re-assertion closes the residual validate→render TOCTOU window (CWE-367) that the path walker alone cannot cover when the leaf is non-existent at validation time — an attacker could otherwise plant a symbolic link at the leaf after validation but before the renderer's first write.

## 🏛️ Architecture (Deepening)

- [x] 🟠 ARCH: Extract shared `securePath` seam — `isPathWithinRoot` was duplicated verbatim in `normalizePdfInput.ts` and `diffOutputGuards.ts`, and the symlink-rejection walker existed as a second adapter inside `diffOutputGuards.ts`.
    - **Impl:** New `src/internal/securePath.ts` owns `isPathWithinRoot`, `pathExistsWithoutFollowingSymlinks`, `assertPathIsNotSymbolicLink`, and `assertPathAndAncestorsAreNotSymbolicLinks`; both prior callers (and the new render-output validator) import from the seam.
    - **Rat:** Two drifting adapters were a real seam; consolidating the CWE-59 / CWE-61 symlink-swap defense in one module ensures future fixes (e.g. the next sandbox callsite) land in a single place.
