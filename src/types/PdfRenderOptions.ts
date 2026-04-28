/**
 * Options for rendering PDF pages before visual comparison.
 *
 * These options are part of this library's public contract and are adapted internally
 * to the current PDF rendering dependency. Options that disable page content or enable
 * parallel rendering are intentionally excluded because this library always renders
 * page images sequentially for safe comparison.
 */
export type PdfRenderOptions = {
    /**
     * Scale factor applied to each page viewport before rendering.
     * Values above `1` produce larger, higher-resolution images; values below `1` produce smaller images.
     */
    viewportScale?: number;

    /**
     * When `true`, embedded fonts are not loaded and built-in fonts are used instead.
     */
    disableFontFace?: boolean;

    /**
     * When `true`, system-installed fonts may be used as fallbacks for missing embedded fonts.
     */
    useSystemFonts?: boolean;

    /**
     * When `true`, XFA (XML Forms Architecture) form data is rendered.
     */
    enableXfa?: boolean;

    /**
     * Password used to open an encrypted PDF.
     */
    pdfFilePassword?: string;

    /**
     * Folder path where intermediate PNG files are written.
     * This library namespaces the renderer output under `actual/` and `expected/` subfolders
     * to avoid filename collisions between the two compared PDFs.
     * When omitted, rendered pages stay in memory unless another option writes them to disk.
     */
    outputFolder?: string;

    /**
     * Custom naming function for output PNG files.
     * Receives the 1-based page number and must return a filename ending with `.png`.
     */
    outputFileMaskFunc?: (pageNumber: number) => string;

    /**
     * 1-based page numbers to render. When omitted, all pages are rendered.
     */
    pagesToProcess?: number[];

    /**
     * Renderer verbosity level. `0` logs errors only, `1` warnings, and `5` informational output.
     */
    verbosityLevel?: number;
};
