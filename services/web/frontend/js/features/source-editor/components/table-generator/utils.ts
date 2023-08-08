import { EditorState } from '@codemirror/state'
import { SyntaxNode } from '@lezer/common'
import { ColumnDefinition, TableData } from './tabular'

const ALIGNMENT_CHARACTERS = ['c', 'l', 'r', 'p']

export type CellPosition = { from: number; to: number }
export type RowPosition = {
  from: number
  to: number
  hlines: { from: number; to: number }[]
}

function parseColumnSpecifications(specification: string): ColumnDefinition[] {
  const columns: ColumnDefinition[] = []
  let currentAlignment: ColumnDefinition['alignment'] | undefined
  let currentBorderLeft = 0
  let currentBorderRight = 0
  function maybeCommit() {
    if (currentAlignment !== undefined) {
      columns.push({
        alignment: currentAlignment,
        borderLeft: currentBorderLeft,
        borderRight: currentBorderRight,
      })
      currentAlignment = undefined
      currentBorderLeft = 0
      currentBorderRight = 0
    }
  }
  for (let i = 0; i < specification.length; i++) {
    if (ALIGNMENT_CHARACTERS.includes(specification.charAt(i))) {
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
        break
      case 'l':
        currentAlignment = 'left'
        break
      case 'r':
        currentAlignment = 'right'
        break
      case 'p': {
        currentAlignment = 'paragraph'
        // TODO: Parse these details
        while (i < specification.length && specification.charAt(i) !== '}') {
          i++
        }
        break
      }
    }
  }
  maybeCommit()
  return columns
}

const isRowSeparator = (node: SyntaxNode, state: EditorState) =>
  node.type.is('Command') && state.sliceDoc(node.from, node.to) === '\\\\'

const isHLine = (node: SyntaxNode) =>
  node.type.is('Command') &&
  Boolean(node.getChild('KnownCommand')?.getChild('HLine'))

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
}

type CellSeparator = Position
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
    let currentChild: SyntaxNode | null = node;
    currentChild;
    currentChild = currentChild.nextSibling
  ) {
    if (isRowSeparator(currentChild, state)) {
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
    } else if (
      currentChild.type.is('NewLine') ||
      currentChild.type.is('Whitespace')
    ) {
      const lastCell = getLastCell()
      if (lastCell) {
        if (lastCell.content.trim() === '') {
          lastCell.position.from = currentChild.to
          lastCell.position.to = currentChild.to
        } else {
          lastCell.content += state.sliceDoc(currentChild.from, currentChild.to)
          lastCell.position.to = currentChild.to
        }
      }
      // Try to preserve whitespace by skipping past it when locating cells
    } else if (isHLine(currentChild)) {
      const lastCell = getLastCell()
      if (lastCell?.content) {
        throw new Error('\\hline must be at the start of a row')
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
  if (lastRow.cells.length === 1 && lastRow.cells[0].content.trim() === '') {
    // Remove the last row if it's empty, but move hlines up to previous row
    const hlines = lastRow.hlines.map(hline => ({ ...hline, atBottom: true }))
    body.rows.pop()
    getLastRow().hlines.push(...hlines)
  }
  return body
}

export function generateTable(
  node: SyntaxNode,
  state: EditorState
): {
  table: TableData
  cellPositions: CellPosition[][]
  specification: { from: number; to: number }
  rowPositions: RowPosition[]
  rowSeparators: RowSeparator[]
} {
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
  const body = node.getChild('Content')?.getChild('TabularContent')?.firstChild
  if (!body) {
    throw new Error('Missing table body')
  }
  const tableData = parseTabularBody(body, state)
  const cellPositions = tableData.rows.map(row =>
    row.cells.map(cell => cell.position)
  )
  const rowPositions = tableData.rows.map(row => ({
    ...row.position,
    hlines: row.hlines.map(hline => hline.position),
  }))
  const rows = tableData.rows.map(row => ({
    cells: row.cells.map(cell => ({
      content: cell.content,
    })),
    borderTop: row.hlines.filter(hline => !hline.atBottom).length,
    borderBottom: row.hlines.filter(hline => hline.atBottom).length,
  }))
  const table = {
    rows,
    columns,
  }
  return {
    table,
    cellPositions,
    specification,
    rowPositions,
    rowSeparators: tableData.rowSeparators,
  }
}
