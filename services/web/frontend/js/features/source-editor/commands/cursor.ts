import { EditorView } from '@codemirror/view'
import { EditorSelection } from '@codemirror/state'

export const cloneSelectionVertically =
  (forward: boolean, cumulative: boolean) => (view: EditorView) => {
    const { main, ranges, mainIndex } = view.state.selection
    const { anchor, head, goalColumn } = main
    const start = EditorSelection.range(anchor, head, goalColumn)
    const nextRange = view.moveVertically(start, forward)
    let filteredRanges = [...ranges]

    if (!cumulative && filteredRanges.length > 1) {
      // remove the current main range
      filteredRanges.splice(mainIndex, 1)
    }

    // prevent duplication when going in the opposite direction
    filteredRanges = filteredRanges.filter(
      item => item.from !== nextRange.from && item.to !== nextRange.to
    )
    const selection = EditorSelection.create(
      filteredRanges.concat(nextRange),
      filteredRanges.length
    )
    view.dispatch({ selection })
    return true
  }
