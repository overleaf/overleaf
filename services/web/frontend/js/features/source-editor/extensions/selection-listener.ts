import { ViewPlugin } from '@codemirror/view'
import { EditorSelection } from '@codemirror/state'
import { debounce } from 'lodash'

export const selectionListener = (
  setEditorSelection: (value: EditorSelection | undefined) => void
) => {
  const debouncedSetEditorSelection = debounce(setEditorSelection, 250)

  return ViewPlugin.define(() => {
    return {
      update(update) {
        if (update.selectionSet) {
          debouncedSetEditorSelection(update.state.selection)
        }
      },
      destroy() {
        setEditorSelection(undefined)
      },
    }
  })
}
