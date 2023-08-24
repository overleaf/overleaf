import { FC } from 'react'
import { ColumnDefinition, RowData } from './tabular'
import { Cell } from './cell'
import { RowSelector } from './selectors'

const normalizedCellIndex = (row: RowData, index: number) => {
  let normalized = 0
  for (let i = 0; i < index; ++i) {
    normalized += row.cells[i].multiColumn?.columnSpan ?? 1
  }
  return normalized
}

export const Row: FC<{
  rowIndex: number
  row: RowData
  columnSpecifications: ColumnDefinition[]
}> = ({ columnSpecifications, row, rowIndex }) => {
  return (
    <tr>
      <RowSelector index={rowIndex} />
      {row.cells.map((cell, cellIndex) => (
        <Cell
          key={cellIndex}
          cellData={cell}
          rowIndex={rowIndex}
          row={row}
          columnIndex={normalizedCellIndex(row, cellIndex)}
          columnSpecification={
            columnSpecifications[normalizedCellIndex(row, cellIndex)]
          }
        />
      ))}
    </tr>
  )
}
