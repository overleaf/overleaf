import { FC, KeyboardEventHandler, useCallback } from 'react'
import { Row } from './row'
import { ColumnSelector } from './selectors'
import { useSelectionContext } from './contexts/selection-context'
import { useEditingContext } from './contexts/editing-context'
import { useTableContext } from './contexts/table-context'

export const Table: FC = () => {
  const { selection, setSelection } = useSelectionContext()
  const { cellData, cancelEditing, startEditing } = useEditingContext()
  const { table: tableData } = useTableContext()
  const onKeyDown: KeyboardEventHandler = useCallback(
    event => {
      if (event.code === 'Enter') {
        event.preventDefault()
        event.stopPropagation()
        if (!selection) {
          return
        }
        const cell =
          tableData.rows[selection.from.row].cells[selection.from.cell]
        startEditing(selection.from.row, selection.from.cell, cell.content)
      } else if (event.code === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        if (!cellData) {
          setSelection(null)
        } else {
          cancelEditing()
        }
      }
    },
    [
      selection,
      tableData.rows,
      cellData,
      setSelection,
      cancelEditing,
      startEditing,
    ]
  )
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <table
      className="table-generator-table"
      onKeyDown={onKeyDown}
      tabIndex={-1}
    >
      <thead>
        <tr>
          <td />
          {tableData.columns.map((_, columnIndex) => (
            <ColumnSelector
              index={columnIndex}
              key={columnIndex}
              rows={tableData.rows.length}
            />
          ))}
        </tr>
      </thead>
      <tbody>
        {tableData.rows.map((row, rowIndex) => (
          <Row
            row={row}
            rowIndex={rowIndex}
            key={rowIndex}
            columnSpecifications={tableData.columns}
          />
        ))}
      </tbody>
    </table>
  )
}
