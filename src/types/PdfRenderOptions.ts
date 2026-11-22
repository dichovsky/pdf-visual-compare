/**
 * Options that the renderer uses before the visual comparison.
 *
 * These options are part of the public contract of this library. The library adapts them
 * internally to the current PDF render dependency. The options intentionally do not include
 * settings that disable page content or enable parallel rendering. This library always renders
 * the pages sequentially. Parallel rendering can cause comparison errors.
 */
export type PdfRenderOptions = {
    /**
     * Scale factor that the renderer applies to each page viewport before it renders the page.
     * A value more than `1` makes larger images with a higher resolution. A value less than `1`
     * makes smaller images.
     */
    viewportScale?: number;

    /**
     * When `true`, the renderer does not load embedded fonts. It uses built-in fonts.
     */
    disableFontFace?: boolean;

    /**
     * When `true`, the renderer can use installed system fonts when embedded fonts are missing.
     */
    useSystemFonts?: boolean;

    /**
     * When `true`, the renderer renders XFA (XML Forms Architecture) form data.
     */
    enableXfa?: boolean;

    /**
     * Password that opens an encrypted PDF.
     */
    pdfFilePassword?: string;

    /**
     * Render output folder: the folder for the rendered PNG files.
     * This library puts the renderer output in the `actual/` and `expected/` subfolders.
     * Thus, the file names of the two PDFs do not collide.
     * When omitted, the rendered pages stay in memory, unless a different option writes them to disk.
     */
    outputFolder?: string;

    /**
     * Function that makes the names of the PNG output files.
     * The function receives the 1-based page number. It must return a file name that ends with `.png`.
     */
    outputFileMaskFunc?: (pageNumber: number) => string;

    /**
     * 1-based page numbers to render. When omitted, the renderer renders all pages.
     */
    pagesToProcess?: number[];

    /**
     * Log level of the renderer. `0` logs only errors, `1` logs warnings, and `5` logs information.
     */
    verbosityLevel?: number;
};
