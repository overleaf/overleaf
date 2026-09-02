/**
 * Implements the BibTeX purify$ function for special characters
 *
 * Special characters are first level groupings of curly braces that start with
 * a backslash (e.g. "This is a special character: {\textbf{hello}}"). Inside
 * special characters, LaTeX commands are removed.
 *
 * For more details, see Tame the BeaST, section 10
 * (https://tug.ctan.org/info/bibtex/tamethebeast/ttb_en.pdf)
 */
export function purifySpecialChars(s: string) {
  let result = ''
  let currSpecialChar: string | null = null
  let openBraces = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '{') {
      openBraces += 1
    } else if (c === '}') {
      openBraces -= 1
    } else if (c === '\\' && openBraces === 1) {
      // Open a special character
      currSpecialChar = ''
    }

    if (currSpecialChar != null && openBraces === 0) {
      // We just closed a special char: remove all LaTeX command and add to the
      // result
      result += currSpecialChar.replaceAll(/\\([A-Za-z]+|[^A-Za-z])\s*/g, '')
      currSpecialChar = null
    }

    // Accumulate the character either in the current special character or in
    // the final result
    if (currSpecialChar != null) {
      currSpecialChar += c
    } else {
      result += c
    }
  }

  // If the string is malformed, just append the unprocessed special character
  // as-is
  if (currSpecialChar != null) {
    result += currSpecialChar
  }

  return result
}
