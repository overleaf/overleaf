import { EditorView, WidgetType } from '@codemirror/view'
import { SyntaxNode } from '@lezer/common'
import { materialIcon } from '@/features/utils/material-icon'

export class TableRenderingErrorWidget extends WidgetType {
  private hasTableNode: boolean
  constructor(tableNode: SyntaxNode | null | undefined) {
    super()
    this.hasTableNode = Boolean(tableNode)
  }

  toDOM(view: EditorView): HTMLElement {
    const warning = document.createElement('div')
    warning.classList.add('notification', 'notification-type-info')
    warning.role = 'alert'
    const icon = document.createElement('div')
    icon.classList.add('notification-icon')
    icon.appendChild(materialIcon('info'))
    warning.appendChild(icon)
    const messageWrapper = document.createElement('div')
    messageWrapper.classList.add('notification-content-and-cta')
    const message = document.createElement('div')
    message.classList.add('notification-content')
    const messageHeader = document.createElement('p')
    const messageHeaderInner = document.createElement('strong')
    messageHeaderInner.textContent = view.state.phrase(
      'sorry_your_table_cant_be_displayed_at_the_moment'
    )
    messageHeader.appendChild(messageHeaderInner)
    const messageBody = document.createElement('p')
    messageBody.textContent = view.state.phrase(
      'this_could_be_because_we_cant_support_some_elements_of_the_table'
    )
    message.appendChild(messageHeader)
    message.appendChild(messageBody)
    messageWrapper.appendChild(message)
    warning.appendChild(messageWrapper)
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
