import { codePointAt, codePointSize, Text } from '@codemirror/state'
import {
  clearSnippet,
  Completion,
  insertCompletionText,
  snippet,
} from '@codemirror/autocomplete'
import { EditorView } from '@codemirror/view'
import { prepareSnippetTemplate } from '../snippets'

// from https://github.com/codemirror/autocomplete/blob/main/src/closebrackets.ts
export const nextChar = (doc: Text, pos: number) => {
  const next = doc.sliceString(pos, pos + 2)
  return next.slice(0, codePointSize(codePointAt(next, 0)))
}

export const prevChar = (doc: Text, pos: number) => {
  const prev = doc.sliceString(pos - 2, pos)
  return codePointSize(codePointAt(prev, 0)) === prev.length
    ? prev
    : prev.slice(1)
}

// Apply a completed command, removing any subsequent closing brace, optionally
// providing a function that generates the completion text. If missing, the
// completion label is used.
export const createCommandApplier =
  (text: string) =>
  (view: EditorView, completion: Completion, from: number, to: number) => {
    const { doc } = view.state

    // extend forwards to cover an unpaired closing brace
    if (nextChar(doc, to) === '}') {
      if (countUnclosedBraces(doc, from, to) < 0) {
        to++
      }
    }
    // TODO: extend `to` to cover more subsequent characters?
    view.dispatch(insertCompletionText(view.state, text, from, to))
  }

// apply a completed required parameter, adding a closing brace and extending the range if needed
export const createRequiredParameterApplier =
  (text: string) =>
  (view: EditorView, completion: Completion, from: number, to: number) => {
    const { doc } = view.state

    // add a closing brace if needed
    if (nextChar(doc, to) !== '}') {
      if (countUnclosedBraces(doc, from, to) > 0) {
        text += '}'
      }

      // extend over subsequent text that isn't a brace, space, or comma
      const match = doc.sliceString(to, doc.lineAt(from).to).match(/^[^}\s,]+/)
      if (match) {
        to += match[0].length
      }
    }

    view.dispatch(insertCompletionText(view.state, text, from, to))
  }

/*
 * Handle trailing '}' characters and tabbing back from final placeholder when
 * inserting snippets
 */
const customSnippetApply = (template: string, clear = false) => {
  return (
    view: EditorView,
    completion: Completion,
    from: number,
    to: number
  ) => {
    // extend forwards to cover an unpaired closing brace
    if (nextChar(view.state.doc, to) === '}') {
      if (countUnclosedBraces(view.state.doc, from, to) < 0) {
        to++
      }
    }

    const snippetApply = snippet(prepareSnippetTemplate(template))
    snippetApply(view, completion, from, to)
    if (clear) {
      clearSnippet(view)
    }
  }
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

// Convert from Ace `$1` to CodeMirror numbered placeholder format `${1}` or `#{1}` in snippets.
// Note: metadata from the server still uses the old format, so it's not enough to convert all
// the bundled data to the new format.
export const customSnippetCompletion = (
  template: string,
  completion: Completion,
  clear = false
) => {
  completion.apply = customSnippetApply(template, clear)
  return completion
}
