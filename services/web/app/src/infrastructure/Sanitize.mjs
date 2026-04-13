// @ts-check

/* eslint-disable no-control-regex, no-misleading-character-class */
const CONTROL_CHARS_RE =
  /[\u0000-\u001F\u007F-\u009F\u200B\u200C\u200D\u2060\uFEFF]/g
/* eslint-enable no-control-regex, no-misleading-character-class */

/**
 * @param {string} value
 * @returns {string}
 */
export function sanitizeControlCharacters(value) {
  if (typeof value !== 'string') {
    throw new TypeError(
      `sanitizeControlCharacters expected a string, received ${typeof value}`
    )
  }
  return value.replace(CONTROL_CHARS_RE, char => {
    const code = /** @type {number} */ (char.codePointAt(0))
    return `\\u${code.toString(16).padStart(4, '0')}`
  })
}
