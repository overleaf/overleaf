import { EditorView } from '@codemirror/view'
import { EditorSelection, Text } from '@codemirror/state'
import { selectNextOccurrence, SearchCursor } from '@codemirror/search'

type Spec = {
  caseSensitive?: boolean
  unquoted: string
}

const stringCursor = (spec: Spec, doc: Text, from: number, to: number) => {
  return new SearchCursor(
    doc,
    spec.unquoted,
    from,
    to,
    spec.caseSensitive ? undefined : x => x.toLowerCase()
  )
}

class QueryType {
  protected spec

  constructor(spec: Spec) {
    this.spec = spec
  }
}

class StringQuery extends QueryType {
  // Searching in reverse is, rather than implementing inverted search
  // cursor, done by scanning chunk after chunk forward.
  prevMatchInRange(doc: Text, from: number, to: number) {
    for (let pos = to; ; ) {
      const start = Math.max(
        from,
        pos - 10000 /* ChunkSize */ - this.spec.unquoted.length
      )
      const cursor = stringCursor(this.spec, doc, start, pos)
      let range = null

      while (!cursor.nextOverlapping().done) {
        range = cursor.value
      }

      if (range) {
        return range
      }

      if (start === from) {
        return null
      }

      pos -= 10000 /* ChunkSize */
    }
  }

  prevMatch(doc: Text, curFrom: number, curTo: number) {
    return (
      this.prevMatchInRange(doc, 0, curFrom) ||
      this.prevMatchInRange(doc, curTo, doc.length)
    )
  }
}

const selectWord = (view: EditorView) => {
  const { selection } = view.state
  const newSelection = EditorSelection.create(
    selection.ranges.map(
      range =>
        view.state.wordAt(range.head) || EditorSelection.cursor(range.head)
    ),
    selection.mainIndex
  )

  if (newSelection.eq(selection)) {
    return false
  }

  view.dispatch(view.state.update({ selection: newSelection }))

  return true
}

const selectPrevOccurrence = (view: EditorView) => {
  const { state } = view
  const { ranges } = state.selection

  if (ranges.some(range => range.from === range.to)) {
    return selectWord(view)
  }

  const searchedText = state.sliceDoc(ranges[0].from, ranges[0].to)

  if (
    state.selection.ranges.some(
      range => state.sliceDoc(range.from, range.to) !== searchedText
    )
  ) {
    return false
  }

  const query = new StringQuery({ unquoted: searchedText })
  const { main } = state.selection
  const range = query.prevMatch(state.doc, main.from, main.to)

  if (!range) {
    return false
  }

  view.dispatch({
    selection: state.selection.addRange(
      EditorSelection.range(range.from, range.to)
    ),
    effects: EditorView.scrollIntoView(range.to),
  })

  return true
}

export const selectOccurrence = (forward: boolean) => (view: EditorView) =>
  forward ? selectNextOccurrence(view) : selectPrevOccurrence(view)
