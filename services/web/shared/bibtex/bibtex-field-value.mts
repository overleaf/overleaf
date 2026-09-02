import { latexToUnicode } from './latex-to-unicode.mts'
import { purifySpecialChars } from './bibtex-purify.mts'
import {
  isBibtexIdentifierContinuationChar,
  isBibtexIdentifierStartChar,
} from './bibtex-identifier.mts'

class StringLiteral {
  private value: string

  constructor(value: string) {
    this.value = value
  }

  toString() {
    return `{${this.value}}`
  }

  toEditableString() {
    return this.value.replaceAll('#', '##')
  }

  toDisplayString() {
    let s = this.value
    s = latexToUnicode(s)
    s = purifySpecialChars(s)
    s = s.replaceAll(/[~\s]+/g, ' ')
    s = s.replaceAll(/[{}\\]/g, '')
    return s
  }
}

class NumberLiteral {
  private value: string

  constructor(value: string) {
    this.value = value
  }

  toString() {
    return this.value
  }

  toEditableString() {
    return this.value
  }

  toDisplayString() {
    return this.value
  }
}

class NamedString {
  private name: string

  constructor(name: string) {
    this.name = name
  }

  toString() {
    return this.name
  }

  toEditableString() {
    return `#${this.name}#`
  }

  toDisplayString() {
    return this.name
  }
}

type Part = StringLiteral | NumberLiteral | NamedString

export class BibtexFieldValue {
  private readonly parts: ReadonlyArray<Part> = []
  private bibtexString: string | null = null
  private displayString: string | null = null
  private editableString: string | null = null

  constructor(parts: Part[] = []) {
    this.parts = parts
  }

  addString(value: string) {
    return new BibtexFieldValue([...this.parts, new StringLiteral(value)])
  }

  addNumber(value: string) {
    return new BibtexFieldValue([...this.parts, new NumberLiteral(value)])
  }

  addNamedString(name: string) {
    return new BibtexFieldValue([...this.parts, new NamedString(name)])
  }

  toString() {
    if (this.bibtexString == null) {
      if (this.parts.length === 0) {
        return '{}'
      }

      this.bibtexString = this.parts.map(part => part.toString()).join(' # ')
    }
    return this.bibtexString
  }

  /**
   * Convert a BibtexFieldValue to editable field text.
   *
   * Steps:
   * 1. String literals are copied as-is, but every '#' is escaped as '##'.
   * 2. Numbers are copied as text.
   * 3. Named strings are wrapped as '#name#'.
   * 4. All parts are concatenated directly.
   *
   * Example:
   * BibTeX:
   *   {This is } # author # {'s } # {#1 } # book # { from } # 1995
   * Editable:
   *   This is #author#'s ##1 #book# from 1995
   *
   * Example:
   * BibTeX:
   *   "The " # DS # " handbook"
   * Editable:
   *   The #DS# handbook
   */
  toEditableString() {
    if (this.editableString == null) {
      this.editableString = this.parts
        .map(part => part.toEditableString())
        .join('')
    }
    return this.editableString
  }

  /**
   * Convert a BibtexFieldValue to a string suitable for display.
   *
   * - Replace tildes with spaces
   * - Replace successions of whitespace characters with a single space
   * - Trim leading and trailing whitespace
   * - Remove curly braces and backslashes
   */
  toDisplayString() {
    if (this.displayString == null) {
      let s = this.parts.map(part => part.toDisplayString()).join('')
      s = s.replaceAll(/^\s+|\s+$/g, '')
      this.displayString = s
    }
    return this.displayString
  }

  /**
   * Make a new BibtexFieldValue from an editable string
   *
   * Scan left-to-right:
   * 1. '##' becomes a literal '#'.
   * 2. '#identifier#' becomes a named string part.
   * 3. Any other '#' is treated as a literal '#'.
   * 4. Literal runs become braced strings and parts are joined with ' # '.
   *
   * Abbreviation names use the identifier character class from
   * bibtex-identifier.mts, which cannot start with a digit.
   *
   * Example:
   * Editable:
   *   This is #author#'s #1 book (#numberone) and here's a ##tag##
   * BibTeX:
   *   {This is } # author # {'s #1 book (#numberone) and here's a #tag#}
   *
   * Example:
   * Editable:
   *   This is from 1995
   * BibTeX:
   *   {This is from 1995}
   */
  static fromEditableString(editable: string) {
    const builder = new BibtexFieldValueBuilder()
    let currentString = ''
    let index = 0

    while (index < editable.length) {
      if (editable[index] !== '#') {
        currentString += editable[index]
        index += 1
        continue
      }

      const nextIndex = index + 1
      const nextChar = editable[nextIndex]

      if (nextChar === '#') {
        currentString += '#'
        index += 2
        continue
      }

      const identifierEnd = findBibtexIdentifierEndExclusive(
        editable,
        nextIndex
      )
      if (identifierEnd !== null && editable[identifierEnd] === '#') {
        if (currentString !== '') {
          builder.addString(currentString)
          currentString = ''
        }

        builder.addNamedString(editable.slice(nextIndex, identifierEnd))
        index = identifierEnd + 1
        continue
      }

      currentString += '#'
      index += 1
    }

    if (currentString !== '') {
      builder.addString(currentString)
    }

    return builder.build()
  }
}

/**
 * Accumulates the parts of a field value in place, for a parser that reads them
 * one at a time. BibtexFieldValue's own add* methods copy the parts array, so
 * building a long "#"-concatenated value through them is quadratic.
 */
export class BibtexFieldValueBuilder {
  private readonly parts: Part[] = []

  addString(value: string) {
    this.parts.push(new StringLiteral(value))
  }

  addNumber(value: string) {
    this.parts.push(new NumberLiteral(value))
  }

  addNamedString(name: string) {
    this.parts.push(new NamedString(name))
  }

  /** Whether any part has been added, so "{}" is not an empty builder. */
  isEmpty(): boolean {
    return this.parts.length === 0
  }

  /** The value built so far, unaffected by later additions to the builder. */
  build(): BibtexFieldValue {
    return new BibtexFieldValue([...this.parts])
  }
}

function findBibtexIdentifierEndExclusive(
  text: string,
  startIndex: number
): number | null {
  if (startIndex > text.length) {
    throw new Error('startIndex must not be greater than text length')
  }

  if (
    startIndex === text.length ||
    !isBibtexIdentifierStartChar(text[startIndex])
  ) {
    return null
  }

  let index = startIndex + 1
  while (
    index < text.length &&
    isBibtexIdentifierContinuationChar(text[index])
  ) {
    index += 1
  }
  return index
}

export const __test = {
  findBibtexIdentifierEndExclusive,
}
