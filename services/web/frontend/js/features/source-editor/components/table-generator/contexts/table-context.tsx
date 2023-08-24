import { FC, createContext, useContext } from 'react'
import { Positions, TableData, TableRenderingError } from '../tabular'
import {
  CellPosition,
  CellSeparator,
  RowPosition,
  RowSeparator,
  generateTable,
  parseTableEnvironment,
} from '../utils'
import { EditorView } from '@codemirror/view'
import { SyntaxNode } from '@lezer/common'

export type TableEnvironmentData = {
  table: { from: number; to: number }
  caption?: { from: number; to: number }
  label?: { from: number; to: number }
}

const TableContext = createContext<
  | {
      table: TableData
      cellPositions: CellPosition[][]
      specification: { from: number; to: number }
      rowPositions: RowPosition[]
      rowSeparators: RowSeparator[]
      cellSeparators: CellSeparator[][]
      positions: Positions
      tableEnvironment?: TableEnvironmentData
      rows: number
      columns: number
    }
  | undefined
>(undefined)

export const TableProvider: FC<{
  tabularNode: SyntaxNode
  view: EditorView
  tableNode: SyntaxNode | null
}> = ({ tabularNode, view, children, tableNode }) => {
  try {
    const tableData = generateTable(tabularNode, view.state)

    // TODO: Validate better that the table matches the column definition
    for (const row of tableData.table.rows) {
      const rowLength = row.cells.reduce(
        (acc, cell) => acc + (cell.multiColumn?.columnSpan ?? 1),
        0
      )
      for (const cell of row.cells) {
        if (
          cell.multiColumn?.columns.specification &&
          cell.multiColumn.columns.specification.length !== 1
        ) {
          throw new Error(
            'Multi-column cells must have exactly one column definition'
          )
        }
      }
      if (rowLength !== tableData.table.columns.length) {
        throw new Error('Row length does not match column definition')
      }
    }

    const positions: Positions = {
      cells: tableData.cellPositions,
      columnDeclarations: tableData.specification,
      rowPositions: tableData.rowPositions,
      tabular: { from: tabularNode.from, to: tabularNode.to },
    }

    const tableEnvironment = tableNode
      ? parseTableEnvironment(tableNode)
      : undefined

    return (
      <TableContext.Provider
        value={{
          ...tableData,
          positions,
          tableEnvironment,
          rows: tableData.table.rows.length,
          columns: tableData.table.columns.length,
        }}
      >
        {children}
      </TableContext.Provider>
    )
  } catch {
    return <TableRenderingError view={view} codePosition={tabularNode.from} />
  }
}

export const useTableContext = () => {
  const context = useContext(TableContext)
  if (context === undefined) {
    throw new Error('useTableContext must be used within a TableProvider')
  }
  return context
}
