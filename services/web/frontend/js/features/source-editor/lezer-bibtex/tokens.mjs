import {
  stringKeyword,
  preambleKeyword,
  commentKeyword,
} from './bibtex.terms.mjs'

/**
 * @param {string} identifier
 */
export function specializeEntryType(identifier) {
  const lowercased = identifier.toLowerCase()
  switch (lowercased) {
    case 'string':
      return stringKeyword
    case 'preamble':
      return preambleKeyword
    case 'comment':
      return commentKeyword
  }
  return -1
}
