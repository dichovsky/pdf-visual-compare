# Backlog

> **Agent Rules:** Keep descriptions brief. When a task is completed, REMOVE it from here and APPEND it to BACKLOG-ARCHIVE.md.

## 🔒 Security

_None — see BACKLOG-ARCHIVE.md._

## 🏛️ Architecture (Deepening)

- [ ] 🟠 ARCH: Collapse `diffOutputGuards.ts` 7-function toolkit into one `runWithStagedDiffOutput(diffFilePath, diffsOutputFolder, fn)` seam — caller stops co-authoring the 5-step TOCTOU staging protocol from `comparePlannedPage.ts:44-83`. Keep `validateDiffsOutputFolder` separate (config-time, different lifecycle).
- [ ] 🟡 ARCH: Hide prefetched-vs-on-demand rendering protocol behind a `RenderingSession` seam returned by `renderPdfPages` — exposing `getRenderedPage(pageNumber)` collapses the ~20-line branching block in `comparePdf.ts:90-131` (incl. `resolvePlannedPage`/`isRenderedPngPageOutput`) into one call.
- [ ] 🟢 ARCH: Delete unused `buildPageComparisonPlan` in `pageComparisonPlan.ts:4-18` and its sole test (`__tests__/15.internal.page-comparison-plan.test.ts`) — zero production callers, extracted-for-testability only.
