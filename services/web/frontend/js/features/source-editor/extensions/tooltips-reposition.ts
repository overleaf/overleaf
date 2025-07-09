import { repositionTooltips, ViewPlugin } from '@codemirror/view'

const REPOSITION_EVENT = 'editor:repositionAllTooltips'

export const tooltipsReposition = () =>
  ViewPlugin.define(view => {
    const listener = () => repositionTooltips(view)

    window.addEventListener(REPOSITION_EVENT, listener)

    return {
      destroy() {
        window.removeEventListener(REPOSITION_EVENT, listener)
      },
    }
  })

export const repositionAllTooltips = () => {
  window.dispatchEvent(new Event(REPOSITION_EVENT))
}
