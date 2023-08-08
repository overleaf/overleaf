import { useCallback } from 'react'
import {
  TableSelection,
  useSelectionContext,
} from './contexts/selection-context'
import classNames from 'classnames'

export const ColumnSelector = ({
  index,
  rows,
}: {
  index: number
  rows: number
}) => {
  const { selection, setSelection } = useSelectionContext()
  const onColumnSelect = useCallback(() => {
    setSelection(
      new TableSelection(
        { row: 0, cell: index },
        { row: rows - 1, cell: index }
      )
    )
  }, [rows, index, setSelection])
  const fullySelected = selection?.isColumnSelected(index, rows)
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

export const RowSelector = ({
  index,
  columns,
}: {
  index: number
  columns: number
}) => {
  const { selection, setSelection } = useSelectionContext()
  const onSelect = useCallback(() => {
    setSelection(
      new TableSelection(
        { row: index, cell: 0 },
        { row: index, cell: columns - 1 }
      )
    )
  }, [index, setSelection, columns])
  const fullySelected = selection?.isRowSelected(index, columns)
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
