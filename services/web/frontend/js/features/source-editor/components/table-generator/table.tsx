import {
  FC,
  KeyboardEvent,
  KeyboardEventHandler,
  useCallback,
  useEffect,
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
import { undo, redo } from '@codemirror/commands'
import { ChangeSpec } from '@codemirror/state'

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

const isMac = /Mac/.test(window.navigator?.platform)
const MINIMUM_CELL_WIDTH_CHARACTERS = 15
const MINIMUM_EDITING_CELL_WIDTH_CHARACTERS = 20
const CELL_WIDTH_BUFFER = 3 // characters

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
  const cellWidths: number[] = useMemo(() => {
    const columns = Array.from(
      { length: tableData.columns.length },
      () => MINIMUM_CELL_WIDTH_CHARACTERS
    )
    // First pass, calculate the optimal width of each column. For the cell
    // we're editing, make sure there's space to write into as well
    // (MINIMUM_EDITING_CELL_WIDTH_CHARACTERS)
    for (let row = 0; row < tableData.rows.length; ++row) {
      for (
        let i = 0;
        i < tableData.columns.length;
        i += tableData.getCell(row, i).multiColumn?.columnSpan ?? 1
      ) {
        const columnSpan =
          tableData.getCell(row, i).multiColumn?.columnSpan ?? 1
        let contentLength =
          tableData.getCell(row, i).content.length + CELL_WIDTH_BUFFER
        if (cellData?.rowIndex === row && cellData?.cellIndex === i) {
          contentLength = Math.max(
            contentLength,
            Math.min(
              cellData.content.length + CELL_WIDTH_BUFFER,
              MINIMUM_EDITING_CELL_WIDTH_CHARACTERS
            )
          )
        }
        for (let j = 0; j < columnSpan; ++j) {
          columns[i + j] = Math.max(columns[i + j], contentLength / columnSpan)
        }
      }
    }
    // Second pass, use a logarithmic scale to not drown out narrow columns
    // completely
    const total = columns.reduce((a, b) => a + b, 0)
    for (let i = 0; i < columns.length; ++i) {
      columns[i] = Math.log2(columns[i])
    }

    // Third pass, normalize the columns to the total width of the table
    const totalLog = columns.reduce((a, b) => a + b, 0)
    for (let i = 0; i < columns.length; ++i) {
      columns[i] = Math.round((columns[i] / totalLog) * total)
    }
    return columns
  }, [
    tableData,
    cellData?.cellIndex,
    cellData?.rowIndex,
    cellData?.content.length,
  ])

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
      Boolean(event.code) && // is a keyboard key
      event.key?.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    )
  }, [])

  const onKeyDown: KeyboardEventHandler = useCallback(
    event => {
      const commandKey = isMac ? event.metaKey : event.ctrlKey
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
        view.requestMeasure()
        setTimeout(() => {
          if (tableRef.current) {
            const { minY } = selection.normalized()
            const row = tableRef.current.querySelectorAll('tbody tr')[minY]
            if (row) {
              if (row.getBoundingClientRect().top < 0) {
                row.scrollIntoView({ block: 'center' })
              }
            }
          }
        }, 0)
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
      } else if (
        !cellData &&
        event.key === 'z' &&
        !event.shiftKey &&
        commandKey
      ) {
        event.preventDefault()
        undo(view)
      } else if (
        !cellData &&
        (event.key === 'y' ||
          (event.key === 'Z' && event.shiftKey && commandKey))
      ) {
        event.preventDefault()
        redo(view)
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

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (cellData || !selection) {
        // We're editing a cell, so allow browser to insert there
        return false
      }
      event.preventDefault()
      const changes: ChangeSpec[] = []
      const data = event.clipboardData?.getData('text/plain')
      if (data) {
        const rows = data.split('\n')
        const { minX, minY } = selection.normalized()
        for (let row = 0; row < rows.length; row++) {
          if (tableData.rows.length <= minY + row) {
            // TODO: Add rows
            continue
          }
          const cells = rows[row].split('\t')
          for (let cell = 0; cell < cells.length; cell++) {
            if (tableData.columns.length <= minX + cell) {
              // TODO: Add columns
              continue
            }
            const cellData = tableData.getCell(minY + row, minX + cell)
            changes.push({
              from: cellData.from,
              to: cellData.to,
              insert: cells[cell],
            })
          }
        }
      }
      view.dispatch({ changes })
    }

    const onCopy = (event: ClipboardEvent) => {
      if (cellData || !selection) {
        // We're editing a cell, so allow browser to insert there
        return false
      }
      event.preventDefault()
      const { minX, minY, maxX, maxY } = selection.normalized()
      const content = []
      for (let row = minY; row <= maxY; row++) {
        const rowContent = []
        for (let cell = minX; cell <= maxX; cell++) {
          rowContent.push(tableData.getCell(row, cell).content)
        }
        content.push(rowContent.join('\t'))
      }
      navigator.clipboard.writeText(content.join('\n'))
    }
    window.addEventListener('paste', onPaste)
    window.addEventListener('copy', onCopy)
    return () => {
      window.removeEventListener('paste', onPaste)
      window.removeEventListener('copy', onCopy)
    }
  }, [cellData, selection, tableData, view])

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <table
      className="table-generator-table"
      onKeyDown={onKeyDown}
      tabIndex={-1}
      ref={tableRef}
    >
      <thead>
        {/* A workaround for a chrome bug where it will not respect colspan
            unless there is a row filled with cells without colspan */}
        <tr className="table-generator-filler-row">
          {/* A td for the row selector */}
          <td />
          {tableData.columns.map((_, columnIndex) => (
            <td
              key={columnIndex}
              style={{ width: `${cellWidths[columnIndex]}ch` }}
            />
          ))}
        </tr>
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
      </tbody>
    </table>
  )
}
