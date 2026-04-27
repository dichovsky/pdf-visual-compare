/**
 * Supported PDF input sources for `comparePdf()` and `comparePdfDetailed()`.
 *
 * - `string`: trusted path to a PDF file on disk, opened and read before rendering
 * - `Buffer`: Node.js binary PDF content
 * - `ArrayBufferLike`: binary PDF content, including `ArrayBuffer` and `SharedArrayBuffer`
 *
 * `SharedArrayBuffer` inputs are normalized to `ArrayBuffer` before being passed to the PDF renderer.
 * For untrusted environments, prefer binary inputs or configure `allowedInputRoot`.
 */
export type PdfInput = string | Buffer | ArrayBufferLike;
