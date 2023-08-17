import { FC, MouseEventHandler, useCallback, useEffect, useRef } from 'react'
import { CellData, ColumnDefinition, RowData } from './tabular'
import classNames from 'classnames'
import {
  TableSelection,
  useSelectionContext,
} from './contexts/selection-context'
import { useEditingContext } from './contexts/editing-context'
import { loadMathJax } from '../../../mathjax/load-mathjax'
import { typesetNodeIntoElement } from '../../extensions/visual/utils/typeset-content'
import { parser } from '../../lezer-latex/latex.mjs'

export const Cell: FC<{
  cellData: CellData
  columnSpecification: ColumnDefinition
  rowIndex: number
  columnIndex: number
  row: RowData
}> = ({ cellData, columnSpecification, rowIndex, columnIndex, row }) => {
  const { selection, setSelection, dragging, setDragging } =
    useSelectionContext()
  const renderDiv = useRef<HTMLDivElement>(null)
  const cellRef = useRef<HTMLTableCellElement>(null)
  const {
    cellData: editingCellData,
    updateCellData: update,
    startEditing,
  } = useEditingContext()
  const inputRef = useRef<HTMLInputElement>(null)

  const editing =
    editingCellData?.rowIndex === rowIndex &&
    editingCellData?.cellIndex === columnIndex

  const onMouseDown: MouseEventHandler = useCallback(
    event => {
      if (event.button !== 0) {
        return
      }
      setDragging(true)
      document.getSelection()?.empty()
      setSelection(current => {
        if (event.shiftKey && current) {
          return new TableSelection(current.from, {
            cell: columnIndex,
            row: rowIndex,
          })
        }
        return new TableSelection({ cell: columnIndex, row: rowIndex })
      })
    },
    [setDragging, columnIndex, rowIndex, setSelection]
  )

  const onMouseUp = useCallback(() => {
    if (dragging) {
      setDragging(false)
    }
  }, [setDragging, dragging])

  const onMouseMove: MouseEventHandler = useCallback(
    event => {
      if (dragging) {
        if (event.buttons !== 1) {
          setDragging(false)
          return
        }
        document.getSelection()?.empty()
        if (
          selection?.to.cell === columnIndex &&
          selection?.to.row === rowIndex
        ) {
          // Do nothing if selection has remained the same
          return
        }
        event.stopPropagation()
        setSelection(current => {
          if (current) {
            return new TableSelection(current.from, {
              row: rowIndex,
              cell: columnIndex,
            })
          } else {
            return new TableSelection({ row: rowIndex, cell: columnIndex })
          }
        })
      }
    },
    [dragging, columnIndex, rowIndex, setSelection, selection, setDragging]
  )

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
    }
  }, [editing])

  const filterInput = (input: string) => {
    // TODO: Are there situations where we don't want to filter the input?
    return input
      .replaceAll(/(^&|[^\\]&)/g, match =>
        match.length === 1 ? '\\&' : `${match[0]}\\&`
      )
      .replaceAll('\\\\', '')
  }

  const isFocused =
    selection?.to.cell === columnIndex && selection?.to.row === rowIndex

  useEffect(() => {
    if (isFocused && !editing && cellRef.current) {
      cellRef.current.focus()
    }
  }, [isFocused, editing])

  useEffect(() => {
    const toDisplay = cellData.content.trim()
    if (renderDiv.current && !editing) {
      const tree = parser.parse(toDisplay)
      const node = tree.topNode

      typesetNodeIntoElement(
        node,
        renderDiv.current,
        toDisplay.substring.bind(toDisplay)
      )
      loadMathJax().then(async MathJax => {
        if (renderDiv.current) {
          await MathJax.typesetPromise([renderDiv.current])
        }
      })
    }
  }, [cellData.content, editing])

  let body = <div ref={renderDiv} />
  if (editing) {
    body = (
      <input
        className="table-generator-cell-input"
        ref={inputRef}
        value={editingCellData.content}
        style={{ width: `inherit` }}
        onChange={e => {
          update(filterInput(e.target.value))
        }}
      />
    )
  }

  const inSelection = selection?.contains({ row: rowIndex, cell: columnIndex })

  const onDoubleClick = useCallback(() => {
    startEditing(rowIndex, columnIndex, cellData.content.trim())
  }, [columnIndex, rowIndex, cellData, startEditing])

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <td
      onDoubleClick={onDoubleClick}
      tabIndex={row.cells.length * rowIndex + columnIndex + 1}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseMove={onMouseMove}
      ref={cellRef}
      className={classNames('table-generator-cell', {
        'table-generator-cell-border-left': columnSpecification.borderLeft > 0,
        'table-generator-cell-border-right':
          columnSpecification.borderRight > 0,
        'table-generator-row-border-top': row.borderTop > 0,
        'table-generator-row-border-bottom': row.borderBottom > 0,
        'alignment-left': columnSpecification.alignment === 'left',
        'alignment-center': columnSpecification.alignment === 'center',
        'alignment-right': columnSpecification.alignment === 'right',
        'alignment-paragraph': columnSpecification.alignment === 'paragraph',
        selected: inSelection,
        'selection-edge-top': inSelection && selection?.bordersTop(rowIndex),
        'selection-edge-bottom':
          inSelection && selection?.bordersBottom(rowIndex),
        'selection-edge-left':
          inSelection && selection?.bordersLeft(columnIndex),
        'selection-edge-right':
          inSelection && selection?.bordersRight(columnIndex),
      })}
    >
      {body}
    </td>
  )
}
