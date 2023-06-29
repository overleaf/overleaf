import { EditorView } from '@codemirror/view'
import { EditorSelection, EditorState, StateCommand } from '@codemirror/state'
import { SearchQuery, StringQuery, selectWord } from '@codemirror/search'

export { selectNextOccurrence } from '@codemirror/search'

const findPrevOccurence = (state: EditorState, search: string) => {
  const searchQuery = new SearchQuery({ search, literal: true })
  const query = new StringQuery(searchQuery)
  const { from, to } = state.selection.main
  return query.prevMatch(state, from, to)
}

export const selectPrevOccurrence: StateCommand = ({ state, dispatch }) => {
  const { ranges } = state.selection

  if (ranges.some(range => range.from === range.to)) {
    return selectWord({ state, dispatch })
  }

  const searchedText = state.sliceDoc(ranges[0].from, ranges[0].to)

  if (
    state.selection.ranges.some(
      range => state.sliceDoc(range.from, range.to) !== searchedText
    )
  ) {
    return false
  }

  const range = findPrevOccurence(state, searchedText)
  if (!range) {
    return false
  }

  dispatch(
    state.update({
      selection: state.selection.addRange(
        EditorSelection.range(range.from, range.to)
      ),
      effects: EditorView.scrollIntoView(range.to),
    })
  )

  return true
}
