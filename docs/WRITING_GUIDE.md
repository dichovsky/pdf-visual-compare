# Writing guide

This guide gives the rules for the prose in this repository. Use it when you write or change
documentation or public API doc comments.

## Standard and source

- Standard: ASD-STE100 Simplified Technical English (STE), Issue 9, January 2025.
- Source: the official specification from [asd-ste100.org](https://www.asd-ste100.org/STE_downloads.html).
  The specification is free of charge, but ASD does not permit redistribution. Do not add a copy
  of the specification or its dictionary to this repository.
- Verification level: words in the terminology table were checked against the Issue 9 dictionary.
  The other text was reviewed against the writing rules. This review is not a certification.

## Scope

These files follow this guide:

- `README.md`
- `CONTRIBUTING.md`
- This guide
- Public API doc comments in `src/comparePdf.ts`, `src/index.ts`, `src/types/`, `src/errors/`, and
  `src/serialize/`

These files do not follow this guide:

| File or text                                                           | Reason                                                                                  |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `CHANGELOG.md`, `BACKLOG-ARCHIVE.md`, `docs/pdf-diff-feature-audit.md` | Historical records. Do not change past entries.                                         |
| `LICENSE`                                                              | Legal text.                                                                             |
| `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`            | Agent instruction files. A separate change can migrate them.                            |
| Error messages, CLI help text, and report text                         | Runtime strings. Tests and callers can depend on the wording.                           |
| Quoted runtime strings in the documentation                            | Each quote must stay the same as the runtime string.                                    |
| `BACKLOG.md`                                                           | Its agent rule asks for brief descriptions. That repository rule has priority over STE. |

## Writing rules

### Sentences and paragraphs

- Write a maximum of 20 words in a procedural sentence.
- Write a maximum of 25 words in a descriptive sentence.
- Write one topic in a paragraph. Write a maximum of 6 sentences in a paragraph.
- Do not use semicolons. Write two sentences.
- Keep the articles "the", "a", and "an". Do not write in telegraphic style.
- Do not use idioms. Do not use a phrasal verb when a single verb has the same meaning.
- Do not use "it", "this", or "that" when the noun is not clear. Write the noun.

### Instructions

- Write instructions in the imperative.
- Write one instruction in a sentence. You can write two actions in one sentence only when they
  occur at the same time.
- Use the active voice in instructions. Use the active voice as much as possible in other text.
- Keep instructions separate from descriptive text.
- Use a vertical list for a sequence of steps, a set of conditions, or a set of options.
- Write a condition before the related instruction.

### Warnings and cautions

- Start a warning or a caution with a short command. Then give the reason.
- Do not make a hazard less serious, and do not remove a hazard.

### Words

- Use one word for one meaning. Use one word for one concept. Do not use synonyms for variety.
- Use the words in the terminology table.
- Use American English spelling, for example "color". Code identifiers keep their spelling.
- Keep the RFC 2119 keywords (MUST, SHOULD, MAY) where they occur. Do not add or remove them.
- The STE dictionary does not approve "should". For a recommendation, write "we recommend that
  you ...". Do not change a recommendation to "must", because "must" makes it mandatory.

### Text that must not change

- Do not change identifiers, API fields, commands, flags, environment variables, configuration
  keys, file paths, or protocol values.
- Do not change code examples or their behavior. You can change the comments in an example.
- Do not change a quoted error message, CLI help text, or other runtime output.
- Do not change the JSDoc tags `@default`, `@throws`, `@param`, `@returns`, `{@link}`, or
  `@module`. You can change the descriptive text after a tag.
- Keep heading text when other documents or the table of contents link to the heading. A change
  to a heading changes its anchor.
- Keep the difference between mandatory, recommended, and optional items.
- Keep each condition, negation, quantity, unit, limit, default, and step order.

## Terminology

Use the term in the "Term" column. Do not use the terms in the "Do not use" column for the same
concept.

Categories:

- **Product name**: the name of a product or package.
- **Technical name**: a technical noun for an item or a concept in this project or in software.
- **Technical verb**: a verb for a computer process or a software operation.
- **Approved word**: a word from the STE dictionary. This project uses the approved meaning.
- **Exception**: a term that does not obey a writing rule. The reason is in the "Meaning" column.

### Products and packages

| Term                                                                    | Category     | Meaning                                                  | Do not use                         |
| ----------------------------------------------------------------------- | ------------ | -------------------------------------------------------- | ---------------------------------- |
| `pdf-visual-compare`                                                    | Product name | This library and its command-line interface (CLI).       | "the tool", "the package"          |
| `pdf-to-png-converter`                                                  | Product name | The dependency that renders PDF pages.                   | "the converter"                    |
| `png-visual-compare`                                                    | Product name | The dependency that compares two PNG images.             | "pixelmatch" (a different package) |
| PDF.js, `@napi-rs/canvas`                                               | Product name | The renderer libraries that `pdf-to-png-converter` uses. | -                                  |
| Node.js, npm, TypeScript, Vitest, Oxlint, Oxfmt, Docker, GitHub Actions | Product name | Tools that this repository uses.                         | "Node" in descriptive text         |

### Comparison concepts

| Term                 | Category       | Meaning                                                                                                                                         | Do not use                                         |
| -------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| actual PDF           | Technical name | The PDF that the test makes. The first argument.                                                                                                | "new PDF", "candidate", "test PDF"                 |
| expected PDF         | Technical name | The PDF that the actual PDF must look like. The second argument.                                                                                | "baseline", "reference PDF", "golden file"         |
| rendered page        | Technical name | A PNG image of one PDF page.                                                                                                                    | "page image", "page PNG", "screenshot"             |
| page number          | Technical name | The 1-based number of a rendered page. The renderer gives this number.                                                                          | "page index", "page position"                      |
| comparison plan      | Technical name | The list of page numbers that a comparison examines.                                                                                            | "page plan"                                        |
| counterpart          | Technical name | The rendered page with the same page number in the other PDF.                                                                                   | "matching page", "pair"                            |
| mismatch count       | Technical name | The number of different pixels on one page, from `png-visual-compare`. Field `mismatchCount`.                                                   | "difference count", "diff count", "changed pixels" |
| comparison canvas    | Technical name | The larger width multiplied by the larger height of the two rendered pages.                                                                     | "page area" (for this calculation)                 |
| mismatch percentage  | Technical name | The mismatch count as a percentage of the comparison canvas. Field `mismatchPercent`.                                                           | "change percentage", "difference ratio"            |
| pixel threshold      | Technical name | The mismatch count that the pixel threshold permits. Options `compareThreshold`, `matchingThreshold`.                                           | "tolerance", "limit", "allowance"                  |
| percentage threshold | Technical name | The maximum mismatch percentage for an equal page. Options `compareThresholdPercent`, `matchingThresholdPercent`.                               | "tolerance", "percent limit"                       |
| equal                | Approved word  | A page or a document that is in its threshold. Field `isEqual`.                                                                                 | "identical", "passes", "equivalent", "matches"     |
| page exclusion       | Technical name | One entry in the `excludedAreas` option. The entry applies to one page number.                                                                  | "exclusion zone", "exclusion rule"                 |
| excluded area        | Technical name | A rectangle (`PageArea`) on a rendered page that the comparison does not examine.                                                               | "mask", "ignore region", "exclusion zone"          |
| diff image           | Technical name | A PNG image that shows the different pixels of one page.                                                                                        | "diff file", "diff PNG", "difference image"        |
| diff output folder   | Technical name | The folder for diff images. Option `diffsOutputFolder`.                                                                                         | "diff root", "write root"                          |
| render output folder | Technical name | The folder for rendered pages. Option `pdfToPngConvertOptions.outputFolder`.                                                                    | "intermediate folder"                              |
| input root           | Technical name | The folder that must contain the string PDF inputs. Option `allowedInputRoot`.                                                                  | "workspace root", "path boundary"                  |
| folder               | Technical name | A file system directory.                                                                                                                        | "directory" (except in quoted runtime strings)     |
| symbolic link        | Technical name | A file system entry that points to a different path.                                                                                            | "symlink" (except in identifiers)                  |
| string input         | Technical name | A PDF input that is a file path.                                                                                                                | "path argument"                                    |
| binary input         | Technical name | A PDF input that is a `Buffer`, an `ArrayBuffer`, or a `SharedArrayBuffer`.                                                                     | "buffer input" (for all three types)               |
| caller               | Technical name | The code that calls a function of this library.                                                                                                 | "consumer" (for code), "client"                    |
| report               | Technical name | The JSON or JUnit XML text that `toJsonReport` or `toJUnitReport` makes.                                                                        | "output file"                                      |
| exit code            | Technical name | The number that the CLI process gives to the shell when it stops.                                                                               | "return code", "status code"                       |
| comparison           | Technical name | The operation that `comparePdf()` or `comparePdfDetailed()` does. The dictionary does not approve this noun, but the project uses it as a term. | "diff" (as a noun for the operation)               |
| file                 | Technical name | A file in a file system.                                                                                                                        | "document" (for a file on disk)                    |
| option               | Technical name | A property of `ComparePdfOptions`, `PdfRenderOptions`, or `PageExclusion`, or a CLI flag.                                                       | "setting" (for an option property)                 |
| job, check           | Technical name | A GitHub Actions job and its status check. "Check" also means a local verification step, for example the type check.                            | "build" (for a CI job)                             |
| pull request         | Technical name | A GitHub pull request.                                                                                                                          | "PR" in prose, "merge request"                     |
| exact                | Exception      | Used only for check names, which must agree character by character. No STE word has this meaning.                                               | "same" (for this meaning)                          |
| trusted              | Exception      | A security term: the caller is responsible for the safety of the path. No STE word has this meaning.                                            | "safe" (for this meaning)                          |
| supported            | Exception      | A compatibility term: the maintainers keep the platform or the runtime operational. No STE word has this meaning.                               | "works on"                                         |

### Verbs

| Term                                   | Category       | Meaning                                                                                     | Do not use                                          |
| -------------------------------------- | -------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| compare                                | Approved word  | Examine two items for differences.                                                          | "diff" (as a verb), "check" (as a verb for compare) |
| pass, fail                             | Technical verb | A check, a test, or a job gives a good result or a bad result. Do not use for page results. | "succeed" for checks, "pass" for an equal page      |
| render                                 | Technical verb | Make a PNG image from a PDF page.                                                           | "convert", "rasterize", "draw"                      |
| throw                                  | Technical verb | Stop a function with an error.                                                              | "raise"                                             |
| return                                 | Technical verb | Give a value back to the caller of a function.                                              | "yield" (for this meaning)                          |
| resolve                                | Technical verb | Change a relative path to an absolute path. Also: a promise gives its value.                | -                                                   |
| run                                    | Technical verb | Start a command, a script, or a test.                                                       | "execute", "invoke" (in prose)                      |
| install, build, compile, lint, publish | Technical verb | Software operations with their usual meaning.                                               | -                                                   |
| validate                               | Technical verb | Examine a value and throw an error when the value is not correct.                           | "verify" (for input values)                         |
| enable, disable                        | Technical verb | Set an option so that a function operates or does not operate.                              | "turn on", "turn off"                               |
| serialize, parse, normalize            | Technical verb | Data operations with their usual meaning.                                                   | -                                                   |
| write, read                            | Approved word  | Put data in a file, or get data from a file.                                                | "emit", "dump", "load" (for files)                  |
| set                                    | Approved word  | Give an option a value.                                                                     | "configure" (for one option)                        |
| let                                    | Approved word  | Use instead of "allow" and "enable" when the meaning is "permit".                           | "allow"                                             |

## Validation

Run these commands after you change prose:

```sh
npm run format:check
npm run lint
npm run build
npm run test:types
npx vitest run
```

- Make sure that `git diff src/` shows changes to comment lines only.
- Before you format a file, check its original formatting with `npm exec -- oxfmt --check <file>`.
  Keep formatting changes in the scope of the edit.

## Limits of automated checks

- Oxfmt, Oxlint, and the type checker do not examine the writing rules.
- A count of the words in a sentence does not show that the sentence is correct STE.
- No automated check in this repository examines the dictionary words or the link anchors.
  Examine the diff manually.
- A reviewer must compare the old text and the new text for changes in meaning.
