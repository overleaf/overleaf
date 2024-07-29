import { EditorView, WidgetType } from '@codemirror/view'
import { SyntaxNode } from '@lezer/common'
import * as ReactDOM from 'react-dom'
import { Tabular } from '../../../components/table-generator/tabular'
import { ParsedTableData } from '../../../components/table-generator/utils'

export class TabularWidget extends WidgetType {
  constructor(
    private parsedTableData: ParsedTableData,
    private tabularNode: SyntaxNode,
    private content: string,
    private tableNode: SyntaxNode | null,
    private isDirectChildOfTableEnvironment: boolean
  ) {
    super()
  }

  toDOM(view: EditorView) {
    const element = document.createElement('div')
    element.classList.add('ol-cm-tabular')
    if (this.tableNode) {
      element.classList.add('ol-cm-environment-table')
    }
    ReactDOM.render(
      <Tabular
        view={view}
        tabularNode={this.tabularNode}
        parsedTableData={this.parsedTableData}
        tableNode={this.tableNode}
        directTableChild={this.isDirectChildOfTableEnvironment}
      />,
      element
    )
    return element
  }

  eq(widget: TabularWidget): boolean {
    return (
      this.tabularNode.from === widget.tabularNode.from &&
      this.tableNode?.from === widget.tableNode?.from &&
      this.tableNode?.to === widget.tableNode?.to &&
      this.content === widget.content &&
      this.isDirectChildOfTableEnvironment ===
        widget.isDirectChildOfTableEnvironment
    )
  }

  updateDOM(element: HTMLElement, view: EditorView): boolean {
    ReactDOM.render(
      <Tabular
        view={view}
        tabularNode={this.tabularNode}
        parsedTableData={this.parsedTableData}
        tableNode={this.tableNode}
        directTableChild={this.isDirectChildOfTableEnvironment}
      />,
      element
    )
    return true
  }

  coordsAt(element: HTMLElement) {
    return element.getBoundingClientRect()
  }

  get estimatedHeight() {
    return this.parsedTableData.table.rows.length * 50
  }

  destroy(element: HTMLElement) {
    ReactDOM.unmountComponentAtNode(element)
  }
}
