# Backlog

> **Agent Rules:** Keep descriptions brief. When a task is completed, REMOVE it from here and APPEND it to BACKLOG-ARCHIVE.md.

## 🔒 Security

_None — see BACKLOG-ARCHIVE.md._

## 🏛️ Architecture (Deepening)

- [ ] 🟠 ARCH: Collapse `diffOutputGuards.ts` 7-function toolkit into one `runWithStagedDiffOutput(diffFilePath, diffsOutputFolder, fn)` seam — caller stops co-authoring the 5-step TOCTOU staging protocol from `comparePlannedPage.ts:44-83`. Keep `validateDiffsOutputFolder` separate (config-time, different lifecycle).
