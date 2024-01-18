import { EditorState } from '@codemirror/state'
import { SyntaxNode } from '@lezer/common'
import { CellData, ColumnDefinition, TableData } from './tabular'
import { TableEnvironmentData } from './contexts/table-context'
import {
  ABSOLUTE_SIZE_REGEX,
  AbsoluteWidthUnits,
  RELATIVE_SIZE_REGEX,
  RelativeWidthCommand,
  WidthSelection,
} from './toolbar/column-width-modal/column-width'

const COMMIT_CHARACTERS = ['c', 'l', 'r', 'p', 'm', 'b', '>']

export type CellPosition = { from: number; to: number }
export type RowPosition = {
  from: number
  to: number
  hlines: { from: number; to: number }[]
}

function parseArgument(spec: string, startIndex: number): number {
  if (spec.charAt(startIndex) !== '{') {
    throw new Error('Missing opening brace')
  }
  let depth = 0
  for (let i = startIndex; i < spec.length; i++) {
    if (spec.charAt(i) === '{') {
      depth++
    } else if (spec.charAt(i) === '}') {
      depth--
    }
    if (depth === 0) {
      return i
    }
  }
  throw new Error('Missing closing brace')
}

export function parseColumnSpecifications(
  specification: string
): ColumnDefinition[] {
  const columns: ColumnDefinition[] = []
  let currentAlignment: ColumnDefinition['alignment'] | undefined
  let currentBorderLeft = 0
  let currentBorderRight = 0
  let currentContent = ''
  let currentCellSpacingLeft = ''
  let currentCellSpacingRight = ''
  let currentCustomCellDefinition = ''
  let currentIsParagraphColumn = false
  let currentSize: WidthSelection | undefined
  function maybeCommit() {
    if (currentAlignment !== undefined) {
      columns.push({
        alignment: currentAlignment,
        borderLeft: currentBorderLeft,
        borderRight: currentBorderRight,
        content: currentContent,
        cellSpacingLeft: currentCellSpacingLeft,
        cellSpacingRight: currentCellSpacingRight,
        customCellDefinition: currentCustomCellDefinition,
        isParagraphColumn: currentIsParagraphColumn,
        size: currentSize,
      })
      currentAlignment = undefined
      currentBorderLeft = 0
      currentBorderRight = 0
      currentContent = ''
      currentCellSpacingLeft = ''
      currentCellSpacingRight = ''
      currentCustomCellDefinition = ''
      currentIsParagraphColumn = false
      currentSize = undefined
    }
  }
  for (let i = 0; i < specification.length; i++) {
    if (COMMIT_CHARACTERS.includes(specification.charAt(i))) {
      maybeCommit()
    }
    const hasAlignment = currentAlignment !== undefined
    const char = specification.charAt(i)
    switch (char) {
      case '|': {
        if (hasAlignment) {
          currentBorderRight++
        } else {
          currentBorderLeft++
        }
        break
      }
      case 'c':
        currentAlignment = 'center'
        currentContent += 'c'
        break
      case 'l':
        currentAlignment = 'left'
        currentContent += 'l'
        break
      case 'r':
        currentAlignment = 'right'
        currentContent += 'r'
        break
      case 'p':
      case 'm':
      case 'b': {
        currentIsParagraphColumn = true
        currentAlignment = 'paragraph'
        if (currentCustomCellDefinition !== '') {
          // Maybe we have another alignment hidden in here
          const match = currentCustomCellDefinition.match(
            />\{\s*\\(raggedleft|raggedright|centering)\s*\\arraybackslash\s*\}/
          )
          if (match) {
            switch (match[1]) {
              case 'raggedleft':
                currentAlignment = 'right'
                break
              case 'raggedright':
                currentAlignment = 'left'
                break
              case 'centering':
                currentAlignment = 'center'
                break
            }
          }
        }
        currentContent += char
        const argumentEnd = parseArgument(specification, i + 1)
        const columnDefinition = specification.slice(i, argumentEnd + 1)
        const absoluteSizeMatch = columnDefinition.match(ABSOLUTE_SIZE_REGEX)
        const relativeSizeMatch = columnDefinition.match(RELATIVE_SIZE_REGEX)
        if (absoluteSizeMatch) {
          currentSize = {
            unit: absoluteSizeMatch[2] as AbsoluteWidthUnits,
            width: parseFloat(absoluteSizeMatch[1]),
          }
        } else if (relativeSizeMatch) {
          const widthAsFraction = parseFloat(relativeSizeMatch[1]) || 0
          currentSize = {
            unit: '%',
            width: widthAsFraction * 100,
            command: relativeSizeMatch[2] as RelativeWidthCommand,
          }
        } else {
          currentSize = {
            unit: 'custom',
            width: columnDefinition.slice(2, -1),
          }
        }
        // Don't include the p twice
        currentContent += columnDefinition.slice(1)
        i = argumentEnd
        break
      }
      case '@':
      case '!': {
        const argumentEnd = parseArgument(specification, i + 1)
        // Include the @/!
        const argument = specification.slice(i, argumentEnd + 1)
        i = argumentEnd
        if (currentAlignment) {
          // We have a cell, so this is right cell spacing
          currentCellSpacingRight = argument
        } else {
          currentCellSpacingLeft = argument
        }
        break
      }
      case '>': {
        const argumentEnd = parseArgument(specification, i + 1)
        // Include the >
        const argument = specification.slice(i, argumentEnd + 1)
        i = argumentEnd
        currentCustomCellDefinition = argument
        break
      }
      case ' ':
      case '\n':
      case '\t':
        currentContent += char
        break
    }
  }
  maybeCommit()
  return columns
}

