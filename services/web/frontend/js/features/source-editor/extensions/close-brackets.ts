/**
 * This file is adapted from CodeMirror 6, licensed under the MIT license:
 * https://github.com/codemirror/autocomplete/blob/main/src/closebrackets.ts
 */

import { EditorView, KeyBinding } from '@codemirror/view'
import {
  EditorState,
  EditorSelection,
  Transaction,
  Extension,
  StateCommand,
  StateField,
  StateEffect,
  MapMode,
  CharCategory,
  Text,
  codePointAt,
  fromCodePoint,
  codePointSize,
  RangeSet,
  RangeValue,
  SelectionRange,
} from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'

/// Configures bracket closing behavior for a syntax (via
/// [language data](#state.EditorState.languageDataAt)) using the `"closeBrackets"`
/// identifier.
export interface CloseBracketConfig {
  /// The opening and closing tokens.
  brackets?: string[]
  /// Characters in front of which newly opened brackets are
  /// automatically closed. Closing always happens in front of
  /// whitespace. Defaults to `")]}:;>"`.
  before?: string
  /// When determining whether a given node may be a string, recognize
  /// these prefixes before the opening quote.
  stringPrefixes?: string[]
  /// An optional callback for overriding the content that's inserted
  /// based on surrounding characters
  // added by Overleaf
  buildInsert?: (
    state: EditorState,
    range: SelectionRange,
    open: string,
    close: string
  ) => string
}

const defaults: Required<CloseBracketConfig> = {
  brackets: ['(', '[', '{', "'", '"'],
  before: ')]}:;>',
  stringPrefixes: [],
  // added by Overleaf
  buildInsert: (state, range, open, close) => open + close,
}

const closeBracketEffect = StateEffect.define<number>({
  map(value, mapping) {
    const mapped = mapping.mapPos(value, -1, MapMode.TrackAfter)
    return mapped === null ? undefined : mapped
  },
})

const closedBracket = new (class extends RangeValue {})()
closedBracket.startSide = 1
closedBracket.endSide = -1

const bracketState = StateField.define<RangeSet<typeof closedBracket>>({
  create() {
    return RangeSet.empty
  },
  update(value, tr) {
    if (tr.selection) {
      const lineStart = tr.state.doc.lineAt(tr.selection.main.head).from
      const prevLineStart = tr.startState.doc.lineAt(
        tr.startState.selection.main.head
      ).from
      if (lineStart !== tr.changes.mapPos(prevLineStart, -1))
        value = RangeSet.empty
    }
    value = value.map(tr.changes)
    for (const effect of tr.effects)
      if (effect.is(closeBracketEffect))
        value = value.update({
          add: [closedBracket.range(effect.value, effect.value + 1)],
        })
    return value
  },
})

/// Extension to enable bracket-closing behavior. When a closeable
/// bracket is typed, its closing bracket is immediately inserted
/// after the cursor. When closing a bracket directly in front of a
/// closing bracket inserted by the extension, the cursor moves over
/// that bracket.
export function closeBrackets(): Extension {
  return [inputHandler, bracketState]
}

const definedClosing = '()[]{}<>'

function closing(ch: number) {
  for (let i = 0; i < definedClosing.length; i += 2)
    if (definedClosing.charCodeAt(i) === ch) return definedClosing.charAt(i + 1)
  return fromCodePoint(ch < 128 ? ch : ch + 1)
}

function config(state: EditorState, pos: number) {
  return (
    state.languageDataAt<CloseBracketConfig>('closeBrackets', pos)[0] ||
    defaults
  )
}

const android =
  typeof navigator === 'object' && /Android\b/.test(navigator.userAgent)

const inputHandler = EditorView.inputHandler.of((view, from, to, insert) => {
  if (
    (android ? view.composing : view.compositionStarted) ||
    view.state.readOnly
  )
    return false
  const sel = view.state.selection.main
  if (
    insert.length > 2 ||
    (insert.length === 2 && codePointSize(codePointAt(insert, 0)) === 1) ||
    from !== sel.from ||
    to !== sel.to
  )
    return false
  const tr = insertBracket(view.state, insert)
  if (!tr) return false
  view.dispatch(tr)
  return true
})

/// Command that implements deleting a pair of matching brackets when
/// the cursor is between them.
export const deleteBracketPair: StateCommand = ({ state, dispatch }) => {
  if (state.readOnly) return false
  const conf = config(state, state.selection.main.head)
  const tokens = conf.brackets || defaults.brackets
  let dont = null
  const changes = state.changeByRange(range => {
    if (range.empty) {
      const before = prevChar(state.doc, range.head)
      for (const token of tokens) {
        if (
          token === before &&
          nextChar(state.doc, range.head) === closing(codePointAt(token, 0))
        )
          return {
            changes: {
              from: range.head - token.length,
              to: range.head + token.length,
            },
            range: EditorSelection.cursor(range.head - token.length),
          }
      }
    }
    return { range: (dont = range) }
  })
  if (!dont)
    dispatch(
      state.update(changes, {
        scrollIntoView: true,
        userEvent: 'delete.backward',
      })
    )
  return !dont
}

