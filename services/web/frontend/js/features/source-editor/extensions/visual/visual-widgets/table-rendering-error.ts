import { EditorView, WidgetType } from '@codemirror/view'
import { SyntaxNode } from '@lezer/common'

export class TableRenderingErrorWidget extends WidgetType {
  private hasTableNode: boolean
  constructor(tableNode: SyntaxNode | null | undefined) {
    super()
    this.hasTableNode = Boolean(tableNode)
  }

  toDOM(view: EditorView): HTMLElement {
    const warning = document.createElement('div')
    warning.classList.add('table-generator-error', 'alert')
    warning.role = 'alert'
    const icon = document.createElement('span')
    icon.classList.add('table-generator-error-icon')
    const iconType = document.createElement('i')
    iconType.classList.add('fa', 'fa-info-circle')
    icon.appendChild(iconType)
    warning.appendChild(icon)
    const message = document.createElement('div')
    message.classList.add('table-generator-error-message')
    const messageHeader = document.createElement('p')
    messageHeader.classList.add('table-generator-error-message-header')
    messageHeader.textContent = view.state.phrase(
      'sorry_your_table_cant_be_displayed_at_the_moment'
    )
    const messageBody = document.createElement('p')
    messageBody.textContent = view.state.phrase(
      'this_could_be_because_we_cant_support_some_elements_of_the_table'
    )
    message.appendChild(messageHeader)
    message.appendChild(messageBody)
    warning.appendChild(message)
    const element = document.createElement('div')
    element.classList.add('table-generator', 'table-generator-error-container')
    element.appendChild(warning)
    if (this.hasTableNode) {
      element.classList.add('ol-cm-environment-table')
    }
    return element
  }

  coordsAt(element: HTMLElement) {
    return element.getBoundingClientRect()
  }
}
