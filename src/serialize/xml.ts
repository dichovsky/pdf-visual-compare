// XML 1.0's `Char` production only allows tab/LF/CR, [U+0020-U+D7FF], [U+E000-U+FFFD], and
// [U+10000-U+10FFFF] (https://www.w3.org/TR/xml/#charsets). Everything else cannot even be
// escaped as a character reference, so it is stripped to keep the output well-formed:
//   - C0 controls other than tab/LF/CR
//   - U+FFFE and U+FFFF (explicitly excluded — the legal range stops at U+FFFD)
//   - unpaired UTF-16 surrogates — a lone high surrogate not immediately followed by a low
//     surrogate, or a lone low surrogate not immediately preceded by a high surrogate. A *valid*
//     surrogate pair (together encoding U+10000-U+10FFFF) is left intact by the negative
//     lookahead/lookbehind on each alternative.
const ILLEGAL_XML_CHARS =
    /[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/**
 * Minimal XML escaping for serialized reports. Code points illegal under the XML 1.0 `Char`
 * production (see {@link ILLEGAL_XML_CHARS}) are stripped first; then `&` is escaped before
 * `<`/`>` so the entities introduced by the later replacements are not double-escaped.
 */
export function escapeXmlText(value: string): string {
    return value
        .replace(ILLEGAL_XML_CHARS, '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Escapes a value for use inside a double-quoted XML attribute (text escaping plus `"`).
 */
export function escapeXmlAttribute(value: string): string {
    return escapeXmlText(value).replace(/"/g, '&quot;');
}