/// Close-brackets related key bindings. Binds Backspace to
/// [`deleteBracketPair`](#autocomplete.deleteBracketPair).
export const closeBracketsKeymap: readonly KeyBinding[] = [
  { key: 'Backspace', run: deleteBracketPair },
]

/// Implements the extension's behavior on text insertion. If the
/// given string counts as a bracket in the language around the
/// selection, and replacing the selection with it requires custom
/// behavior (inserting a closing version or skipping past a
/// previously-closed bracket), this function returns a transaction
/// representing that custom behavior. (You only need this if you want
/// to programmatically insert brackets—the
/// [`closeBrackets`](#autocomplete.closeBrackets) extension will
/// take care of running this for user input.)
export function insertBracket(
  state: EditorState,
  bracket: string
): Transaction | null {
  const conf = config(state, state.selection.main.head)
  const tokens = conf.brackets || defaults.brackets
  for (const tok of tokens) {
    const closed = closing(codePointAt(tok, 0))
    if (bracket === tok)
      return closed === tok
        ? handleSame(
            state,
            tok,
            tokens.indexOf(tok + tok) > -1,
            tokens.indexOf(tok + tok + tok) > -1,
            conf
          )
        : handleOpen(state, tok, closed, conf.before || defaults.before, conf)

    if (bracket === closed && closedBracketAt(state, state.selection.main.from))
      return handleClose(state, tok, closed)
  }
  return null
}

function closedBracketAt(state: EditorState, pos: number) {
  let found = false
  state.field(bracketState).between(0, state.doc.length, from => {
    if (from === pos) found = true
  })
  return found
}

function nextChar(doc: Text, pos: number) {
  const next = doc.sliceString(pos, pos + 2)
  return next.slice(0, codePointSize(codePointAt(next, 0)))
}

function prevChar(doc: Text, pos: number) {
  const prev = doc.sliceString(pos - 2, pos)
  return codePointSize(codePointAt(prev, 0)) === prev.length
    ? prev
    : prev.slice(1)
}

function handleOpen(
  state: EditorState,
  open: string,
  close: string,
  closeBefore: string,
  config: CloseBracketConfig
) {
  // added by Overleaf
  const buildInsert = config.buildInsert || defaults.buildInsert

  let dont = null
  const changes = state.changeByRange(range => {
    if (!range.empty)
      return {
        changes: [
          { insert: open, from: range.from },
          { insert: close, from: range.to },
        ],
        effects: closeBracketEffect.of(range.to + open.length),
        range: EditorSelection.range(
          range.anchor + open.length,
          range.head + open.length
        ),
      }
    const next = nextChar(state.doc, range.head)
    if (!next || /\s/.test(next) || closeBefore.indexOf(next) > -1) {
      // added by Overleaf
      const insert = buildInsert(state, range, open, close) ?? open + close

      return {
        changes: { insert, from: range.head },
        effects:
          // modified by Overleaf
          insert === open
            ? []
            : closeBracketEffect.of(range.head + open.length),
        range: EditorSelection.cursor(range.head + open.length),
      }
    }
    return { range: (dont = range) }
  })
  return dont
    ? null
    : state.update(changes, {
        scrollIntoView: true,
        userEvent: 'input.type',
      })
}

function handleClose(state: EditorState, _open: string, close: string) {
  let dont = null
  const changes = state.changeByRange(range => {
    if (range.empty && nextChar(state.doc, range.head) === close)
      return {
        changes: {
          from: range.head,
          to: range.head + close.length,
          insert: close,
        },
        range: EditorSelection.cursor(range.head + close.length),
      }
    return (dont = { range })
  })
  return dont
    ? null
    : state.update(changes, {
        scrollIntoView: true,
        userEvent: 'input.type',
      })
}

