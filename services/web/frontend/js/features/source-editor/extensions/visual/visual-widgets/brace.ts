import { WidgetType } from '@codemirror/view'

export class BraceWidget extends WidgetType {
  constructor(private content?: string) {
    super()
  }

  toDOM() {
    const element = document.createElement('span')
    element.classList.add('ol-cm-brace')
    if (this.content !== undefined) {
      element.textContent = this.content
    }
    return element
  }

  ignoreEvent(event: Event) {
    return event.type !== 'mousedown' && event.type !== 'mouseup'
  }

  eq(widget: BraceWidget) {
    return widget.content === this.content
  }

  coordsAt(element: HTMLElement) {
    return element.getBoundingClientRect()
  }
}
