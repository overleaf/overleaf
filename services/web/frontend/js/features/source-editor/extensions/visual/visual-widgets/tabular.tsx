import { EditorView, WidgetType } from '@codemirror/view'
import { SyntaxNode } from '@lezer/common'
import * as ReactDOM from 'react-dom'
import { Tabular } from '../../../components/table-generator/tabular'

export class TabularWidget extends WidgetType {
  private element: HTMLElement | undefined

  constructor(private node: SyntaxNode, private content: string) {
    super()
  }

  toDOM(view: EditorView) {
    this.element = document.createElement('div')
    this.element.classList.add('ol-cm-tabular')
    this.element.style.backgroundColor = 'rgba(125, 125, 125, 0.05)'
    ReactDOM.render(
      <Tabular view={view} tabularNode={this.node} />,
      this.element
    )
    return this.element
  }

  eq(widget: TabularWidget): boolean {
    return (
      this.node.from === widget.node.from && this.content === widget.content
    )
  }

  destroy() {
    console.debug('destroying tabular widget')
    if (this.element) {
      ReactDOM.unmountComponentAtNode(this.element)
    }
  }
}
