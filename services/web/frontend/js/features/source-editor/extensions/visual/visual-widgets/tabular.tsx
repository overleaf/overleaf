import { EditorView, WidgetType } from '@codemirror/view'
import { SyntaxNode } from '@lezer/common'
import * as ReactDOM from 'react-dom'
import { Tabular } from '../../../components/table-generator/tabular'

export class TabularWidget extends WidgetType {
  private element: HTMLElement | undefined

  constructor(
    private tabularNode: SyntaxNode,
    private content: string,
    private tableNode: SyntaxNode | null
  ) {
    super()
  }

  toDOM(view: EditorView) {
    this.element = document.createElement('div')
    this.element.classList.add('ol-cm-tabular')
    this.element.style.backgroundColor = 'rgba(125, 125, 125, 0.05)'
    ReactDOM.render(
      <Tabular
        view={view}
        tabularNode={this.tabularNode}
        tableNode={this.tableNode}
      />,
      this.element
    )
    return this.element
  }

  eq(widget: TabularWidget): boolean {
    return (
      this.tabularNode.from === widget.tabularNode.from &&
      this.tableNode?.from === widget.tableNode?.from &&
      this.tableNode?.to === widget.tableNode?.to &&
      this.content === widget.content
    )
  }

  updateDOM(dom: HTMLElement, view: EditorView): boolean {
    this.element = dom
    ReactDOM.render(
      <Tabular
        view={view}
        tabularNode={this.tabularNode}
        tableNode={this.tableNode}
      />,
      this.element
    )
    return true
  }

  destroy() {
    console.debug('destroying tabular widget')
    if (this.element) {
      ReactDOM.unmountComponentAtNode(this.element)
    }
  }
}
