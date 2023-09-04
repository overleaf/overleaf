import { EditorView, WidgetType } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { SyntaxNode } from '@lezer/common'
import * as ReactDOM from 'react-dom'
import { Tabular } from '../../../components/table-generator/tabular'
import {
  ParsedTableData,
  generateTable,
} from '../../../components/table-generator/utils'

export class TabularWidget extends WidgetType {
  private element: HTMLElement | undefined
  private readonly parseResult: ParsedTableData

  constructor(
    private tabularNode: SyntaxNode,
    private content: string,
    private tableNode: SyntaxNode | null,
    state: EditorState
  ) {
    super()
    this.parseResult = generateTable(tabularNode, state)
  }

  isValid() {
    for (const row of this.parseResult.table.rows) {
      const rowLength = row.cells.reduce(
        (acc, cell) => acc + (cell.multiColumn?.columnSpan ?? 1),
        0
      )
      for (const cell of row.cells) {
        if (
          cell.multiColumn?.columns.specification &&
          cell.multiColumn.columns.specification.length !== 1
        ) {
          return false
        }
      }
      if (rowLength !== this.parseResult.table.columns.length) {
        return false
      }
    }
    return true
  }

  toDOM(view: EditorView) {
    this.element = document.createElement('div')
    this.element.classList.add('ol-cm-tabular')
    if (this.tableNode) {
      this.element.classList.add('ol-cm-environment-table')
    }
    ReactDOM.render(
      <Tabular
        view={view}
        tabularNode={this.tabularNode}
        parsedTableData={this.parseResult}
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
        parsedTableData={this.parseResult}
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
