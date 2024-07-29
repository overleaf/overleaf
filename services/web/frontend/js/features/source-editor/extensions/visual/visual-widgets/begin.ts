import { EditorView, WidgetType } from '@codemirror/view'
import { placeSelectionInsideBlock } from '../selection'

export class BeginWidget extends WidgetType {
  destroyed = false

  constructor(public environment: string) {
    super()
  }

  toDOM(view: EditorView) {
    this.destroyed = false
    const element = document.createElement('div')
    this.buildElement(element, view)

    element.addEventListener('mouseup', event => {
      event.preventDefault()
      view.dispatch(placeSelectionInsideBlock(view, event as MouseEvent))
    })

    return element
  }

  eq(widget: BeginWidget) {
    return widget.environment === this.environment
  }

  updateDOM(element: HTMLDivElement, view: EditorView) {
    this.destroyed = false
    element.textContent = ''
    element.className = ''
    this.buildElement(element, view)
    return true
  }

  destroy() {
    this.destroyed = true
  }

  ignoreEvent(event: Event): boolean {
    return event.type !== 'mouseup'
  }

  coordsAt(element: HTMLElement) {
    return element.getBoundingClientRect()
  }

  buildName(name: HTMLSpanElement, view: EditorView) {
    name.textContent = this.environment
  }

  buildElement(element: HTMLDivElement, view: EditorView) {
    element.classList.add('ol-cm-begin', `ol-cm-begin-${this.environment}`)

    const startPadding = document.createElement('span')
    startPadding.classList.add(
      'ol-cm-environment-padding',
      'ol-cm-environment-start-padding'
    )
    element.appendChild(startPadding)

    const name = document.createElement('span')
    name.classList.add('ol-cm-environment-name')
    this.buildName(name, view)
    element.appendChild(name)

    const endPadding = document.createElement('span')
    endPadding.classList.add(
      'ol-cm-environment-padding',
      'ol-cm-environment-end-padding'
    )
    element.appendChild(endPadding)
  }
}
