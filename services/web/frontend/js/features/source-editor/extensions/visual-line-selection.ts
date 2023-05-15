import {
  SelectionRange,
  EditorSelection,
  EditorState,
  Transaction,
} from '@codemirror/state'
import { Command, EditorView } from '@codemirror/view'

const getNextLineBoundary = (
  selection: SelectionRange,
  forward: boolean,
  view: EditorView,
  includeWrappingCharacter = false
) => {
  const newSelection = view.moveToLineBoundary(
    EditorSelection.cursor(
      selection.head,
      1,
      selection.bidiLevel || undefined,
      selection.goalColumn
    ),
    forward
  )
  // Adjust to be "before" the simulated line break
  let offset = 0
  if (
    forward &&
    !includeWrappingCharacter &&
    view.lineBlockAt(selection.head).to !== newSelection.head
  ) {
    offset = 1
  }
  return EditorSelection.cursor(
    newSelection.head - offset,
    selection.assoc,
    selection.bidiLevel || undefined,
    newSelection.goalColumn
  )
}

const changeSelection = (
  view: EditorView,
  how: (selection: SelectionRange) => SelectionRange,
  extend = false
) => {
  view.dispatch({
    selection: EditorSelection.create(
      view.state.selection.ranges.map(start => {
        const newSelection = how(start)
        const anchor = extend ? start.anchor : newSelection.head
        return EditorSelection.range(
          anchor,
          newSelection.head,
          newSelection.goalColumn,
          newSelection.bidiLevel || undefined
        )
      }),
      view.state.selection.mainIndex
    ),
    scrollIntoView: true,
    userEvent: 'select',
  })
}

export const cursorToEndOfVisualLine = (view: EditorView) =>
  changeSelection(view, range => getNextLineBoundary(range, true, view), false)

export const selectToEndOfVisualLine = (view: EditorView) =>
  changeSelection(view, range => getNextLineBoundary(range, true, view), true)

export const selectRestOfVisualLine = (view: EditorView) =>
  changeSelection(
    view,
    range => getNextLineBoundary(range, true, view, true),
    true
  )

export const cursorToBeginningOfVisualLine = (view: EditorView) =>
  changeSelection(view, range => getNextLineBoundary(range, false, view), false)

export const selectToBeginningOfVisualLine = (view: EditorView) =>
  changeSelection(view, range => getNextLineBoundary(range, false, view), true)

export const deleteToVisualLineEnd: Command = view =>
  deleteBy(view, pos => {
    const lineEnd = getNextLineBoundary(
      EditorSelection.cursor(pos),
      true,
      view,
      true
    ).to
    return pos < lineEnd ? lineEnd : Math.min(view.state.doc.length, pos + 1)
  })

export const deleteToVisualLineStart: Command = view =>
  deleteBy(view, pos => {
    const lineStart = getNextLineBoundary(
      EditorSelection.cursor(pos),
      false,
      view
    ).to
    return pos > lineStart ? lineStart : Math.max(0, pos - 1)
  })

/* eslint-disable */
/**
 * The following definitions are from CodeMirror 6, licensed under the MIT license:
 * https://github.com/codemirror/commands/blob/main/src/commands.ts
 */
type CommandTarget = { state: EditorState; dispatch: (tr: Transaction) => void }

function deleteBy(target: CommandTarget, by: (start: number) => number) {
  if (target.state.readOnly) return false
  let event = 'delete.selection',
    { state } = target
  let changes = state.changeByRange(range => {
    let { from, to } = range
    if (from == to) {
      let towards = by(from)
      if (towards < from) {
        event = 'delete.backward'
        towards = skipAtomic(target, towards, false)
      } else if (towards > from) {
        event = 'delete.forward'
        towards = skipAtomic(target, towards, true)
      }
      from = Math.min(from, towards)
      to = Math.max(to, towards)
    } else {
      from = skipAtomic(target, from, false)
      to = skipAtomic(target, to, true)
    }
    return from == to
      ? { range }
      : { changes: { from, to }, range: EditorSelection.cursor(from) }
  })
  if (changes.changes.empty) return false
  target.dispatch(
    state.update(changes, {
      scrollIntoView: true,
      userEvent: event,
      effects:
        event == 'delete.selection'
          ? EditorView.announce.of(state.phrase('selection_deleted'))
          : undefined,
    })
  )
  return true
}

function skipAtomic(target: CommandTarget, pos: number, forward: boolean) {
  if (target instanceof EditorView)
    for (let ranges of target.state
      .facet(EditorView.atomicRanges)
      .map(f => f(target)))
      ranges.between(pos, pos, (from, to) => {
        if (from < pos && to > pos) pos = forward ? to : from
      })
  return pos
}
