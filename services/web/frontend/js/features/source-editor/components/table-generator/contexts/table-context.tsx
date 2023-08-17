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
    }
  | undefined
>(undefined)

export const TableProvider: FC<{
  tabularNode: SyntaxNode
  view: EditorView
  tableNode: SyntaxNode | null
}> = ({ tabularNode, view, children, tableNode }) => {
  const tableData = generateTable(tabularNode, view.state)

  // TODO: Validate better that the table matches the column definition
  for (const row of tableData.table.rows) {
    if (row.cells.length !== tableData.table.columns.length) {
      return <TableRenderingError view={view} codePosition={tabularNode.from} />
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
      }}
    >
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