const isRowSeparator = (node: SyntaxNode) =>
  node.type.is('Command') &&
  Boolean(node.getChild('KnownCtrlSym')?.getChild('LineBreak'))

const isHLine = (node: SyntaxNode) =>
  node.type.is('Command') &&
  Boolean(node.getChild('KnownCommand')?.getChild('HorizontalLine'))

const isMultiColumn = (node: SyntaxNode) =>
  node.type.is('Command') &&
  Boolean(node.getChild('KnownCommand')?.getChild('MultiColumn'))

type Position = {
  from: number
  to: number
}

type HLineData = {
  position: Position
  atBottom: boolean
}

type ParsedCell = {
  content: string
  position: Position
  multiColumn?: {
    columnSpecification: {
      position: Position
      specification: ColumnDefinition[]
    }
    span: number
    position: Position
    preamble: Position
    postamble: Position
  }
}

export type CellSeparator = Position
export type RowSeparator = Position

type ParsedRow = {
  position: Position
  cells: ParsedCell[]
  cellSeparators: CellSeparator[]
  hlines: HLineData[]
}

type ParsedTableBody = {
  rows: ParsedRow[]
  rowSeparators: RowSeparator[]
}

function parseTabularBody(
  node: SyntaxNode,
  state: EditorState
): ParsedTableBody {
  const firstChild = node.firstChild
  const body: ParsedTableBody = {
    rows: [
      {
        cells: [],
        hlines: [],
        cellSeparators: [],
        position: { from: node.from, to: node.from },
      },
    ],
    rowSeparators: [],
  }
  getLastRow().cells.push({
    content: '',
    position: { from: node.from, to: node.from },
  })
  function getLastRow() {
    return body.rows[body.rows.length - 1]
  }
  function getLastCell(): ParsedCell | undefined {
    return getLastRow().cells[getLastRow().cells.length - 1]
  }
  for (
    let currentChild: SyntaxNode | null = firstChild;
    currentChild;
    currentChild = currentChild.nextSibling
  ) {
    if (isRowSeparator(currentChild)) {
      const lastRow = getLastRow()
      body.rows.push({
        cells: [],
        hlines: [],
        cellSeparators: [],
        position: { from: currentChild.to, to: currentChild.to },
      })
      lastRow.position.to = currentChild.to
      body.rowSeparators.push({ from: currentChild.from, to: currentChild.to })
      getLastRow().cells.push({
        content: '',
        position: { from: currentChild.to, to: currentChild.to },
      })
      continue
    } else if (currentChild.type.is('Ampersand')) {
      // Add another cell
      getLastRow().cells.push({
        content: '',
        position: { from: currentChild.to, to: currentChild.to },
      })
      getLastRow().cellSeparators.push({
        from: currentChild.from,
        to: currentChild.to,
      })
    } else if (isMultiColumn(currentChild)) {
      // do stuff
      const multiColumn = currentChild
        .getChild('KnownCommand')!
        .getChild('MultiColumn')!
      const columnArgument = multiColumn
        .getChild('ColumnArgument')
        ?.getChild('ShortTextArgument')
        ?.getChild('ShortArg')
      const spanArgument = multiColumn
        .getChild('SpanArgument')
        ?.getChild('ShortTextArgument')
        ?.getChild('ShortArg')
      const tabularArgument = multiColumn
        .getChild('TabularArgument')
        ?.getChild('TabularContent')
      if (!columnArgument) {
        throw new Error(
          'Invalid multicolumn definition: missing column specification argument'
        )
      }
      if (!spanArgument) {
        throw new Error(
          'Invalid multicolumn definition: missing colspan argument'
        )
      }
      if (!tabularArgument) {
        throw new Error('Invalid multicolumn definition: missing cell content')
      }
      if (getLastCell()?.content.trim()) {
        throw new Error(
          'Invalid multicolumn definition: multicolumn must be at the start of a cell'
        )
      }
      const columnSpecification = parseColumnSpecifications(
        state.sliceDoc(columnArgument.from, columnArgument.to)
      )
      const span = parseInt(state.sliceDoc(spanArgument.from, spanArgument.to))
      const cellContent = state.sliceDoc(
        tabularArgument.from,
        tabularArgument.to
      )
      if (!getLastCell()) {
        getLastRow().cells.push({
          content: '',
          position: { from: currentChild.from, to: currentChild.from },
        })
      }
      const lastCell = getLastCell()!
      lastCell.multiColumn = {
        columnSpecification: {
          position: { from: columnArgument.from, to: columnArgument.to },
          specification: columnSpecification,
        },
        span,
        preamble: {
          from: currentChild.from,
          to: tabularArgument.from,
        },
        postamble: {
          from: tabularArgument.to,
          to: currentChild.to,
        },
        position: { from: currentChild.from, to: currentChild.to },
      }
      lastCell.content = cellContent
      lastCell.position.from = tabularArgument.from
      lastCell.position.to = tabularArgument.to
      // Don't update position at the end of the loop
      continue
    } else if (
      currentChild.type.is('NewLine') ||
      currentChild.type.is('Whitespace') ||
      currentChild.type.is('Comment') ||
      currentChild.type.is('BlankLine')
    ) {
      const lastCell = getLastCell()
      if (!lastCell?.multiColumn) {
        if (lastCell) {
          if (lastCell.content.trim() === '') {
            lastCell.position.from = currentChild.to
            lastCell.position.to = currentChild.to
          } else {
            lastCell.content += state.sliceDoc(
              currentChild.from,
              currentChild.to
            )
            lastCell.position.to = currentChild.to
          }
        }
      }
      // Try to preserve whitespace by skipping past it when locating cells
    } else if (isHLine(currentChild)) {
      const lastCell = getLastCell()
      if (lastCell?.content.trim()) {
        throw new Error('\\hline must be at the start of a row')
      }
      // push start of cell past the hline
      if (lastCell) {
        lastCell.position.from = currentChild.to
        lastCell.position.to = currentChild.to
      }
      const lastRow = getLastRow()
      lastRow.hlines.push({
        position: { from: currentChild.from, to: currentChild.to },
        // They will always be at the top, we patch the bottom border later.
        atBottom: false,
      })
    } else {
      // Add to the last cell
      if (!getLastCell()) {
        getLastRow().cells.push({
          content: '',
          position: { from: currentChild.from, to: currentChild.from },
        })
      }
      const lastCell = getLastCell()!
      lastCell.content += state.sliceDoc(currentChild.from, currentChild.to)
      lastCell.position.to = currentChild.to
    }
    getLastRow().position.to = currentChild.to
  }
  const lastRow = getLastRow()
  if (
    body.rows.length > 1 &&
    lastRow.cells.length === 1 &&
    lastRow.cells[0].content.trim() === ''
  ) {
    // Remove the last row if it's empty, but move hlines up to previous row
    const hlines = lastRow.hlines.map(hline => ({ ...hline, atBottom: true }))
    body.rows.pop()
    getLastRow().hlines.push(...hlines)
    const lastLineContents = state.sliceDoc(
      lastRow.position.from,
      lastRow.position.to
    )
    const lastLineOffset =
      lastLineContents.length - lastLineContents.trimEnd().length
    getLastRow().position.to = lastRow.position.to - lastLineOffset
  }
  return body
}

