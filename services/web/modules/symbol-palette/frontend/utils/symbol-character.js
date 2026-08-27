/**
 * Safely derive the display character for a symbol.
 *
 * Defaults use real hex codepoints (e.g. "U+1D6FC") and the character is
 * derived with String.fromCodePoint. User-added symbols created without a
 * character get synthetic ids (e.g. "U+CUSTOM-...") that must NOT be run
 * through parseInt/fromCodePoint (NaN / out-of-range throw).
 *
 * @param {object} symbol symbol object from the palette config
 * @param {string} [fallback] returned when no valid character can be derived
 * @returns {string}
 */
export function getSymbolCharacter(symbol, fallback = '?') {
  if (symbol && typeof symbol.character === 'string' && symbol.character) {
    return symbol.character
  }
  const codepoint = String(symbol?.codepoint || '').replace(/^U\+0*/i, '')
  if (/^[0-9a-fA-F]+$/.test(codepoint)) {
    const cp = parseInt(codepoint, 16)
    if (Number.isInteger(cp) && cp >= 0 && cp <= 0x10ffff) {
      try {
        return String.fromCodePoint(cp)
      } catch {
        // fall through to fallback
      }
    }
  }
  return fallback
}
