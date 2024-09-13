import { EditorView } from '@codemirror/view'
import { ColumnDefinition, Positions, TableData } from '../tabular'
import { ChangeSpec, EditorSelection } from '@codemirror/state'
import {
  CellSeparator,
  RowSeparator,
  parseColumnSpecifications,
} from '../utils'
import { TableSelection } from '../contexts/selection-context'
import { ensureEmptyLine } from '../../../extensions/toolbar/commands'
import { TableEnvironmentData } from '../contexts/table-context'
import {
  extendBackwardsOverEmptyLines,
  extendForwardsOverEmptyLines,
} from '../../../extensions/visual/selection'
import { debugConsole } from '@/utils/debugging'
import { WidthSelection } from './column-width-modal/column-width'

/* eslint-disable no-unused-vars */
export enum BorderTheme {
  NO_BORDERS = 0,
  FULLY_BORDERED = 1,
  BOOKTABS = 2,
}
/* eslint-enable no-unused-vars */

type ThemeGenerator = {
  column: (
    number: number,
    numColumns: number
  ) => { left: boolean; right: boolean }
  row: (number: number, numRows: number) => string | false
  lastRow?: () => string | false
  multicolumn: () => { left: boolean; right: boolean }
}

const themeGenerators: Record<BorderTheme, ThemeGenerator> = {
  [BorderTheme.NO_BORDERS]: {
    column: () => ({ left: false, right: false }),
    row: () => false,
    multicolumn: () => ({ left: false, right: false }),
  },
  [BorderTheme.FULLY_BORDERED]: {
    column: (number: number, numColumns: number) => ({
      left: true,
      right: number === numColumns - 1,
    }),
    row: () => '\\hline',
    multicolumn: () => ({ left: true, right: true }),
    lastRow: () => '\\hline',
  },
  [BorderTheme.BOOKTABS]: {
    column: () => ({
      left: false,
      right: false,
    }),
    row: (number: number) => {
      if (number === 0) {
        return '\\toprule'
      }
      if (number === 1) {
        return '\\midrule'
      }
      return false
    },
    lastRow: () => '\\bottomrule',
    multicolumn: () => ({ left: false, right: false }),
  },
}

function applyBorderTheme(
  generator: ThemeGenerator,
  view: EditorView,
  table: TableData,
  positions: Positions,
  rowSeparators: RowSeparator[]
): ChangeSpec[] {
  const changes: ChangeSpec[] = []

  // Update specification
  const spec = view.state.sliceDoc(
    positions.columnDeclarations.from,
    positions.columnDeclarations.to
  )
  const columnSpecification = parseColumnSpecifications(spec)
  columnSpecification.forEach((column, index) => {
    const { left, right } = generator.column(index, columnSpecification.length)
    column.borderLeft = left ? 1 : 0
    column.borderRight = right ? 1 : 0
  })
  const newSpec = generateColumnSpecification(columnSpecification)
  if (newSpec !== spec) {
    changes.push({
      from: positions.columnDeclarations.from,
      to: positions.columnDeclarations.to,
      insert: newSpec,
    })
  }

  for (let i = 0; i < positions.rowPositions.length; i++) {
    const row = positions.rowPositions[i]
    const topBorder = generator.row(i, positions.rowPositions.length)
    if (topBorder) {
      let borderPresent = false
      for (const hline of row.hlines) {
        if (hline.from > rowSeparators[i]?.to) {
          continue
        }
        if (borderPresent) {
          // Remove extra border
          changes.push({
            from: hline.from,
            to: hline.to,
            insert: '',
          })
        } else {
          const type = view.state.sliceDoc(hline.from, hline.to)
          if (type.trim() !== topBorder) {
            // Replace with the correct border
            changes.push({
              from: hline.from,
              to: hline.to,
              insert: topBorder,
            })
          }
          borderPresent = true
        }
      }
      if (!borderPresent) {
        // Add the border
        changes.push({
          from: row.from,
          to: row.from,
          insert: topBorder,
        })
      }
    } else {
      for (const hline of row.hlines) {
        if (hline.from > rowSeparators[i]?.to) {
          continue
        }
        changes.push({
          from: hline.from,
          to: hline.to,
          insert: '',
        })
      }
    }
  }

  const lastRow = positions.rowPositions[positions.rowPositions.length - 1]
  const lastRowBorder = generator.lastRow?.()
  const hasLastRowSeparator =
    positions.rowPositions.length === rowSeparators.length
  if (hasLastRowSeparator) {
    if (lastRowBorder) {
      let borderPresent = false
      for (const hline of lastRow.hlines) {
        if (hline.from < rowSeparators[positions.rowPositions.length - 1].to) {
          continue
        }
        if (borderPresent) {
          // Remove extra border
          changes.push({
            from: hline.from,
            to: hline.to,
            insert: '',
          })
        } else {
          const type = view.state.sliceDoc(hline.from, hline.to)
          if (type.trim() !== lastRowBorder) {
            // Replace with the correct border
            changes.push({
              from: hline.from,
              to: hline.to,
              insert: lastRowBorder,
            })
          }
          borderPresent = true
        }
      }
      if (!borderPresent) {
        const rowSeparator = rowSeparators[positions.rowPositions.length - 1]

        // Add the border
        changes.push({
          from: rowSeparator.to,
          to: rowSeparator.to,
          insert: ` ${lastRowBorder}`,
        })
      }
    } else {
      for (const hline of lastRow.hlines) {
        if (hline.from < rowSeparators[positions.rowPositions.length - 1].to) {
          continue
        }
        changes.push({
          from: hline.from,
          to: hline.to,
          insert: '',
        })
      }
    }
  } else if (lastRowBorder) {
    changes.push({
      from: lastRow.to,
      to: lastRow.to,
      insert: `\\\\ ${lastRowBorder}`,
    })
  }

  // Update multicolumn
  for (const row of table.rows) {
    for (const cell of row.cells) {
      if (cell.multiColumn) {
        const { left, right } = generator.multicolumn()
        const spec = view.state.sliceDoc(
          cell.multiColumn.columns.from,
          cell.multiColumn.columns.to
        )
        const columnSpecification = parseColumnSpecifications(spec)
        columnSpecification.forEach(column => {
          column.borderLeft = left ? 1 : 0
          column.borderRight = right ? 1 : 0
        })
        const newSpec = generateColumnSpecification(columnSpecification)
        if (newSpec !== spec) {
          changes.push({
            from: cell.multiColumn.columns.from,
            to: cell.multiColumn.columns.to,
            insert: newSpec,
          })
        }
      }
    }
  }

  return changes
}

