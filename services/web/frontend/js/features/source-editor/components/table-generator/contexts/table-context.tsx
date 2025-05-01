import { FC, createContext, useContext } from 'react'
import { Positions, TableData, TableRenderingError } from '../tabular'
import {
  CellPosition,
  CellSeparator,
  ParsedTableData,
  RowPosition,
  RowSeparator,
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
      directTableChild?: boolean
    }
  | undefined
>(undefined)

export const TableProvider: FC<
  React.PropsWithChildren<{
    tableData: ParsedTableData
    tableNode: SyntaxNode | null
    tabularNode: SyntaxNode
    view: EditorView
    directTableChild?: boolean
  }>
> = ({
  tableData,
  children,
  tableNode,
  tabularNode,
  view,
  directTableChild,
}) => {
  try {
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
          directTableChild,
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
