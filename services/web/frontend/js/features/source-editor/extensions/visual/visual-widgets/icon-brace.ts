import { WidgetType } from '@codemirror/view'

export class IconBraceWidget extends WidgetType {
  constructor(private content?: string) {
    super()
  }

  toDOM() {
    const element = document.createElement('span')
    element.classList.add('ol-cm-brace')
    element.classList.add('ol-cm-icon-brace')
    if (this.content !== undefined) {
      element.textContent = this.content
    }
    return element
  }

  ignoreEvent(event: Event): boolean {
    return event.type !== 'mousedown' && event.type !== 'mouseup'
  }

  eq(widget: IconBraceWidget) {
    return widget.content === this.content
  }

  updateDOM(element: HTMLElement): boolean {
    element.textContent = this.content ?? ''
    return true
  }

  coordsAt(element: HTMLElement) {
    return element.getBoundingClientRect()
  }
}
