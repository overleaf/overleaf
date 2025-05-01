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
import { useTableContext } from './contexts/table-context'
import { CellInput, CellInputRef } from './cell-input'
import { useCodeMirrorViewContext } from '../codemirror-context'

export const Cell: FC<{
  cellData: CellData
  columnSpecification: ColumnDefinition
  rowIndex: number
  columnIndex: number
  row: RowData
}> = ({
  cellData,
  columnSpecification: columnSpecificationFromTabular,
  rowIndex,
  columnIndex,
  row,
}) => {
  const columnSpecification = cellData.multiColumn
    ? cellData.multiColumn.columns.specification[0]
    : columnSpecificationFromTabular
  const { selection, setSelection, dragging, setDragging } =
    useSelectionContext()
  const { table } = useTableContext()
  const renderDiv = useRef<HTMLDivElement>(null)
  const cellRef = useRef<HTMLTableCellElement>(null)
  const {
    cellData: editingCellData,
    updateCellData: update,
    startEditing,
    commitCellData,
  } = useEditingContext()
  const inputRef = useRef<CellInputRef>(null)
  const view = useCodeMirrorViewContext()

  const editing =
    editingCellData?.rowIndex === rowIndex &&
    editingCellData?.cellIndex >= columnIndex &&
    editingCellData?.cellIndex <
      columnIndex + (cellData.multiColumn?.columnSpan ?? 1)

  const onMouseDown: MouseEventHandler = useCallback(
    event => {
      if (editing) {
        return
      }
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
          }).explode(table)
        }
        return new TableSelection({ cell: columnIndex, row: rowIndex }).explode(
          table
        )
      })
    },
    [setDragging, columnIndex, rowIndex, setSelection, table, editing]
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
            }).explode(table)
          } else {
            return new TableSelection({
              row: rowIndex,
              cell: columnIndex,
            }).explode(table)
          }
        })
      }
    },
    [
      dragging,
      columnIndex,
      rowIndex,
      setSelection,
      selection,
      setDragging,
      table,
    ]
  )

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
    }
  }, [editing, cellData.content.length])

  const filterInput = useCallback((input: string) => {
    // TODO: Are there situations where we don't want to filter the input?
    return input
      .replaceAll(/(^&|[^\\]&)/g, match =>
        match.length === 1 ? '\\&' : `${match[0]}\\&`
      )
      .replaceAll(/(^%|[^\\]%)/g, match =>
        match.length === 1 ? '\\%' : `${match[0]}\\%`
      )
      .replaceAll('\\\\', '')
  }, [])

  const isFocused =
    selection?.to.row === rowIndex &&
    selection?.to.cell >= columnIndex &&
    selection?.to.cell < columnIndex + (cellData.multiColumn?.columnSpan ?? 1)

  useEffect(() => {
    if (isFocused && !editing && cellRef.current) {
      cellRef.current.focus({ preventScroll: true })
    }
  }, [isFocused, editing])

  useEffect(() => {
    const toDisplay = cellData.content.trim()
    if (renderDiv.current && !editing) {
      const tree = parser.parse(toDisplay)
      const node = tree.topNode
      renderDiv.current.innerText = ''
      typesetNodeIntoElement(
        node,
        renderDiv.current,
        toDisplay.substring.bind(toDisplay)
      )
      loadMathJax()
        .then(async MathJax => {
          const element = renderDiv.current
          if (element) {
            await MathJax.typesetPromise([element])
            view.requestMeasure()
            MathJax.typesetClear([element])
          }
        })
        .catch(() => {})
    }
  }, [cellData.content, editing, view])

  const onInput = useCallback(
    (e: React.FormEvent<HTMLTextAreaElement>) => {
      update(filterInput((e.target as HTMLTextAreaElement).value))
    },
    [update, filterInput]
  )

  let body = <div ref={renderDiv} className="table-generator-cell-render" />
  if (editing) {
    body = (
      <CellInput
        className="table-generator-cell-input"
        value={editingCellData.content}
        onBlur={commitCellData}
        onInput={onInput}
        ref={inputRef}
      />
    )
  }

  const inSelection = selection?.contains(
    {
      row: rowIndex,
      cell: columnIndex,
    },
    table
  )

  const onDoubleClick = useCallback(() => {
    if (!view.state.readOnly) {
      startEditing(rowIndex, columnIndex, cellData.content)
    }
  }, [columnIndex, rowIndex, startEditing, cellData.content, view])

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <td
      onDoubleClick={onDoubleClick}
      tabIndex={row.cells.length * rowIndex + columnIndex + 1}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseMove={onMouseMove}
      colSpan={cellData.multiColumn?.columnSpan}
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
          inSelection && selection?.bordersLeft(rowIndex, columnIndex, table),
        'selection-edge-right':
          inSelection && selection?.bordersRight(rowIndex, columnIndex, table),
        editing,
      })}
    >
      {body}
    </td>
  )
}
