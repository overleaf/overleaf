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
import { useCodeMirrorViewContext } from '../codemirror-context'
import { undo, redo } from '@codemirror/commands'
import { ChangeSpec } from '@codemirror/state'
import { startCompileKeypress } from '@/features/pdf-preview/hooks/use-compile-triggers'
import { useTabularContext } from './contexts/tabular-context'
import { ColumnSizeIndicator } from './column-size-indicator'
import { isMac } from '@/shared/utils/os'

type NavigationKey =
  | 'ArrowRight'
  | 'ArrowLeft'
  | 'ArrowUp'
  | 'ArrowDown'
  | 'Tab'

type NavigationMap = {
  // eslint-disable-next-line no-unused-vars
  [key in NavigationKey]: {
    run: () => TableSelection
    shift: () => TableSelection
    canExitEditing?: boolean
  }
}

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
  const { openColumnWidthModal, columnWidthModalShown } = useTabularContext()
  const tableRef = useRef<HTMLTableElement>(null)
  const view = useCodeMirrorViewContext()
  const { columns: cellWidths, tableWidth } = useMemo(() => {
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
      columns[i] = Math.round((columns[i] / totalLog) * 100)
    }
    return { columns, tableWidth: total }
  }, [
    tableData,
    cellData?.cellIndex,
    cellData?.rowIndex,
    cellData?.content.length,
  ])

  const navigation: NavigationMap = useMemo(
    () => ({
      ArrowRight: {
        run: () => selection!.moveRight(tableData),
        shift: () => selection!.extendRight(tableData),
      },
      ArrowLeft: {
        run: () => selection!.moveLeft(tableData),
        shift: () => selection!.extendLeft(tableData),
      },
      ArrowUp: {
        run: () => selection!.moveUp(tableData),
        shift: () => selection!.extendUp(tableData),
      },
      ArrowDown: {
        run: () => selection!.moveDown(tableData),
        shift: () => selection!.extendDown(tableData),
      },
      Tab: {
        run: () => selection!.moveNext(tableData),
        shift: () => selection!.movePrevious(tableData),
        canExitEditing: true,
      },
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
      if (startCompileKeypress(event)) {
        return
      }
      if (view.state.readOnly) {
        return
      }
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
        const {
          run: defaultNavigation,
          shift: shiftNavigation,
          canExitEditing,
        } = navigation[event.code as NavigationKey]
        if (cellData) {
          if (!canExitEditing) {
            return
          }
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
        const newSelection = event.shiftKey
          ? shiftNavigation()
          : defaultNavigation()
        if (cellData && canExitEditing) {
          commitCellData()
        }
        setSelection(newSelection)
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
      if (view.state.readOnly) {
        return false
      }
      if (cellData || !selection || columnWidthModalShown) {
        // We're editing a cell, or modifying column widths,
        // so allow browser to insert there
        return false
      }
      event.preventDefault()
      const changes: ChangeSpec[] = []
      const data = event.clipboardData?.getData('text/plain')
      if (data) {
        const cells = data.split('\n').map(row => row.split('\t'))
        const { minY, minX } = selection.normalized()
        for (let row = 0; row < cells.length; ++row) {
          const rowIndex = minY + row
          if (rowIndex >= tableData.rows.length) {
            // TODO: add more rows
            break
          }
          const cellStart = tableData.getCellIndex(rowIndex, minX)
          for (let column = 0; column < cells[row].length; ++column) {
            const cellIndex = cellStart + column
            if (cellIndex >= tableData.rows[rowIndex].cells.length) {
              // TODO: add more columns
              break
            }
            const cell = tableData.rows[rowIndex].cells[cellIndex]
            changes.push({
              from: cell.from,
              to: cell.to,
              insert: cells[row][column],
            })
          }
        }
      }
      view.dispatch({ changes })
    }

    const onCopy = (event: ClipboardEvent) => {
      if (cellData || !selection || columnWidthModalShown) {
        // We're editing a cell, or modifying column widths,
        // so allow browser to copy from there
        return false
      }
      event.preventDefault()
      const { minY, maxY } = selection.normalized()
      const cells: string[][] = Array.from(
        { length: maxY - minY + 1 },
        () => []
      )
      tableData.iterateSelection(selection, (cell, row) => {
        cells[row - minY].push(cell.content)
      })
      const content = cells.map(row => row.join('\t')).join('\n')
      navigator.clipboard.writeText(content)
    }
    window.addEventListener('paste', onPaste)
    window.addEventListener('copy', onCopy)
    return () => {
      window.removeEventListener('paste', onPaste)
      window.removeEventListener('copy', onCopy)
    }
  }, [cellData, selection, tableData, view, columnWidthModalShown])

  const hasCustomSizes = useMemo(
    () => tableData.columns.some(x => x.size),
    [tableData.columns]
  )

  const onSizeClick = (index: number) => {
    setSelection(
      new TableSelection(
        { row: 0, cell: index },
        { row: tableData.rows.length - 1, cell: index }
      )
    )
    openColumnWidthModal()
  }

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <table
      className="table-generator-table"
      onKeyDown={onKeyDown}
      tabIndex={-1}
      ref={tableRef}
      style={{ width: `min(${tableWidth}ch, 95%)` }}
    >
      <colgroup>
        <col width="20" />
        {tableData.columns.map((_, index) => (
          <col key={index} width={`${cellWidths[index]}%`} />
        ))}
      </colgroup>
      <thead>
        {hasCustomSizes && (
          <tr className="table-generator-column-widths-row">
            <td />
            {tableData.columns.map((column, columnIndex) => (
              <td align="center" key={columnIndex}>
                {column.size && (
                  <ColumnSizeIndicator
                    size={column.size}
                    onClick={() => onSizeClick(columnIndex)}
                  />
                )}
              </td>
            ))}
          </tr>
        )}
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
