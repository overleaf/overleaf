import { EditorView, WidgetType } from '@codemirror/view'
import { placeSelectionInsideBlock } from '../selection'

export class BeginWidget extends WidgetType {
  constructor(public environment: string) {
    super()
  }

  toDOM(view: EditorView) {
    const element = document.createElement('div')
    element.classList.add('ol-cm-begin')
    element.classList.add(`ol-cm-begin-${this.environment}`)

    const leftPadding = document.createElement('span')
    leftPadding.classList.add('ol-cm-environment-padding')
    element.appendChild(leftPadding)

    const name = document.createElement('span')
    name.textContent = this.environment
    name.classList.add('ol-cm-environment-name')
    name.classList.add(`ol-cm-environment-name-${this.environment}`)
    element.appendChild(name)

    const rightPadding = document.createElement('span')
    rightPadding.classList.add('ol-cm-environment-padding')
    element.appendChild(rightPadding)

    element.addEventListener('mouseup', event => {
      event.preventDefault()
      view.dispatch(placeSelectionInsideBlock(view, event as MouseEvent))
    })

    return element
  }

  eq(widget: BeginWidget) {
    return widget.environment === this.environment
  }

  updateDOM(element: HTMLDivElement) {
    element.querySelector('.ol-cm-environment-name')!.textContent =
      this.environment
    return true
  }

  ignoreEvent(event: Event): boolean {
    return event.type !== 'mouseup'
  }
}
