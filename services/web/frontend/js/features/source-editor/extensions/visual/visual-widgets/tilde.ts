import { WidgetType } from '@codemirror/view'

export class TildeWidget extends WidgetType {
  toDOM() {
    const element = document.createElement('span')
    element.textContent = '\xa0' // '&nbsp;' but not using innerHTML
    return element
  }

  eq() {
    return true
  }

  coordsAt(element: HTMLElement) {
    return element.getBoundingClientRect()
  }
}
