// XML 1.0 forbids these control characters entirely — they cannot even be escaped as character
// references, so they are stripped to keep the output well-formed.
const ILLEGAL_XML_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;

/**
 * Minimal XML escaping for serialized reports. Illegal XML 1.0 control characters are stripped
 * first; then `&` is escaped before `<`/`>` so the entities introduced by the later replacements
 * are not double-escaped.
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
