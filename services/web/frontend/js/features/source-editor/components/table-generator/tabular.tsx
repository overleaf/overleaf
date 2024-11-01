import { SyntaxNode } from '@lezer/common'
import { FC, useEffect } from 'react'
import { CellPosition, ParsedTableData, RowPosition } from './utils'
import { Toolbar } from './toolbar/toolbar'
import { Table } from './table'
import {
  SelectionContextProvider,
  TableSelection,
  useSelectionContext,
} from './contexts/selection-context'
import {
  EditingContextProvider,
  useEditingContext,
} from './contexts/editing-context'
import { EditorView } from '@codemirror/view'
import { ErrorBoundary } from 'react-error-boundary'
import { EditorSelection } from '@codemirror/state'
import {
  CodeMirrorViewContext,
  useCodeMirrorViewContext,
} from '../codemirror-context'
import { TableProvider } from './contexts/table-context'
import { TabularProvider, useTabularContext } from './contexts/tabular-context'
import { BorderTheme } from './toolbar/commands'
import { TableGeneratorHelpModal } from './help-modal'
import { SplitTestProvider } from '../../../../shared/context/split-test-context'
import { useTranslation } from 'react-i18next'
import { ColumnWidthModal } from './toolbar/column-width-modal/modal'
import { WidthSelection } from './toolbar/column-width-modal/column-width'
import Notification from '@/shared/components/notification'
import OLButton from '@/features/ui/components/ol/ol-button'

export type ColumnDefinition = {
  alignment: 'left' | 'center' | 'right' | 'paragraph'
  borderLeft: number
  borderRight: number
  content: string
  cellSpacingLeft: string
  cellSpacingRight: string
  customCellDefinition: string
  isParagraphColumn: boolean
  size?: WidthSelection
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

  iterateCells(
    minRow: number,
    maxRow: number,
    minColumn: number,
    maxColumn: number,
    callback: (cell: CellData, row: number, column: number) => void
  ) {
    for (let row = minRow; row <= maxRow; ++row) {
      let currentCellOffset = this.getCellBoundaries(row, minColumn).from
      const minX = this.getCellIndex(row, minColumn)
      const maxX = this.getCellIndex(row, maxColumn)
      for (let column = minX; column <= maxX; ++column) {
        const currentCell = this.rows[row].cells[column]
        const skip = currentCell.multiColumn?.columnSpan ?? 1
        callback(currentCell, row, currentCellOffset)
        currentCellOffset += skip
      }
    }
  }

  iterateSelection(
    selection: TableSelection,
    callback: (cell: CellData, row: number, column: number) => void
  ) {
    const { minX, maxX, minY, maxY } = selection.normalized()
    this.iterateCells(minY, maxY, minX, maxX, callback)
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
  const { t } = useTranslation()

  return (
    <Notification
      type="info"
      content={
        <>
          <p>
            <strong>
              {t('sorry_your_table_cant_be_displayed_at_the_moment')}
            </strong>
          </p>
          <p>
            {t(
              'this_could_be_because_we_cant_support_some_elements_of_the_table'
            )}
          </p>
        </>
      }
      action={
        codePosition !== undefined ? (
          <OLButton
            variant="secondary"
            onClick={() =>
              view.dispatch({
                selection: EditorSelection.cursor(codePosition),
              })
            }
            size="sm"
          >
            {t('view_code')}
          </OLButton>
        ) : undefined
      }
    />
  )
}

export const Tabular: FC<{
  tabularNode: SyntaxNode
  view: EditorView
  tableNode: SyntaxNode | null
  parsedTableData: ParsedTableData
  directTableChild?: boolean
}> = ({ tabularNode, view, tableNode, parsedTableData, directTableChild }) => {
  return (
    <ErrorBoundary
      fallbackRender={() => (
        <TableRenderingError view={view} codePosition={tabularNode.from} />
      )}
    >
      <SplitTestProvider>
        <CodeMirrorViewContext.Provider value={view}>
          <TabularProvider>
            <TableProvider
              tabularNode={tabularNode}
              tableData={parsedTableData}
              tableNode={tableNode}
              directTableChild={directTableChild}
              view={view}
            >
              <SelectionContextProvider>
                <EditingContextProvider>
                  <TabularWrapper />
                </EditingContextProvider>
                <ColumnWidthModal />
              </SelectionContextProvider>
            </TableProvider>
            <TableGeneratorHelpModal />
          </TabularProvider>
        </CodeMirrorViewContext.Provider>
      </SplitTestProvider>
    </ErrorBoundary>
  )
}

const TabularWrapper: FC = () => {
  const { setSelection, selection } = useSelectionContext()
  const { commitCellData, cellData } = useEditingContext()
  const { ref } = useTabularContext()
  const view = useCodeMirrorViewContext()
  useEffect(() => {
    const listener: (event: MouseEvent) => void = event => {
      if (
        !ref.current?.contains(event.target as Node) &&
        !(event.target as HTMLElement).closest('.table-generator-help-modal') &&
        !(event.target as HTMLElement).closest('.table-generator-width-modal')
      ) {
        if (selection) {
          setSelection(null)
        }
        if (cellData) {
          commitCellData()
        }
      } else {
        view.dispatch() // trigger a state update when clicking inside the table
      }
    }
    window.addEventListener('mousedown', listener)

    return () => {
      window.removeEventListener('mousedown', listener)
    }
  }, [cellData, commitCellData, selection, setSelection, ref, view])
  return (
    <div className="table-generator" ref={ref}>
      {!view.state.readOnly && <Toolbar />}
      <Table />
    </div>
  )
}
