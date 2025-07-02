/**
 * The functions in this module are from @codemirror/search (MIT license)
 * https://github.com/codemirror/search/blob/c1ee7d4b0babd0de0d1198a7c1ece2a387c97c0d/src/search.ts
 */

import { CharCategory, findClusterBreak, Text } from '@codemirror/state'

const charBefore = (str: string, index: number) =>
  str.slice(findClusterBreak(str, index, false), index)

const charAfter = (str: string, index: number) =>
  str.slice(index, findClusterBreak(str, index))

export const categorizer = (char: string) => {
  if (/\s/.test(char)) {
    return CharCategory.Space
  }

  if (/\w/.test(char)) {
    return CharCategory.Word
  }

  return CharCategory.Other
}

export const stringWordTest =
  (doc: Text, categorizer: (ch: string) => CharCategory) =>
  (from: number, to: number, buf: string, bufPos: number) => {
    if (bufPos > from || bufPos + buf.length < to) {
      bufPos = Math.max(0, from - 2)
      buf = doc.sliceString(bufPos, Math.min(doc.length, to + 2))
    }
    return (
      (categorizer(charBefore(buf, from - bufPos)) !== CharCategory.Word ||
        categorizer(charAfter(buf, from - bufPos)) !== CharCategory.Word) &&
      (categorizer(charAfter(buf, to - bufPos)) !== CharCategory.Word ||
        categorizer(charBefore(buf, to - bufPos)) !== CharCategory.Word)
    )
  }

export const regexpWordTest =
  (categorizer: (ch: string) => CharCategory) =>
  (_from: number, _to: number, match: RegExpExecArray) =>
    !match[0].length ||
    ((categorizer(charBefore(match.input, match.index)) !== CharCategory.Word ||
      categorizer(charAfter(match.input, match.index)) !== CharCategory.Word) &&
      (categorizer(charAfter(match.input, match.index + match[0].length)) !==
        CharCategory.Word ||
        categorizer(charBefore(match.input, match.index + match[0].length)) !==
          CharCategory.Word))
