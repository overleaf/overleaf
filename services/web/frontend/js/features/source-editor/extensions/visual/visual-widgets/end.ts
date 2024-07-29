import { WidgetType } from '@codemirror/view'

export class EndWidget extends WidgetType {
  toDOM() {
    const element = document.createElement('div')
    element.classList.add('ol-cm-end')
    return element
  }

  eq(widget: EndWidget) {
    return true
  }

  coordsAt(element: HTMLElement) {
    return element.getBoundingClientRect()
  }
}
