import { FC, KeyboardEventHandler, useCallback, useMemo, useRef } from 'react'
import { Row } from './row'
import { ColumnSelector } from './selectors'
import {
  TableSelection,
  useSelectionContext,
} from './contexts/selection-context'
import { useEditingContext } from './contexts/editing-context'
import { useTableContext } from './contexts/table-context'
import { useCodeMirrorViewContext } from '../codemirror-editor'

type NavigationKey =
  | 'ArrowRight'
  | 'ArrowLeft'
  | 'ArrowUp'
  | 'ArrowDown'
  | 'Tab'

type NavigationMap = {
  // eslint-disable-next-line no-unused-vars
  [key in NavigationKey]: [() => TableSelection, () => TableSelection]
}

export const Table: FC = () => {
  const { selection, setSelection } = useSelectionContext()
  const { cellData, cancelEditing, startEditing, commitCellData } =
    useEditingContext()
  const { table: tableData } = useTableContext()
  const tableRef = useRef<HTMLTableElement>(null)
  const view = useCodeMirrorViewContext()

  const navigation: NavigationMap = useMemo(
    () => ({
      ArrowRight: [
        () => selection!.moveRight(tableData.columns.length),
        () => selection!.extendRight(tableData.columns.length),
      ],
      ArrowLeft: [() => selection!.moveLeft(), () => selection!.extendLeft()],
      ArrowUp: [() => selection!.moveUp(), () => selection!.extendUp()],
      ArrowDown: [
        () => selection!.moveDown(tableData.rows.length),
        () => selection!.extendDown(tableData.rows.length),
      ],
      Tab: [
        () =>
          selection!.moveNext(tableData.columns.length, tableData.rows.length),
        () => selection!.movePrevious(tableData.columns.length),
      ],
    }),
    [selection, tableData.columns.length, tableData.rows.length]
  )

  const onKeyDown: KeyboardEventHandler = useCallback(
    event => {
      if (event.code === 'Enter') {
        event.preventDefault()
        event.stopPropagation()
        if (!selection) {
          return
        }
        if (cellData) {
          commitCellData()
          return
        }
        const cell = tableData.rows[selection.to.row].cells[selection.to.cell]
        startEditing(selection.to.row, selection.to.cell, cell.content)
        setSelection(new TableSelection(selection.to, selection.to))
      } else if (event.code === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        if (!cellData) {
          setSelection(null)
          view.focus()
        } else {
          cancelEditing()
        }
      } else if (Object.prototype.hasOwnProperty.call(navigation, event.code)) {
        const [defaultNavigation, shiftNavigation] =
          navigation[event.code as NavigationKey]
        if (cellData) {
          return
        }
        event.preventDefault()
        if (!selection) {
          setSelection(
            new TableSelection({ row: 0, cell: 0 }, { row: 0, cell: 0 })
          )
          return
        }
        if (event.shiftKey) {
          setSelection(shiftNavigation())
        } else {
          setSelection(defaultNavigation())
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
      commitCellData,
      navigation,
      view,
    ]
  )
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <table
      className="table-generator-table"
      onKeyDown={onKeyDown}
      tabIndex={-1}
      ref={tableRef}
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
