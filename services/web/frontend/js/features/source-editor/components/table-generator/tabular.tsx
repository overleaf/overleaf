import { SyntaxNode } from '@lezer/common'
import { FC, useEffect } from 'react'
import { CellPosition, RowPosition } from './utils'
import { Toolbar } from './toolbar/toolbar'
import { Table } from './table'
import {
  SelectionContextProvider,
  useSelectionContext,
} from './contexts/selection-context'
import {
  EditingContextProvider,
  useEditingContext,
} from './contexts/editing-context'
import { EditorView } from '@codemirror/view'
import { ErrorBoundary } from 'react-error-boundary'
import { Alert, Button } from 'react-bootstrap'
import { EditorSelection } from '@codemirror/state'
import { CodeMirrorViewContextProvider } from '../codemirror-editor'
import { TableProvider } from './contexts/table-context'
import { TabularProvider, useTabularContext } from './contexts/tabular-context'
import Icon from '../../../../shared/components/icon'
import { BorderTheme } from './toolbar/commands'

export type ColumnDefinition = {
  alignment: 'left' | 'center' | 'right' | 'paragraph'
  borderLeft: number
  borderRight: number
  content: string
}

export type CellData = {
  content: string
  from: number
  to: number
  multiColumn?: {
    columnSpan: number
    columns: {
      specification: ColumnDefinition[]
      from: number
      to: number
    }
    from: number
    to: number
    preamble: {
      from: number
      to: number
    }
    postamble: {
      from: number
      to: number
    }
  }
}

export type RowData = {
  cells: CellData[]
  borderTop: number
  borderBottom: number
}

export class TableData {
  // eslint-disable-next-line no-useless-constructor
  constructor(
    public readonly rows: RowData[],
    public readonly columns: ColumnDefinition[]
  ) {}

  getCellIndex(row: number, column: number): number {
    let cellIndex = 0
    for (let i = 0; i < this.rows[row].cells.length; i++) {
      cellIndex += this.rows[row].cells[i].multiColumn?.columnSpan ?? 1
      if (column < cellIndex) {
        return i
      }
    }
    return this.rows[row].cells.length - 1
  }

  getCell(row: number, column: number): CellData {
    return this.rows[row].cells[this.getCellIndex(row, column)]
  }

  getCellBoundaries(row: number, cell: number) {
    let currentCellOffset = 0
    for (let index = 0; index < this.rows[row].cells.length; ++index) {
      const currentCell = this.rows[row].cells[index]
      const skip = currentCell.multiColumn?.columnSpan ?? 1
      if (currentCellOffset + skip > cell) {
        return { from: currentCellOffset, to: currentCellOffset + skip - 1 }
      }
      currentCellOffset += skip
    }
    throw new Error("Couldn't find cell boundaries")
  }

  getBorderTheme(): BorderTheme | null {
    if (this.rows.length === 0 || this.columns.length === 0) {
      return null
    }
    const lastRow = this.rows[this.rows.length - 1]
    const hasBottomBorder = lastRow.borderBottom > 0
    const firstColumn = this.columns[0]
    const hasLeftBorder = firstColumn.borderLeft > 0
    for (const row of this.rows) {
      if (hasBottomBorder === (row.borderTop === 0)) {
        return null
      }
    }
    // If we had the first, we have verified that we have the rest
    const hasAllRowBorders = hasBottomBorder

    for (const column of this.columns) {
      if (hasLeftBorder === (column.borderRight === 0)) {
        return null
      }
    }

    for (const row of this.rows) {
      for (const cell of row.cells) {
        if (cell.multiColumn) {
          if (cell.multiColumn.columns.specification.length === 0) {
            return null
          }
          const firstCell = cell.multiColumn.columns.specification[0]
          if (hasLeftBorder === (firstCell.borderLeft === 0)) {
            return null
          }
          for (const column of cell.multiColumn.columns.specification) {
            if (hasLeftBorder === (column.borderRight === 0)) {
              return null
            }
          }
        }
      }
    }
    // If we had the first, we have verified that we have the rest
    const hasAllColumnBorders = hasLeftBorder

    if (hasAllRowBorders && hasAllColumnBorders) {
      return BorderTheme.FULLY_BORDERED
    } else {
      return BorderTheme.NO_BORDERS
    }
  }
}

export type Positions = {
  cells: CellPosition[][]
  columnDeclarations: { from: number; to: number }
  rowPositions: RowPosition[]
  tabular: { from: number; to: number }
}

export const TableRenderingError: FC<{
  view: EditorView
  codePosition?: number
}> = ({ view, codePosition }) => {
  return (
    <Alert className="table-generator-error">
      <span className="table-generator-error-icon">
        <Icon type="exclamation-circle" />
      </span>
      <span className="table-generator-error-message">
        We couldn't render your table
      </span>
      {codePosition !== undefined && (
        <Button
          onClick={() =>
            view.dispatch({
              selection: EditorSelection.cursor(codePosition),
            })
          }
        >
          View code
        </Button>
      )}
    </Alert>
  )
}

export const Tabular: FC<{
  tabularNode: SyntaxNode
  view: EditorView
  tableNode: SyntaxNode | null
}> = ({ tabularNode, view, tableNode }) => {
  return (
    <ErrorBoundary
      fallbackRender={() => (
        <TableRenderingError view={view} codePosition={tabularNode.from} />
      )}
    >
      <CodeMirrorViewContextProvider value={view}>
        <TabularProvider>
          <TableProvider
            tabularNode={tabularNode}
            view={view}
            tableNode={tableNode}
          >
            <SelectionContextProvider>
              <EditingContextProvider>
                <TabularWrapper />
              </EditingContextProvider>
            </SelectionContextProvider>
          </TableProvider>
        </TabularProvider>
      </CodeMirrorViewContextProvider>
    </ErrorBoundary>
  )
}

const TabularWrapper: FC = () => {
  const { setSelection, selection } = useSelectionContext()
  const { commitCellData, cellData } = useEditingContext()
  const { ref } = useTabularContext()
  useEffect(() => {
    const listener: (event: MouseEvent) => void = event => {
      if (!ref.current?.contains(event.target as Node)) {
        if (selection) {
          setSelection(null)
        }
        if (cellData) {
          commitCellData()
        }
      }
    }
    window.addEventListener('mousedown', listener)

    return () => {
      window.removeEventListener('mousedown', listener)
    }
  }, [cellData, commitCellData, selection, setSelection, ref])
  return (
    <div className="table-generator" ref={ref}>
      <Toolbar />
      <Table />
    </div>
  )
}