export const setBorders = (
  view: EditorView,
  theme: BorderTheme,
  positions: Positions,
  rowSeparators: RowSeparator[],
  table: TableData
) => {
  const generator = themeGenerators[theme]
  const changes = applyBorderTheme(
    generator,
    view,
    table,
    positions,
    rowSeparators
  )

  view.dispatch({
    changes,
  })
}

export const setAlignment = (
  view: EditorView,
  selection: TableSelection,
  alignment: ColumnDefinition['alignment'],
  positions: Positions,
  table: TableData
) => {
  if (selection.isMergedCellSelected(table)) {
    if (alignment === 'paragraph') {
      // shouldn't happen
      return
    }
    // change for mergedColumn
    const { minX, minY } = selection.normalized()
    const cell = table.getCell(minY, minX)
    if (!cell.multiColumn) {
      return
    }
    const specification = view.state.sliceDoc(
      cell.multiColumn.columns.from,
      cell.multiColumn.columns.to
    )
    const columnSpecification = parseColumnSpecifications(specification)
    for (const column of columnSpecification) {
      if (column.alignment !== alignment) {
        column.alignment = alignment
        column.content = alignment[0]
      }
    }
    const newSpec = generateColumnSpecification(columnSpecification)
    view.dispatch({
      changes: {
        from: cell.multiColumn.columns.from,
        to: cell.multiColumn.columns.to,
        insert: newSpec,
      },
    })
    return
  }
  const specification = view.state.sliceDoc(
    positions.columnDeclarations.from,
    positions.columnDeclarations.to
  )
  const columnSpecification = parseColumnSpecifications(specification)
  const { minX, maxX } = selection.normalized()
  for (let i = minX; i <= maxX; i++) {
    if (selection.isColumnSelected(i, table)) {
      if (columnSpecification[i].alignment === alignment) {
        continue
      }
      columnSpecification[i].alignment = alignment
      if (columnSpecification[i].isParagraphColumn) {
        columnSpecification[i].customCellDefinition =
          generateParagraphColumnSpecification(alignment)
      } else {
        if (alignment === 'paragraph') {
          // shouldn't happen
          continue
        }
        columnSpecification[i].content = alignment[0]
      }
    }
  }
  const newSpecification = generateColumnSpecification(columnSpecification)
  view.dispatch({
    changes: [
      {
        from: positions.columnDeclarations.from,
        to: positions.columnDeclarations.to,
        insert: newSpecification,
      },
    ],
  })
}

