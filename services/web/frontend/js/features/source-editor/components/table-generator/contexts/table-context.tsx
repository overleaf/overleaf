import { FC, createContext, useContext } from 'react'
import { Positions, TableData } from '../tabular'
import {
  CellPosition,
  CellSeparator,
  RowPosition,
  RowSeparator,
  generateTable,
} from '../utils'
import { EditorView } from '@codemirror/view'
import { SyntaxNode } from '@lezer/common'

const TableContext = createContext<
  | {
      table: TableData
      cellPositions: CellPosition[][]
      specification: { from: number; to: number }
      rowPositions: RowPosition[]
      rowSeparators: RowSeparator[]
      cellSeparators: CellSeparator[][]
      positions: Positions
    }
  | undefined
>(undefined)

export const TableProvider: FC<{
  tabularNode: SyntaxNode
  view: EditorView
}> = ({ tabularNode, view, children }) => {
  const tableData = generateTable(tabularNode, view.state)

  // TODO: Validate better that the table matches the column definition
  for (const row of tableData.table.rows) {
    if (row.cells.length !== tableData.table.columns.length) {
      throw new Error("Table doesn't match column definition")
    }
  }

  const positions: Positions = {
    cells: tableData.cellPositions,
    columnDeclarations: tableData.specification,
    rowPositions: tableData.rowPositions,
  }
  return (
    <TableContext.Provider value={{ ...tableData, positions }}>
      {children}
    </TableContext.Provider>
  )
}

export const useTableContext = () => {
  const context = useContext(TableContext)
  if (context === undefined) {
    throw new Error('useTableContext must be used within a TableProvider')
  }
  return context
}
