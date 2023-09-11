import { MouseEventHandler, useCallback } from 'react'
import {
  TableSelection,
  useSelectionContext,
} from './contexts/selection-context'
import classNames from 'classnames'
import { useTableContext } from './contexts/table-context'

export const ColumnSelector = ({ index }: { index: number }) => {
  const { selection, setSelection } = useSelectionContext()
  const { table } = useTableContext()
  const onColumnSelect: MouseEventHandler = useCallback(
    event => {
      event.preventDefault()
      if (!selection) {
        setSelection(
          new TableSelection(
            { row: 0, cell: index },
            { row: table.rows.length - 1, cell: index }
          )
        )
        return
      }
      setSelection(selection.selectColumn(index, event.shiftKey, table))
    },
    [index, setSelection, selection, table]
  )
  const fullySelected = selection?.isColumnSelected(index, table)
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <td
      onMouseDown={onColumnSelect}
      className={classNames('table-generator-selector-cell column-selector', {
        'fully-selected': fullySelected,
      })}
    />
  )
}

export const RowSelector = ({ index }: { index: number }) => {
  const { table } = useTableContext()
  const { selection, setSelection } = useSelectionContext()
  const onSelect: MouseEventHandler = useCallback(
    event => {
      event.preventDefault()
      if (!selection) {
        setSelection(
          new TableSelection(
            { row: index, cell: 0 },
            { row: index, cell: table.columns.length - 1 }
          )
        )
        return
      }
      setSelection(selection.selectRow(index, event.shiftKey, table))
    },
    [index, setSelection, table, selection]
  )
  const fullySelected = selection?.isRowSelected(index, table)
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <td
      onMouseDown={onSelect}
      className={classNames('table-generator-selector-cell row-selector', {
        'fully-selected': fullySelected,
      })}
    />
  )
}
