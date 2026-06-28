# Feature Audit — `pdf-diff` → `pdf-visual-compare`

> **What this is:** a one-time feasibility audit of every feature in
> [`jamesmontemagno/pdf-diff`](https://github.com/jamesmontemagno/pdf-diff) (v1.0.4), scored for whether it
> can/should be incorporated into **this** library (`pdf-visual-compare` v4.0.0).
>
> **Status:** analysis only — no code changes proposed here, no `BACKLOG.md` edits. Verdicts are advisory.
> **Date:** 2026-06-26.

---

## 1. TL;DR — two different animals

| | **pdf-diff** (Montemagno) | **pdf-visual-compare** (this repo) |
|---|---|---|
| Form | React web app **+ `npx` CLI product** | Focused npm **library** |
| Diff engine | **Text** diff (`jsdiff` over extracted text) | **Pixel/visual** diff (render → PNG → `png-visual-compare`) |
| Output | HTML/PDF reports, JSON/JUnit/text, view modes, themes | `boolean` / structured `ComparePdfDetailedResult` |
| Audience | End users in a browser / CI | Test suites importing a function |

Because the two projects use **different comparison paradigms** (text vs. pixels) and **different delivery
forms** (app vs. library), most of pdf-diff's headline features are either UI-bound or belong to a different
engine and do **not** transfer. The genuinely portable ideas are a smaller set, summarized as the Adopt list
below.

**Adopt shortlist (highest value / lowest cost first):**

1. Per-page **change percentage** in the detailed result (cheap; derived from data we already compute).
2. **Page-range selection** (`pages: "1-3,5,7"`).
3. **CI output formats** — JUnit XML + JSON serialization of the existing detailed result.

Everything else is either an Adapt (valuable but a larger, optional effort) or a Reject (different paradigm or
pure web UI) — see the tables.

---

## 2. Methodology

- **Lens — value-first.** When a feature is useful but stretches the "pure pixel-diff library" identity, it
  leans **Adopt/Adapt** rather than reject-on-identity. Identity is a tie-breaker, not a veto.
- **Audiences — weighted equally:** (a) CI/test pipelines, (b) test-code authors importing the function,
  (c) humans reviewing diffs.
- **Verdict definitions:**
  - **Adopt** — fits the existing pixel-diff engine and API surface cleanly; net-new value with contained cost.
  - **Adapt** — valuable, but requires reshaping to fit a Node pixel-diff library (new surface, new dependency,
    or non-trivial build). Recommended, but as a deliberate separate effort.
  - **Reject** — not applicable here: a different comparison paradigm, a pure web-UI concern, or already
    inherent in the library.
- **Effort scale** — S (hours), M (a focused day or two), L (multi-day, new subsystem).
- **Ground truth checked in this repo (not assumed):**
  - `comparePdfDetailed()` already returns per-page `mismatchCount`, `threshold`, `status`, `diffFilePath`
    (`src/types/ComparePdfPageResult.ts`) — so "statistics" is mostly **serialization/derivation**, not new
    computation.
  - The comparison threshold (`ComparePdfOptions.compareThreshold`) is an **absolute differing-pixel count**,
    not a percentage — pdf-diff's `-t` is a **percentage**. This is a real ergonomic gap, not a duplicate.
  - The pipeline already **plans then renders per page** (sequential `pdfToPng` is a hard constraint), so a
    page-range filter slots in at the planning stage without touching the rendering-safety model.

---

## 3. Verdict tables

### 3.1 ADOPT — fits the engine, net-new value

| Feature in pdf-diff | How it maps onto this library | Effort | New deps | Risk | Serves |
|---|---|---|---|---|---|
| Statistics / **change %** | Derive per-page `%` and a document-level summary from existing `mismatchCount` ÷ total page pixels; add to `ComparePdfPageResult` / `ComparePdfDetailedResult` | **S** | none | Low — additive, backward-compatible | all three |
| **Page-range selection** (`-p 1-3,5,7`) | New `pages?: string \| number[]` option parsed into the page-comparison plan; ignore pages outside the spec | **M** | none | Low — filter at planning; respects sequential render | test authors, CI |
| **CI output formats** — JUnit XML + JSON | Serialize `ComparePdfDetailedResult` to JSON and a JUnit `<testsuite>` (one `<testcase>` per page) | **S–M** | none (hand-rolled XML) | Low | CI |

### 3.2 ADAPT — valuable, but a deliberate reshaping effort

| Feature in pdf-diff | Reshape required | Effort | New deps | Risk | Serves |
|---|---|---|---|---|---|
| **CLI wrapper** `npx pdf-visual-compare` (+ `--fail-on-diff` exit codes, `--out`, `--pages`, `--format`) | Thin CLI over the existing engine; add a `bin` entry + arg parser. The engine stays a library; the CLI is a new published surface | **M** | `commander` (or hand-rolled) | Medium — new public surface, packaging/`files` changes, version-support burden | CI, reviewers |
| **HTML visual-diff report** (actual / expected / diff PNGs side-by-side + per-page stats) | The *visual* analog of pdf-diff's text report. Reuse PNGs we already render + diff PNGs we already write; assemble a static self-contained HTML | **M–L** | none if HTML hand-rolled | Medium — new output mode, asset embedding | reviewers |
| **Percentage threshold** (`-t <float>`) | Optional percentage mode *alongside* the current absolute-pixel-count threshold (don't replace it) | **S–M** | none | Low–Medium — must keep both modes unambiguous | all three |
| `--open` report in browser | Open the generated HTML report after a run | **S** | `open` | Low | reviewers |

### 3.3 REJECT — not applicable here

| Feature in pdf-diff | Why not here |
|---|---|
| **Text-based diff engine** (`jsdiff`: additions/removals/changes) | Different comparison **paradigm**. This library is pixel/visual by mission; adopting text diff means building a second product, not incorporating a feature. |
| **Web view modes** — side-by-side, unified, additions-only, removals-only, changes-only, page navigation, show-all-pages | Browser-rendering UI concerns. The *side-by-side concept* survives **only** inside the HTML-report Adapt item; the React views themselves have no place in a library. |
| **Themes** (dark / light / system) | UI-only. At most a styling detail of an HTML report, not a library feature. |
| **Responsive design, drag & drop, real-time processing, "clean interface"** | Web-app UX. No analog in a Node library API. |
| **Interactive mode** (`-i`, `inquirer`) | Contradicts the automation/CI focus; heavy dependency, low value for a test/CI library. |
| **Export-to-PDF report** (`jsPDF`) | Heavy dependency for a niche output; the HTML report (Adapt) already covers "shareable visual report." Reconsider only if a PDF artifact is explicitly demanded. |
| **Privacy / client-side / offline / no-uploads** | **Already inherent** — this is a local Node library with no network I/O. Nothing to add; it is a marketing point for a web app, not a feature gap here. |

---

## 4. Per-feature detail (Adopt & Adapt)

### 4.1 Change percentage / statistics — ADOPT
pdf-diff surfaces a "statistics dashboard" and a `-t` percentage. This library already computes the raw signal
(`mismatchCount` per page) but only exposes the absolute count. Adding a derived `mismatchPercent` per page and
a document-level rollup (pages compared, pages over threshold, max/avg %) is a small, backward-compatible
enrichment of `ComparePdfDetailedResult`. It also unblocks the percentage-threshold Adapt item and the
JUnit/JSON Adopt item (both want a normalized number). **Lowest cost, broadest benefit — do this first.**

### 4.2 Page-range selection — ADOPT
pdf-diff's `-p 1-3,5,7` restricts comparison to selected pages. This library currently compares all rendered
pages. A `pages` option parsed into the existing page-comparison plan filters which pairs get rendered/compared.
It fits the existing "plan first, then render per page" architecture and the sequential-render constraint
(filtering happens before rendering). Useful for large documents and for re-running a single failing page.

### 4.3 CI output formats (JUnit + JSON) — ADOPT
pdf-diff offers `-f text|json|junit`. This library already returns a structured result; the work is
**serialization**, not computation. JSON is a direct dump of `ComparePdfDetailedResult`. JUnit maps one
`<testcase>` per page (failure = over threshold, with `mismatchCount`/percent in the message), which lets CI
systems render PDF regressions as test results. No new dependency required.

### 4.4 CLI wrapper — ADAPT
A `npx pdf-visual-compare actual.pdf expected.pdf` wrapper with `--fail-on-diff` (exit code), `--out`,
`--pages`, `--format`, and `--threshold`. High value for CI and ad-hoc reviewer use, and it composes the three
Adopt items into one entry point. It is **Adapt, not Adopt**, because it adds a new published surface (`bin`,
`files`, packaging/artifact tests) and a dependency, plus an ongoing version-support burden — a deliberate
decision, not a free add-on. Keep the engine a pure library; the CLI is a thin shell over it.

### 4.5 HTML visual-diff report — ADAPT
The visual analog of pdf-diff's text report: a self-contained HTML page showing, per page, the actual /
expected / diff PNGs side-by-side with the page's stats. The inputs already exist (rendered PNGs + diff PNGs
this library writes when `writeDiffs` is on); the work is assembling and embedding them. This is where the
rejected "side-by-side / view modes" concept legitimately reappears — as a static report, not a React UI.
Largest of the Adapt items; do it after the CLI exists so it has a natural invocation point.

### 4.6 Percentage threshold — ADAPT
pdf-diff thresholds on **percentage of change**; this library thresholds on **absolute differing-pixel count**.
Both are legitimate. Offer an optional percentage mode *in addition to* the existing pixel count (never replace
it — that would be a breaking change and would lose precision for pixel-perfect callers). Depends on the
change-% Adopt item for the normalized number.

### 4.7 `--open` in browser — ADAPT
Convenience: open the generated HTML report after a CLI run. Only meaningful once both the CLI and the HTML
report exist; small effort, one light dependency (`open`).

---

## 5. Suggested sequencing (non-binding)

If any of this is ever built, cheapest-high-value first, respecting dependencies:

1. **Change % / stats enrichment** (Adopt, S) — unblocks #3 and #5.
2. **Page-range selection** (Adopt, M) — independent, high utility.
3. **JUnit + JSON output** (Adopt, S–M) — depends on #1 for the normalized number.
4. **CLI wrapper** (Adapt, M) — composes #2 and #3 into one entry point.
5. **HTML visual-diff report** (Adapt, M–L) — depends on #1; natural to invoke from #4.
6. **Percentage threshold** (Adapt, S–M) — depends on #1; pairs naturally with #4's `--threshold`.
7. **`--open`** (Adapt, S) — depends on #4 and #5.

> Items 1–3 are the realistic "incorporate without changing what the library is" set. Items 4–7 move the
> project toward pdf-diff's product shape and should each be a conscious scope decision.