export type ParsedTableData = {
  table: TableData
  cellPositions: CellPosition[][]
  specification: { from: number; to: number }
  rowPositions: RowPosition[]
  rowSeparators: RowSeparator[]
  cellSeparators: CellSeparator[][]
}

export function generateTable(
  node: SyntaxNode,
  state: EditorState
): ParsedTableData {
  const specification = node
    .getChild('BeginEnv')
    ?.getChild('TextArgument')
    ?.getChild('LongArg')

  if (!specification) {
    throw new Error('Missing column specification')
  }
  const columns = parseColumnSpecifications(
    state.sliceDoc(specification.from, specification.to)
  )
  const body = node.getChild('Content')?.getChild('TabularContent')
  if (!body) {
    throw new Error('Missing table body')
  }
  const tableData = parseTabularBody(body, state)
  const cellPositions = tableData.rows.map(row =>
    row.cells.map(cell => cell.multiColumn?.position ?? cell.position)
  )
  const cellSeparators = tableData.rows.map(row => row.cellSeparators)
  const rowPositions = tableData.rows.map(row => ({
    ...row.position,
    hlines: row.hlines.map(hline => hline.position),
  }))
  const rows = tableData.rows.map(row => ({
    cells: row.cells.map(cell => {
      const cellData: CellData = {
        content: cell.content,
        from: cell.position.from,
        to: cell.position.to,
      }
      if (cell.multiColumn) {
        cellData.multiColumn = {
          columns: {
            specification: cell.multiColumn.columnSpecification.specification,
            from: cell.multiColumn.columnSpecification.position.from,
            to: cell.multiColumn.columnSpecification.position.to,
          },
          columnSpan: cell.multiColumn.span,
          from: cell.multiColumn.position.from,
          to: cell.multiColumn.position.to,
          preamble: {
            from: cell.multiColumn.preamble.from,
            to: cell.multiColumn.preamble.to,
          },
          postamble: {
            from: cell.multiColumn.postamble.from,
            to: cell.multiColumn.postamble.to,
          },
        }
      }
      return cellData
    }),
    borderTop: row.hlines.filter(hline => !hline.atBottom).length,
    borderBottom: row.hlines.filter(hline => hline.atBottom).length,
  }))
  const table = new TableData(rows, columns)
  return {
    table,
    cellPositions,
    specification,
    rowPositions,
    rowSeparators: tableData.rowSeparators,
    cellSeparators,
  }
}

export const validateParsedTable = (parseResult: ParsedTableData) => {
  for (const row of parseResult.table.rows) {
    const rowLength = row.cells.reduce(
      (acc, cell) => acc + (cell.multiColumn?.columnSpan ?? 1),
      0
    )
    for (const cell of row.cells) {
      if (
        cell.multiColumn?.columns.specification &&
        cell.multiColumn.columns.specification.length !== 1
      ) {
        return false
      }
    }
    if (rowLength !== parseResult.table.columns.length) {
      return false
    }
  }
  return true
}

export function parseTableEnvironment(tableNode: SyntaxNode) {
  const tableEnvironment: TableEnvironmentData = {
    table: { from: tableNode.from, to: tableNode.to },
  }
  tableNode.cursor().iterate(({ type, from, to }) => {
    if (tableEnvironment.caption && tableEnvironment.label) {
      // Stop looking once we've found both caption and label
      return false
    }
    if (type.is('Caption')) {
      tableEnvironment.caption = { from, to }
    } else if (type.is('Label')) {
      tableEnvironment.label = { from, to }
    }
  })
  return tableEnvironment
}
