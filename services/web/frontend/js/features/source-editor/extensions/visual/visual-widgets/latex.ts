import { WidgetType } from '@codemirror/view'

export class LaTeXWidget extends WidgetType {
  toDOM() {
    const element = document.createElement('span')
    element.classList.add('ol-cm-tex')
    element.innerHTML = 'L<sup>a</sup>T<sub>e</sub>X'
    return element
  }

  eq() {
    return true
  }

  ignoreEvent(event: Event) {
    return event.type !== 'mousedown' && event.type !== 'mouseup'
  }

  coordsAt(element: HTMLElement) {
    return element.getBoundingClientRect()
  }
}