const generateColumnSpecification = (columns: ColumnDefinition[]) => {
  return columns
    .map(
      ({
        borderLeft,
        borderRight,
        content,
        cellSpacingLeft,
        cellSpacingRight,
        customCellDefinition,
      }) =>
        `${'|'.repeat(
          borderLeft
        )}${cellSpacingLeft}${customCellDefinition}${content}${cellSpacingRight}${'|'.repeat(
          borderRight
        )}`
    )
    .join('')
}

export const removeRowOrColumns = (
  view: EditorView,
  selection: TableSelection,
  positions: Positions,
  cellSeparators: CellSeparator[][],
  table: TableData
) => {
  const {
    minX: startCell,
    maxX: endCell,
    minY: startRow,
    maxY: endRow,
  } = selection.normalized()
  const borderTheme = table.getBorderTheme()
  const changes: { from: number; to: number; insert: string }[] = []
  const specification = view.state.sliceDoc(
    positions.columnDeclarations.from,
    positions.columnDeclarations.to
  )
  const columnSpecification = parseColumnSpecifications(specification)
  const numberOfColumns = columnSpecification.length
  const numberOfRows = positions.rowPositions.length

  if (selection.spansEntireTable(table)) {
    emptyTable(view, columnSpecification, positions)
    return new TableSelection({ cell: 0, row: 0 })
  }
  const removedRows =
    Number(selection.isRowSelected(startRow, table)) * selection.height()
  const removedColumns =
    Number(selection.isColumnSelected(startCell, table)) * selection.width()

  const removingFromBeginning = selection.isColumnSelected(0, table)

  for (let row = startRow; row <= endRow; row++) {
    if (selection.isRowSelected(row, table)) {
      const rowPosition = positions.rowPositions[row]
      let insert = ''
      if (
        row === numberOfRows - 1 &&
        borderTheme === BorderTheme.FULLY_BORDERED
      ) {
        insert = '\\hline'
      }
      changes.push({
        from: rowPosition.from,
        to: rowPosition.to,
        insert,
      })
    } else {
      for (let cell = startCell; cell <= endCell; ) {
        const cellIndex = table.getCellIndex(row, cell)
        const cellPosition = positions.cells[row][cellIndex]
        if (selection.isColumnSelected(cell, table)) {
          // We should remove this column.
          if (removingFromBeginning) {
            // Deletes content in { }
            // [ cell x - 1 ] & { [ cell x ] & } [ cell x + 1 ]
            const from = cellPosition.from
            const to = cellSeparators[row][cellIndex].to
            if (from === undefined || to === undefined) {
              debugConsole.error('Failed to remove column')
              return selection
            }
            changes.push({
              from,
              to,
              insert: '',
            })
          } else {
            // Deletes content in { }
            // [ cell x - 1 ] { &  [ cell x ] } & [ cell x + 1 ]
            const from = cellSeparators[row][cellIndex - 1].from
            const to = cellPosition.to
            if (from === undefined || to === undefined) {
              debugConsole.error('Failed to remove column')
              return selection
            }
            changes.push({
              from,
              to,
              insert: '',
            })
          }
        }
        cell += table.rows[row].cells[cellIndex].multiColumn?.columnSpan ?? 1
      }
    }
  }
  const filteredColumns = columnSpecification.filter(
    (_, i) => !selection.isColumnSelected(i, table)
  )
  if (
    table.getBorderTheme() === BorderTheme.FULLY_BORDERED &&
    columnSpecification[0]?.borderLeft > 0 &&
    filteredColumns.length
  ) {
    filteredColumns[0].borderLeft = Math.max(1, filteredColumns[0].borderLeft)
  }
  const newSpecification = generateColumnSpecification(filteredColumns)
  changes.push({
    from: positions.columnDeclarations.from,
    to: positions.columnDeclarations.to,
    insert: newSpecification,
  })
  view.dispatch({ changes })
  const updatedNumberOfRows = numberOfRows - removedRows
  const updatedNumberOfColumns = numberOfColumns - removedColumns
  // Clamp selection to new table size
  return new TableSelection({
    cell: Math.max(0, Math.min(updatedNumberOfColumns - 1, startCell)),
    row: Math.max(0, Math.min(updatedNumberOfRows - 1, startRow)),
  })
}

