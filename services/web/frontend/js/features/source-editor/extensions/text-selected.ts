import { SelectionRange, StateEffect } from '@codemirror/state'
import { ViewPlugin } from '@codemirror/view'

export const textSelectedEffect = StateEffect.define<SelectionRange>()

export const textSelected = ViewPlugin.define(view => {
  function mouseUpListener() {
    if (!view.state.selection.main.empty) {
      view.dispatch({
        effects: textSelectedEffect.of(view.state.selection.main),
      })
    }
  }
  function keyUpListener(event: KeyboardEvent) {
    if (
      (event.shiftKey || event.key === 'Meta') &&
      !view.state.selection.main.empty
    ) {
      view.dispatch({
        effects: textSelectedEffect.of(view.state.selection.main),
      })
    }
  }

  view.dom.addEventListener('mouseup', mouseUpListener)
  view.dom.addEventListener('keyup', keyUpListener)

  return {
    destroy() {
      view.dom.removeEventListener('mouseup', mouseUpListener)
      view.dom.removeEventListener('keyup', keyUpListener)
    },
  }
})
