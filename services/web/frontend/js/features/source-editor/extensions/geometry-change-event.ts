import { EditorView } from '@codemirror/view'

/**
 * An extension that triggers a custom DOM event whenever the editor geometry
 * changes. This is used to synchronize the editor content and review panel
 * height in "Current file" mode.
 */
export const geometryChangeEvent = () =>
  EditorView.updateListener.of(update => {
    if (update.geometryChanged) {
      window.dispatchEvent(new CustomEvent('editor:geometry-change'))
    }
  })