const emptyTable = (
  view: EditorView,
  columnSpecification: ColumnDefinition[],
  positions: Positions
) => {
  const newColumns = columnSpecification.slice(0, 1)
  newColumns[0].borderLeft = 0
  newColumns[0].borderRight = 0
  const newSpecification = generateColumnSpecification(newColumns)
  const changes: ChangeSpec[] = []
  changes.push({
    from: positions.columnDeclarations.from,
    to: positions.columnDeclarations.to,
    insert: newSpecification,
  })
  const from = positions.rowPositions[0].from
  const to = positions.rowPositions[positions.rowPositions.length - 1].to
  changes.push({
    from,
    to,
    insert: '\\\\',
  })
  view.dispatch({ changes })
}

export const insertRow = (
  view: EditorView,
  selection: TableSelection,
  positions: Positions,
  below: boolean,
  rowSeparators: RowSeparator[],
  table: TableData
) => {
  const { maxY, minY } = selection.normalized()
  const rowsToInsert = selection.height()
  const from = below
    ? positions.rowPositions[maxY].to
    : positions.rowPositions[minY].from
  const numberOfColumns = table.columns.length
  const borderTheme = table.getBorderTheme()
  const border = borderTheme === BorderTheme.FULLY_BORDERED ? '\\hline' : ''
  const initialRowSeparator =
    below && rowSeparators.length === table.rows.length - 1 ? '\\\\' : ''
  const initialHline =
    borderTheme === BorderTheme.FULLY_BORDERED && !below && minY === 0
      ? '\\hline'
      : ''
  const insert = `${initialRowSeparator}${initialHline}\n${' &'.repeat(
    numberOfColumns - 1
  )}\\\\${border}`.repeat(rowsToInsert)
  view.dispatch({ changes: { from, to: from, insert } })
  if (!below) {
    return selection
  }
  return new TableSelection(
    { cell: 0, row: maxY + 1 },
    { cell: numberOfColumns - 1, row: maxY + 1 }
  )
}

export const insertColumn = (
  view: EditorView,
  initialSelection: TableSelection,
  positions: Positions,
  after: boolean,
  table: TableData
) => {
  const selection = initialSelection.explode(table)
  const { maxX, minX } = selection.normalized()
  const columnsToInsert = selection.maximumCellWidth(table)
  const changes: ChangeSpec[] = []
  const targetColumn = after ? maxX : minX
  for (let row = 0; row < positions.rowPositions.length; row++) {
    const cell = table.getCell(row, targetColumn)
    const target = cell.multiColumn ?? cell
    const from = after ? target.to : target.from
    changes.push({
      from,
      insert: ' &'.repeat(columnsToInsert),
    })
  }

  const specification = view.state.sliceDoc(
    positions.columnDeclarations.from,
    positions.columnDeclarations.to
  )
  const columnSpecification = parseColumnSpecifications(specification)
  const borderTheme = table.getBorderTheme()
  const borderRight = borderTheme === BorderTheme.FULLY_BORDERED ? 1 : 0
  const targetIndex = after ? maxX + 1 : minX
  columnSpecification.splice(
    targetIndex,
    0,
    ...Array.from({ length: columnsToInsert }, () => ({
      alignment: 'left' as const,
      borderLeft: 0,
      borderRight,
      content: 'l',
      cellSpacingLeft: '',
      cellSpacingRight: '',
      customCellDefinition: '',
      isParagraphColumn: false,
    }))
  )
  if (targetIndex === 0 && borderTheme === BorderTheme.FULLY_BORDERED) {
    columnSpecification[0].borderLeft = Math.max(
      1,
      columnSpecification[0].borderLeft
    )
  }
  changes.push({
    from: positions.columnDeclarations.from,
    to: positions.columnDeclarations.to,
    insert: generateColumnSpecification(columnSpecification),
  })
  view.dispatch({ changes })
  if (!after) {
    return selection
  }
  return new TableSelection(
    { cell: maxX + 1, row: 0 },
    { cell: maxX + 1, row: positions.rowPositions.length - 1 }
  )
}

export const removeNodes = (
  view: EditorView,
  ...nodes: ({ from: number; to: number } | undefined)[]
) => {
  const changes: ChangeSpec[] = []
  for (const node of nodes) {
    if (node !== undefined) {
      changes.push({ from: node.from, to: node.to, insert: '' })
    }
  }
  view.dispatch({
    changes,
  })
}

