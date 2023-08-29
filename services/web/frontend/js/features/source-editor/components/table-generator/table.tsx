import {
  FC,
  KeyboardEvent,
  KeyboardEventHandler,
  useCallback,
  useMemo,
  useRef,
} from 'react'
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
  const {
    cellData,
    cancelEditing,
    startEditing,
    commitCellData,
    clearCells,
    updateCellData,
  } = useEditingContext()
  const { table: tableData } = useTableContext()
  const tableRef = useRef<HTMLTableElement>(null)
  const view = useCodeMirrorViewContext()

  const navigation: NavigationMap = useMemo(
    () => ({
      ArrowRight: [
        () => selection!.moveRight(tableData),
        () => selection!.extendRight(tableData),
      ],
      ArrowLeft: [
        () => selection!.moveLeft(tableData),
        () => selection!.extendLeft(tableData),
      ],
      ArrowUp: [
        () => selection!.moveUp(tableData),
        () => selection!.extendUp(tableData),
      ],
      ArrowDown: [
        () => selection!.moveDown(tableData),
        () => selection!.extendDown(tableData),
      ],
      Tab: [
        () => selection!.moveNext(tableData),
        () => selection!.movePrevious(tableData),
      ],
    }),
    [selection, tableData]
  )

  const isCharacterInput = useCallback((event: KeyboardEvent) => {
    return (
      event.key?.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    )
  }, [])

  const onKeyDown: KeyboardEventHandler = useCallback(
    event => {
      if (event.code === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        event.stopPropagation()
        if (!selection) {
          return
        }
        if (cellData) {
          commitCellData()
        } else {
          const initialContent = tableData.getCell(
            selection.to.row,
            selection.to.cell
          ).content
          startEditing(selection.to.row, selection.to.cell, initialContent)
        }
        setSelection(
          new TableSelection(selection.to, selection.to).explode(tableData)
        )
      } else if (event.code === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        if (!cellData) {
          setSelection(null)
          view.focus()
        } else {
          cancelEditing()
        }
      } else if (event.code === 'Delete' || event.code === 'Backspace') {
        if (cellData) {
          return
        }
        if (!selection) {
          return
        }
        event.preventDefault()
        event.stopPropagation()
        clearCells(selection)
      } else if (Object.prototype.hasOwnProperty.call(navigation, event.code)) {
        const [defaultNavigation, shiftNavigation] =
          navigation[event.code as NavigationKey]
        if (cellData) {
          return
        }
        event.preventDefault()
        if (!selection) {
          setSelection(
            new TableSelection(
              { row: 0, cell: 0 },
              { row: 0, cell: 0 }
            ).explode(tableData)
          )
          return
        }
        if (event.shiftKey) {
          setSelection(shiftNavigation())
        } else {
          setSelection(defaultNavigation())
        }
      } else if (isCharacterInput(event) && !cellData) {
        event.preventDefault()
        event.stopPropagation()
        if (!selection) {
          return
        }
        startEditing(selection.to.row, selection.to.cell)
        updateCellData(event.key)
        setSelection(new TableSelection(selection.to, selection.to))
      }
    },
    [
      selection,
      cellData,
      setSelection,
      cancelEditing,
      startEditing,
      commitCellData,
      navigation,
      view,
      clearCells,
      updateCellData,
      isCharacterInput,
      tableData,
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
            <ColumnSelector index={columnIndex} key={columnIndex} />
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
        {/* A workaround for a chrome bug where it will not respect colspan 
            unless there is a row filled with cells without colspan */}
        <tr className="table-generator-filler-row">
          {/* A td for the row selector */}
          <td />
          {tableData.columns.map((_, columnIndex) => (
            <td key={columnIndex} />
          ))}
        </tr>
      </tbody>
    </table>
  )
}
