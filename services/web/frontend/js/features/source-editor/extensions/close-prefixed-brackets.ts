/**
 * This file is adapted from CodeMirror 6, licensed under the MIT license:
 * https://github.com/codemirror/autocomplete/blob/main/src/closebrackets.ts
 */
import { EditorView } from '@codemirror/view'
import {
  codePointAt,
  codePointSize,
  EditorSelection,
  Extension,
  SelectionRange,
  Text,
  TransactionSpec,
} from '@codemirror/state'
import { nextChar, prevChar } from '../languages/latex/completions/apply'
import { completionStatus } from '@codemirror/autocomplete'
import { ancestorNodeOfType } from '../utils/tree-query'
import browser from './browser'

const dispatchInput = (view: EditorView, spec: TransactionSpec) => {
  // This is consistent with CM6's closebrackets extension and allows other
  // extensions that check for user input to be triggered
  view.dispatch(spec, {
    scrollIntoView: true,
    userEvent: 'input.type',
  })

  return true
}

const insertInput = (view: EditorView, insert: string) => {
  const spec = view.state.changeByRange(range => {
    return {
      changes: [[{ from: range.from, insert }]],
      range: EditorSelection.range(range.from + 1, range.to + 1),
    }
  })

  return dispatchInput(view, spec)
}

const insertBracket = (view: EditorView, open: string, close: string) => {
  const spec = view.state.changeByRange(range => {
    if (range.empty) {
      return {
        changes: [{ from: range.head, insert: open + close }],
        range: EditorSelection.cursor(range.head + open.length),
      }
    } else {
      return {
        changes: [
          { from: range.from, insert: open },
          { from: range.to, insert: close },
        ],
        range: EditorSelection.range(
          range.anchor + open.length,
          range.head + open.length
        ),
      }
    }
  })

  return dispatchInput(view, spec)
}

export const closePrefixedBrackets = (): Extension => {
  return EditorView.inputHandler.of((view, from, to, insert) => {
    if (
      (browser.android ? view.composing : view.compositionStarted) ||
      view.state.readOnly
    ) {
      return false
    }

    // avoid auto-closing curly braces when autocomplete is open
    if (insert === '{' && completionStatus(view.state)) {
      return insertInput(view, insert)
    }

    const { doc, selection } = view.state

    const sel = selection.main

    if (
      from !== sel.from ||
      to !== sel.to ||
      insert.length > 2 ||
      (insert.length === 2 && codePointSize(codePointAt(insert, 0)) === 1)
    ) {
      return false
    }

    const [config] = view.state.languageDataAt<{
      brackets?: Record<string, string | false>
    }>('closePrefixedBrackets', sel.head)

    // no config for this language, don't handle
    if (!config?.brackets) {
      return false
    }

    const prevCharacter = prevChar(view.state.doc, sel.from)
    const input = `${prevCharacter}${insert}`
    const close = config.brackets[input] ?? config.brackets[insert]

    // not specified, don't handle
    if (close === undefined) {
      return false
    }

    // prevent auto-close, just insert the character
    if (close === false) {
      return insertInput(view, insert)
    }

    const nextCharacter = nextChar(doc, sel.from)

    if (insert === '$') {
      // avoid duplicating a math-closing dollar sign
      if (moveOverClosingMathDollar(view, sel)) {
        return true
      }

      // avoid creating an odd number of dollar signs
      const count = countSurroundingCharacters(doc, sel.from, insert)
      if (count % 2 !== 0) {
        return insertInput(view, insert)
      }
    }

    // This is the default set of "before" characters from the closeBrackets extension,
    // plus $ (so $$ works as expected)
    if (!sel.empty || !nextCharacter || /[\s)\]}:;>$]/.test(nextCharacter)) {
      // auto-close
      return insertBracket(view, insert, close)
    }

    return false
  })
}

const moveOverClosingMathDollar = (
  view: EditorView,
  sel: SelectionRange
): boolean => {
  if (!sel.empty) {
    return false
  }

  // inside dollar math
  const outerNode = ancestorNodeOfType(view.state, sel.from, 'DollarMath')
  if (!outerNode) {
    return false
  }

  // not display math
  const innerNode = outerNode.getChild('InlineMath')
  if (!innerNode) {
    return false
  }

  // the cursor is at the end of the InlineMath node
  if (sel.from !== innerNode.to) {
    return false
  }

  // there's already some math content
  const content = view.state.doc.sliceString(innerNode.from, innerNode.to)
  if (content.length === 0) {
    return false
  }

  // move the cursor outside the DollarMath node
  view.dispatch({
    selection: EditorSelection.cursor(outerNode.to),
  })
  return true
}

const countSurroundingCharacters = (doc: Text, pos: number, insert: string) => {
  let count = 0

  // count backwards
  let to = pos
  do {
    const char = doc.sliceString(to - 1, to)
    if (char !== insert) {
      break
    }
    count++
    to--
  } while (to > 1)

  // count forwards
  let from = pos
  do {
    const char = doc.sliceString(from, from + 1)
    if (char !== insert) {
      break
    }
    count++
    from++
  } while (from < doc.length)

  return count
}
