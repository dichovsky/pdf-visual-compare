/**
 * The PDF inputs that `comparePdf()` and `comparePdfDetailed()` accept.
 *
 * - `string`: trusted path to a PDF file on disk. The library opens and reads the file before
 *   the renderer starts.
 * - `Buffer`: binary PDF content from Node.js
 * - `ArrayBufferLike`: binary PDF content, which includes `ArrayBuffer` and `SharedArrayBuffer`
 *
 * The library normalizes `SharedArrayBuffer` inputs to `ArrayBuffer` before it gives them to the
 * PDF renderer. In environments that are not trusted, we recommend that you use binary inputs or
 * set `allowedInputRoot`.
 */
export type PdfInput = string | Buffer | ArrayBufferLike;
