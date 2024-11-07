import { EditorState, Text } from '@codemirror/state'
import {
  clearSnippet,
  Completion,
  snippet,
  nextChar,
} from '@codemirror/autocomplete'
import { EditorView } from '@codemirror/view'
import { prepareSnippetTemplate } from '../snippets'
import { ancestorNodeOfType } from '../../../utils/tree-query'

export const applySnippet = (template: string, clear = false) => {
  return (
    view: EditorView,
    completion: Completion,
    from: number,
    to: number
  ) => {
    snippet(prepareSnippetTemplate(template))(view, completion, from, to)
    if (clear) {
      clearSnippet(view)
    }
  }
}

const longestCommonPrefix = (...strs: string[]) => {
  if (strs.length === 0) {
    return 0
  }
  const minLength = Math.min(...strs.map(str => str.length))
  for (let i = 0; i < minLength; ++i) {
    for (let j = 1; j < strs.length; ++j) {
      if (strs[j][i] !== strs[0][i]) {
        return i
      }
    }
  }
  return minLength
}

// extend forwards to cover an unpaired closing brace
export const extendRequiredParameter = (
  state: EditorState,
  change: {
    from: number
    to: number
    insert: string | Text
  }
) => {
  if (typeof change.insert !== 'string') {
    change.insert = change.insert.toString()
  }

  const argumentNode = ancestorNodeOfType(state, change.from, '$Argument')
  const isWellFormedArgumentNode =
    argumentNode &&
    argumentNode.getChild('OpenBrace') &&
    argumentNode.getChild('CloseBrace')

  if (nextChar(state.doc, change.to) === '}') {
    // include an existing closing brace, so the cursor moves after it
    change.insert += '}'
    change.to++
  } else {
    // add a closing brace if needed
    if (countUnclosedBraces(state.doc, change.from, change.to) > 0) {
      change.insert += '}'
    }

    if (isWellFormedArgumentNode) {
      // extend over subsequent text that isn't a brace, space, or comma
      const match = state.doc
        .sliceString(
          change.to,
          Math.min(state.doc.lineAt(change.from).to, argumentNode.to)
        )
        .match(/^[^}\s,]+/)
      if (match) {
        change.to += match[0].length
      }
    } else {
      // Ensure we don't swallow a closing brace
      const restOfLine = state.doc
        .sliceString(
          change.to,
          Math.min(
            state.doc.lineAt(change.from).to,
            change.from + change.insert.length
          )
        )
        .split('}')[0]

      change.to += longestCommonPrefix(
        change.insert.slice(change.to - change.from),
        restOfLine
      )
    }
  }
  change.insert = state.toText(change.insert)
  return change
}

// extend forwards to cover an unpaired closing brace
export const extendOverUnpairedClosingBrace = (
  state: EditorState,
  change: {
    from: number
    to: number
  }
) => {
  if (nextChar(state.doc, change.to) === '}') {
    const unclosedBraces = countUnclosedBraces(
      state.doc,
      change.from,
      change.to
    )
    if (unclosedBraces < 0) {
      change.to++
    }
  }
  return change
}

const countUnclosedBraces = (doc: Text, from: number, to: number): number => {
  const line = doc.lineAt(from)

  const textBefore = doc.sliceString(line.from, from)
  const textAfter = doc.sliceString(to, line.to)

  const textAfterMatch = textAfter.match(/^[^\\]*/)

  const openBraces =
    (textBefore.match(/\{/g) || []).length -
    (textBefore.match(/}/g) || []).length

  const closedBraces = textAfterMatch
    ? (textAfterMatch[0].match(/}/g) || []).length -
      (textAfterMatch[0].match(/\{/g) || []).length
    : 0

  return openBraces - closedBraces
}
