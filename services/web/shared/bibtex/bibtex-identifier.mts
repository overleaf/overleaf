/**
 * The BibTeX identifier character class, shared by entry types, citation keys,
 * field names and abbreviation names.
 *
 * btparse derives it by "removing the magic 10 from printable ASCII, then
 * further excluding @, \ and ~", the magic 10 being " # % ' ( ) , = { } and
 * space. Stated by exclusion it also admits non-ASCII, which biber accepts in
 * all four positions.
 *
 * Mirrors the identifierChar and identifierStart rules in
 * frontend/js/features/source-editor/lezer-bibtex/bibtex.grammar, so keep the
 * two in step.
 *
 * See https://metacpan.org/dist/Text-BibTeX/view/btparse/doc/bt_language.pod
 */

// Control characters and DEL are excluded along with the punctuation, so a key
// cannot carry an invisible ASCII character.
const FORBIDDEN = '\\u0000-\\u0020\\u007f"#%\'(),=@\\\\{}~'

/** Citation keys, which unlike other identifiers may start with a digit. */
export const BIBTEX_CITATION_KEY_REGEX = new RegExp(`^[^${FORBIDDEN}]+$`)

/** Entry types, field names and abbreviation names. */
export const BIBTEX_IDENTIFIER_REGEX = new RegExp(
  `^[^${FORBIDDEN}0-9][^${FORBIDDEN}]*$`
)

const FORBIDDEN_CHAR = new RegExp(`[${FORBIDDEN}]`)

export function isBibtexIdentifierStartChar(char: string): boolean {
  return (
    isBibtexIdentifierContinuationChar(char) && !(char >= '0' && char <= '9')
  )
}

export function isBibtexIdentifierContinuationChar(char: string): boolean {
  return char !== '' && !FORBIDDEN_CHAR.test(char)
}