const contains = (
  { from: outerFrom, to: outerTo }: { from: number; to: number },
  { from: innerFrom, to: innerTo }: { from: number; to: number }
) => {
  return outerFrom <= innerFrom && outerTo >= innerTo
}

export const moveCaption = (
  view: EditorView,
  positions: Positions,
  target: 'above' | 'below',
  tableEnvironment?: TableEnvironmentData
) => {
  const changes: ChangeSpec[] = []
  const position =
    target === 'above' ? positions.tabular.from : positions.tabular.to
  const cursor = EditorSelection.cursor(position)

  if (tableEnvironment?.caption) {
    const { caption: existingCaption } = tableEnvironment
    if (
      (existingCaption.from < positions.tabular.from && target === 'above') ||
      (existingCaption.from > positions.tabular.to && target === 'below')
    ) {
      // It's already in the right place
      return
    }
  }

  const { pos, prefix, suffix } = ensureEmptyLine(view.state, cursor, target)

  if (!tableEnvironment?.caption) {
    let labelText = '\\label{tab:my_table}'
    if (tableEnvironment?.label) {
      // We have a label, but no caption. Move the label after our caption
      changes.push({
        from: tableEnvironment.label.from,
        to: tableEnvironment.label.to,
        insert: '',
      })
      labelText = view.state.sliceDoc(
        tableEnvironment.label.from,
        tableEnvironment.label.to
      )
    }
    changes.push({
      ...gobbleEmptyLines(view, pos, 2, target),
      insert: `${prefix}\\caption{Caption}\n${labelText}${suffix}`,
    })
  } else {
    const { caption: existingCaption, label: existingLabel } = tableEnvironment
    // We have a caption, and we need to move it
    let currentCaption = view.state.sliceDoc(
      existingCaption.from,
      existingCaption.to
    )
    if (existingLabel && !contains(existingCaption, existingLabel)) {
      // Move label with it
      const labelText = view.state.sliceDoc(
        existingLabel.from,
        existingLabel.to
      )
      currentCaption += `\n${labelText}`
      changes.push({
        from: existingLabel.from,
        to: existingLabel.to,
        insert: '',
      })
    }
    changes.push({
      ...gobbleEmptyLines(view, pos, 2, target),
      insert: `${prefix}${currentCaption}${suffix}`,
    })
    // remove exsisting caption
    changes.push({
      from: existingCaption.from,
      to: existingCaption.to,
      insert: '',
    })
  }
  view.dispatch({ changes })
}

export const removeCaption = (
  view: EditorView,
  tableEnvironment?: TableEnvironmentData
) => {
  if (tableEnvironment?.caption && tableEnvironment.label) {
    if (contains(tableEnvironment.caption, tableEnvironment.label)) {
      return removeNodes(view, tableEnvironment.caption)
    }
  }
  return removeNodes(view, tableEnvironment?.caption, tableEnvironment?.label)
}

const gobbleEmptyLines = (
  view: EditorView,
  pos: number,
  lines: number,
  target: 'above' | 'below'
) => {
  const line = view.state.doc.lineAt(pos)
  if (line.length !== 0) {
    return { from: pos, to: pos }
  }
  if (target === 'above') {
    return {
      from: extendBackwardsOverEmptyLines(view.state.doc, line, lines),
      to: pos,
    }
  }
  return {
    from: pos,
    to: extendForwardsOverEmptyLines(view.state.doc, line, lines),
  }
}

export const unmergeCells = (
  view: EditorView,
  selection: TableSelection,
  table: TableData
) => {
  const cell = table.getCell(selection.from.row, selection.from.cell)
  if (!cell.multiColumn) {
    return
  }
  view.dispatch({
    changes: [
      {
        from: cell.multiColumn.preamble.from,
        to: cell.multiColumn.preamble.to,
        insert: '',
      },
      {
        from: cell.multiColumn.postamble.from,
        to: cell.multiColumn.postamble.to,
        insert: '&'.repeat(cell.multiColumn.columnSpan - 1),
      },
    ],
  })
}

