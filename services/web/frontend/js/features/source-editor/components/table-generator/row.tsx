import { FC } from 'react'
import { ColumnDefinition, RowData } from './tabular'
import { Cell } from './cell'
import { RowSelector } from './selectors'

export const Row: FC<{
  rowIndex: number
  row: RowData
  columnSpecifications: ColumnDefinition[]
}> = ({ columnSpecifications, row, rowIndex }) => {
  return (
    <tr>
      <RowSelector index={rowIndex} columns={row.cells.length} />
      {row.cells.map((cell, cellIndex) => (
        <Cell
          key={cellIndex}
          cellData={cell}
          rowIndex={rowIndex}
          row={row}
          columnIndex={cellIndex}
          columnSpecification={columnSpecifications[cellIndex]}
        />
      ))}
    </tr>
  )
}