// Handles cases where the open and close token are the same, and
// possibly triple quotes (as in `"""abc"""`-style quoting).
function handleSame(
  state: EditorState,
  token: string,
  // added by Overleaf
  allowDouble: boolean,
  allowTriple: boolean,
  config: CloseBracketConfig
) {
  const stringPrefixes = config.stringPrefixes || defaults.stringPrefixes
  // added by Overleaf
  const buildInsert = config.buildInsert || defaults.buildInsert

  let dont = null
  const changes = state.changeByRange(range => {
    if (!range.empty)
      return {
        changes: [
          { insert: token, from: range.from },
          { insert: token, from: range.to },
        ],
        effects: closeBracketEffect.of(range.to + token.length),
        range: EditorSelection.range(
          range.anchor + token.length,
          range.head + token.length
        ),
      }
    const pos = range.head
    const next = nextChar(state.doc, pos)

    let start
    if (
      allowTriple &&
      state.sliceDoc(pos - 2 * token.length, pos) === token + token &&
      (start = canStartStringAt(
        state,
        pos - 2 * token.length,
        stringPrefixes
      )) > -1 &&
      nodeStart(state, start)
    ) {
      return {
        changes: { insert: token + token + token + token, from: pos },
        effects: closeBracketEffect.of(pos + token.length),
        range: EditorSelection.cursor(pos + token.length),
      }
    } else if (
      // added by Overleaf, for $$
      allowDouble &&
      state.sliceDoc(pos - token.length, pos) === token &&
      (start = canStartStringAt(state, pos - token.length, stringPrefixes)) >
        -1 &&
      nodeStart(state, start)
    ) {
      // added by Overleaf
      const insert = buildInsert(state, range, token, token) ?? token + token

      return {
        changes: { insert, from: pos },
        effects:
          // modified by Overleaf
          insert === token ? [] : closeBracketEffect.of(pos + token.length),
        range: EditorSelection.cursor(pos + token.length),
      }
    } else if (next === token) {
      if (nodeStart(state, pos)) {
        // added by Overleaf
        const insert = buildInsert(state, range, token, token) ?? token + token

        return {
          changes: { insert, from: pos },
          effects:
            // modified by Overleaf
            insert === token ? [] : closeBracketEffect.of(pos + token.length),
          range: EditorSelection.cursor(pos + token.length),
        }
      } else if (closedBracketAt(state, pos)) {
        const isTriple =
          allowTriple &&
          state.sliceDoc(pos, pos + token.length * 3) === token + token + token
        const content = isTriple ? token + token + token : token
        return {
          changes: { from: pos, to: pos + content.length, insert: content },
          range: EditorSelection.cursor(pos + content.length),
        }
      }
    } else if (state.charCategorizer(pos)(next) !== CharCategory.Word) {
      if (
        canStartStringAt(state, pos, stringPrefixes) > -1 &&
        !probablyInString(state, pos, token, stringPrefixes)
      ) {
        // added by Overleaf
        const insert = buildInsert(state, range, token, token) ?? token + token

        return {
          changes: { insert, from: pos },
          effects:
            // modified by Overleaf
            insert === token ? [] : closeBracketEffect.of(pos + token.length),
          range: EditorSelection.cursor(pos + token.length),
        }
      }
    }
    return { range: (dont = range) }
  })
  return dont
    ? null
    : state.update(changes, {
        scrollIntoView: true,
        userEvent: 'input.type',
      })
}

function nodeStart(state: EditorState, pos: number) {
  const tree = syntaxTree(state).resolveInner(pos + 1)
  return tree.parent && tree.from === pos
}

function probablyInString(
  state: EditorState,
  pos: number,
  quoteToken: string,
  prefixes: readonly string[]
) {
  let node = syntaxTree(state).resolveInner(pos, -1)
  const maxPrefix = prefixes.reduce((m, p) => Math.max(m, p.length), 0)
  for (let i = 0; i < 5; i++) {
    const start = state.sliceDoc(
      node.from,
      Math.min(node.to, node.from + quoteToken.length + maxPrefix)
    )
    const quotePos = start.indexOf(quoteToken)
    if (
      !quotePos ||
      (quotePos > -1 && prefixes.indexOf(start.slice(0, quotePos)) > -1)
    ) {
      let first = node.firstChild
      while (
        first &&
        first.from === node.from &&
        first.to - first.from > quoteToken.length + quotePos
      ) {
        if (
          state.sliceDoc(first.to - quoteToken.length, first.to) === quoteToken
        )
          return false
        first = first.firstChild
      }
      return true
    }
    const parent = node.to === pos && node.parent
    if (!parent) break
    node = parent
  }
  return false
}

function canStartStringAt(
  state: EditorState,
  pos: number,
  prefixes: readonly string[]
) {
  const charCat = state.charCategorizer(pos)
  if (charCat(state.sliceDoc(pos - 1, pos)) !== CharCategory.Word) return pos
  for (const prefix of prefixes) {
    const start = pos - prefix.length
    if (
      state.sliceDoc(start, pos) === prefix &&
      charCat(state.sliceDoc(start - 1, start)) !== CharCategory.Word
    )
      return start
  }
  return -1
}
