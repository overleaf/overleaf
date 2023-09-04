import { WidgetType } from '@codemirror/view'
import { SyntaxNode } from '@lezer/common'

export class TableRenderingErrorWidget extends WidgetType {
  private hasTableNode: boolean
  constructor(tableNode: SyntaxNode | null | undefined) {
    super()
    this.hasTableNode = Boolean(tableNode)
  }

  toDOM(): HTMLElement {
    const warning = document.createElement('div')
    warning.classList.add('table-generator-error', 'alert')
    warning.role = 'alert'
    const icon = document.createElement('span')
    icon.classList.add('table-generator-error-icon')
    const iconType = document.createElement('i')
    iconType.classList.add('fa', 'fa-info-circle')
    icon.appendChild(iconType)
    warning.appendChild(icon)
    const message = document.createElement('span')
    message.classList.add('table-generator-error-message')
    message.textContent =
      'We couldn’t render your table.\nThis could be because some features of this table are not supported in the table preview yet, or due to a LaTeX error in the table code.'
    warning.appendChild(message)
    const element = document.createElement('div')
    element.classList.add('table-generator', 'table-generator-error-container')
    element.appendChild(warning)
    if (this.hasTableNode) {
      element.classList.add('ol-cm-environment-table')
    }
    return element
  }
}
