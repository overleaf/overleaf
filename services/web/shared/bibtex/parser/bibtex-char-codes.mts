import { isBibtexIdentifierContinuationChar } from '../bibtex-identifier.mts'

export const TAB = 0x09
export const LINE_FEED = 0x0a
export const CARRIAGE_RETURN = 0x0d
export const SPACE = 0x20
export const QUOTE = 0x22
export const HASH = 0x23
export const PERCENT = 0x25
export const OPEN_PAREN = 0x28
export const CLOSE_PAREN = 0x29
export const COMMA = 0x2c
export const EQUALS = 0x3d
export const AT = 0x40
export const OPEN_BRACE = 0x7b
export const CLOSE_BRACE = 0x7d

// Derived from the shared predicate rather than restated, so the character-code
// variants below cannot drift from it.
const ASCII_ALLOWED = Uint8Array.from({ length: 0x80 }, (_, code) =>
  isBibtexIdentifierContinuationChar(String.fromCharCode(code)) ? 1 : 0
)

/**
 * Character-code variant of isBibtexIdentifierContinuationChar. Every
 * forbidden character is ASCII, so anything above is allowed, including the
 * surrogate halves of an astral character.
 */
export function isBibtexIdentifierCharCode(code: number): boolean {
  return code > 0x7f || ASCII_ALLOWED[code] === 1
}

/** Character-code variant of isBibtexIdentifierStartChar. */
export function isBibtexIdentifierStartCharCode(code: number): boolean {
  return isBibtexIdentifierCharCode(code) && !isDigitCode(code)
}

export function isDigitCode(code: number): boolean {
  return code >= 0x30 && code <= 0x39
}

export function isWhitespaceCode(code: number): boolean {
  return (
    code === SPACE ||
    code === LINE_FEED ||
    code === TAB ||
    code === CARRIAGE_RETURN
  )
}
