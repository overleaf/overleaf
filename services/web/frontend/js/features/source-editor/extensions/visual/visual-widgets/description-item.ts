import { WidgetType } from '@codemirror/view'

export class DescriptionItemWidget extends WidgetType {
  constructor(public listDepth: number) {
    super()
  }

  toDOM() {
    const element = document.createElement('span')
    element.classList.add('ol-cm-description-item')
    this.setProperties(element)
    return element
  }

  eq(widget: DescriptionItemWidget) {
    return widget.listDepth === this.listDepth
  }

  updateDOM(element: HTMLElement) {
    this.setProperties(element)
    return true
  }

  ignoreEvent(event: Event): boolean {
    return event.type !== 'mousedown' && event.type !== 'mouseup'
  }

  coordsAt(element: HTMLElement) {
    return element.getBoundingClientRect()
  }

  setProperties(element: HTMLElement) {
    element.style.setProperty('--list-depth', String(this.listDepth))
  }
}
