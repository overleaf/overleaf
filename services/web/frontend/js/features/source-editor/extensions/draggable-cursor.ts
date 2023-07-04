import { Extension } from '@codemirror/state'
import { EditorView, ViewPlugin } from '@codemirror/view'
import { isInPrimarySelection } from './visual/utils/selection'

const showDraggable = { style: 'cursor: move' }

/**
 * An extension that changes the cursor style to "move" when the main mouse button
 * is held down on the primary selection for a short amount of time.
 */
export const draggableCursor = (): Extension => {
  let timer: number | undefined

  const plugin = ViewPlugin.define(
    view => {
      return {
        isActive: false,
        set(isActive: boolean) {
          if (this.isActive !== isActive) {
            this.isActive = isActive
            view.update([])
          }
        },
      }
    },
    {
      eventHandlers: {
        mousedown(event, view) {
          if (timer) {
            window.clearTimeout(timer)
          }
          // single click with the main mouse button
          if (event.detail === 1 && event.button === 0) {
            timer = window.setTimeout(() => {
              timer = undefined
              if (isInPrimarySelection(event, view)) {
                this.set(true)
              }
            }, 50)
          }
        },
        mouseup() {
          if (timer) {
            window.clearTimeout(timer)
          }
          this.set(false)
        },
        dragstart() {
          if (timer) {
            window.clearTimeout(timer)
          }
          this.set(false)
        },
      },
    }
  )

  return [
    plugin,
    EditorView.contentAttributes.of(view =>
      view.plugin(plugin)?.isActive ? showDraggable : null
    ),
  ]
}
