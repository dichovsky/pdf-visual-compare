// XML 1.0 permits the following Unicode code points. Unicode mode treats a valid surrogate
// pair as a single code point and excludes unpaired surrogates. See https://www.w3.org/TR/xml/#charsets.
const ILLEGAL_XML_CHARS = /[^\t\n\r\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu;

/**
 * Minimal XML escaping for serialized reports. Code points illegal under the XML 1.0 `Char`
 * production (see {@link ILLEGAL_XML_CHARS}) are stripped first; then `&` is escaped before
 * `<`/`>` so the entities introduced by the later replacements are not double-escaped.
 */
export function escapeXmlText(value: string): string {
    return value.replace(ILLEGAL_XML_CHARS, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Escapes a value for use inside a double-quoted XML attribute (text escaping plus `"`).
 */
export function escapeXmlAttribute(value: string): string {
    return escapeXmlText(value).replace(/"/g, '&quot;');
}