export const mergeCells = (
  view: EditorView,
  selection: TableSelection,
  table: TableData
) => {
  const { minX, maxX, minY, maxY } = selection.normalized()
  if (minY !== maxY) {
    return
  }
  if (minX === maxX) {
    return
  }
  const cellContent = []
  for (let i = minX; i <= maxX; i++) {
    cellContent.push(table.getCell(minY, i).content.trim())
  }
  const content = cellContent.join(' ').trim()
  const border =
    table.getBorderTheme() === BorderTheme.FULLY_BORDERED ? '|' : ''
  const preamble = `\\multicolumn{${maxX - minX + 1}}{${border}c${border}}{`
  const postamble = '}'
  const { from } = table.getCell(minY, minX)
  const { to } = table.getCell(minY, maxX)
  view.dispatch({
    changes: {
      from,
      to,
      insert: `${preamble}${content}${postamble}`,
    },
  })
}

const getSuffixForUnit = (
  unit: WidthSelection['unit'],
  currentSize?: WidthSelection
) => {
  if (unit === 'custom') {
    return ''
  }
  if (unit === '%') {
    if (currentSize?.unit === '%' && currentSize.command) {
      return `\\${currentSize.command}`
    } else {
      return '\\linewidth'
    }
  }
  return unit
}

const COMMAND_FOR_PARAGRAPH_ALIGNMENT: Record<
  ColumnDefinition['alignment'],
  string
> = {
  left: '\\raggedright',
  right: '\\raggedleft',
  center: '\\centering',
  paragraph: '',
}

const transformColumnWidth = (width: WidthSelection) => {
  if (width.unit === '%') {
    return width.width / 100
  } else {
    return width.width
  }
}

const generateParagraphColumnSpecification = (
  alignment: ColumnDefinition['alignment']
) => {
  if (alignment === 'paragraph') {
    return ''
  }
  return `>{${COMMAND_FOR_PARAGRAPH_ALIGNMENT[alignment]}\\arraybackslash}`
}

function getParagraphAlignmentCharacter(
  column: ColumnDefinition
): 'p' | 'm' | 'b' {
  if (!column.isParagraphColumn) {
    return 'p'
  }
  const currentAlignmentCharacter = column.content[0]
  if (currentAlignmentCharacter === 'm' || currentAlignmentCharacter === 'b') {
    return currentAlignmentCharacter
  }
  return 'p'
}

export const setColumnWidth = (
  view: EditorView,
  selection: TableSelection,
  newWidth: WidthSelection,
  positions: Positions,
  table: TableData
) => {
  const { minX, maxX } = selection.normalized()
  const specification = view.state.sliceDoc(
    positions.columnDeclarations.from,
    positions.columnDeclarations.to
  )
  const columnSpecification = parseColumnSpecifications(specification)
  for (let i = minX; i <= maxX; i++) {
    if (selection.isColumnSelected(i, table)) {
      const suffix = getSuffixForUnit(newWidth.unit, table.columns[i].size)
      const widthValue = transformColumnWidth(newWidth)
      columnSpecification[i].customCellDefinition =
        generateParagraphColumnSpecification(columnSpecification[i].alignment)
      // Reuse paragraph alignment characters to preserve m and b columns
      const alignmentCharacter = getParagraphAlignmentCharacter(
        columnSpecification[i]
      )
      columnSpecification[i].content =
        `${alignmentCharacter}{${widthValue}${suffix}}`
    }
  }
  const newSpecification = generateColumnSpecification(columnSpecification)
  view.dispatch({
    changes: [
      {
        from: positions.columnDeclarations.from,
        to: positions.columnDeclarations.to,
        insert: newSpecification,
      },
    ],
  })
}

export const removeColumnWidths = (
  view: EditorView,
  selection: TableSelection,
  positions: Positions,
  table: TableData
) => {
  const { minX, maxX } = selection.normalized()
  const specification = view.state.sliceDoc(
    positions.columnDeclarations.from,
    positions.columnDeclarations.to
  )
  const columnSpecification = parseColumnSpecifications(specification)
  for (let i = minX; i <= maxX; i++) {
    if (selection.isColumnSelected(i, table)) {
      columnSpecification[i].customCellDefinition = ''
      if (columnSpecification[i].alignment === 'paragraph') {
        columnSpecification[i].content = 'l'
        columnSpecification[i].alignment = 'left'
      } else {
        columnSpecification[i].content = columnSpecification[i].alignment[0]
      }
    }
  }
  const newSpecification = generateColumnSpecification(columnSpecification)
  view.dispatch({
    changes: [
      {
        from: positions.columnDeclarations.from,
        to: positions.columnDeclarations.to,
        insert: newSpecification,
      },
    ],
  })
}
