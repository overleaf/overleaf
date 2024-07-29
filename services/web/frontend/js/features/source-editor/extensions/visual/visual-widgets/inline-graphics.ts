import { EditorView } from '@codemirror/view'
import { GraphicsWidget } from './graphics'

export class InlineGraphicsWidget extends GraphicsWidget {
  toDOM(view: EditorView) {
    this.destroyed = false

    const element = document.createElement('span')
    element.classList.add('ol-cm-graphics-inline')

    this.renderGraphic(element, view)

    return element
  }

  ignoreEvent(event: Event) {
    return event.type !== 'mousedown' && event.type !== 'mouseup'
  }

  coordsAt(element: HTMLElement) {
    return element.getBoundingClientRect()
  }
}
