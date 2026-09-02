import { BibtexNameList } from '@shared/bibtex/bibtex-name.mts'

const YEAR_REGEX = /^\d{4}$/

/**
 * Generates the base citation key ("Surname" + "Year", stripped of any
 * non-alphanumeric characters) from a parsed author list and a year string.
 * Returns '' if there's no first author or no valid 4-digit year — the
 * caller uses this to know that no suggestion is possible yet.
 *
 * Examples: "John Doe" + "1994" -> "Doe1994"
 *           "John von Neumann" + "1965" -> "vonNeumann1965"
 *           "Catherine O'Hara" + "2012" -> "OHara2012"
 */
export function generateBaseCitationKey({
  authors,
  year,
}: {
  authors: BibtexNameList
  year: string
}): string {
  const firstAuthor = authors.names[0]
  if (!firstAuthor) return ''
  const surname = firstAuthor.toLast().replace(/[^A-Za-z0-9]/g, '')
  if (!surname) return ''
  if (!YEAR_REGEX.test(year.trim())) return ''
  return surname + year.trim()
}

/**
 * Generates lowercase-letter suffixes in bijective base-26 order: '', 'a',
 * 'b', ..., 'z', 'aa', 'ab', ..., 'zz', 'aaa', ...
 */
function* suffixes(): Generator<string> {
  yield ''
  let length = 1
  while (true) {
    const total = 26 ** length
    for (let i = 0; i < total; i++) {
      let n = i
      let suffix = ''
      for (let j = 0; j < length; j++) {
        suffix = String.fromCharCode(97 + (n % 26)) + suffix
        n = Math.floor(n / 26)
      }
      yield suffix
    }
    length++
  }
}

/**
 * Picks the first available citation key of the form `base`, `base` + 'a',
 * `base` + 'b', etc. that isn't already taken. Compares candidates by exact
 * string equality against `takenKeys`, not by prefix — `takenKeys` may
 * contain unrelated keys that happen to share the same prefix (e.g. a
 * manually-named `Doe1994Workshop`), which must not be mistaken for a
 * suffix collision.
 */
export function pickAvailableKey(base: string, takenKeys: string[]): string {
  const taken = new Set(takenKeys)
  for (const suffix of suffixes()) {
    const candidate = base + suffix
    if (!taken.has(candidate)) return candidate
  }
  // unreachable: suffixes() is infinite
  throw new Error('unreachable')
}
