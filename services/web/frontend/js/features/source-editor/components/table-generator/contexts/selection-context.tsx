import {
  Dispatch,
  FC,
  SetStateAction,
  createContext,
  useContext,
  useState,
} from 'react'
import { TableData } from '../tabular'

type TableCoordinate = {
  readonly row: number
  readonly cell: number
}

export class TableSelection {
  public readonly from: TableCoordinate
  public readonly to: TableCoordinate

  constructor(from: TableCoordinate, to?: TableCoordinate) {
    this.from = from
    this.to = to ?? from
  }

  contains(anchor: TableCoordinate, table: TableData) {
    const { minX, maxX, minY, maxY } = this.normalized()
    const { from, to } = table.getCellBoundaries(anchor.row, anchor.cell)
    return (
      from >= minX && to <= maxX && anchor.row >= minY && anchor.row <= maxY
    )
  }

  selectRow(row: number, extend: boolean, table: TableData) {
    return new TableSelection(
      { row: extend ? this.from.row : row, cell: 0 },
      { row, cell: table.columns.length - 1 }
    )
  }

  selectColumn(column: number, extend: boolean, table: TableData) {
    return new TableSelection(
      { row: 0, cell: extend ? this.from.cell : column },
      { row: table.rows.length - 1, cell: column }
    )
  }

  normalized() {
    const minX = Math.min(this.from.cell, this.to.cell)
    const maxX = Math.max(this.from.cell, this.to.cell)
    const minY = Math.min(this.from.row, this.to.row)
    const maxY = Math.max(this.from.row, this.to.row)

    return { minX, maxX, minY, maxY }
  }

  bordersLeft(row: number, cell: number, table: TableData) {
    const { minX } = this.normalized()
    return minX === table.getCellBoundaries(row, cell).from
  }

  bordersRight(row: number, cell: number, table: TableData) {
    const { maxX } = this.normalized()
    return maxX === table.getCellBoundaries(row, cell).to
  }

  bordersTop(y: number) {
    const { minY } = this.normalized()
    return minY === y
  }

  bordersBottom(y: number) {
    const { maxY } = this.normalized()
    return maxY === y
  }

  toString() {
    return `TableSelection(${this.from.row}, ${this.from.cell}) -> (${this.to.row}, ${this.to.cell})`
  }

  isRowSelected(row: number, table: TableData) {
    const { minX, maxX, minY, maxY } = this.normalized()
    return (
      row >= minY &&
      row <= maxY &&
      minX === 0 &&
      maxX === table.columns.length - 1
    )
  }

  isAnyRowSelected(table: TableData) {
    for (let i = 0; i < table.rows.length; ++i) {
      if (this.isRowSelected(i, table)) {
        return true
      }
    }
    return false
  }

  isAnyColumnSelected(table: TableData) {
    for (let i = 0; i < table.columns.length; ++i) {
      if (this.isColumnSelected(i, table)) {
        return true
      }
    }
    return false
  }

  isColumnSelected(cell: number, table: TableData) {
    const totalRows = table.rows.length
    const { minX, maxX, minY, maxY } = this.normalized()
    return cell >= minX && cell <= maxX && minY === 0 && maxY === totalRows - 1
  }

  public eq(other: TableSelection) {
    return (
      this.from.row === other.from.row &&
      this.from.cell === other.from.cell &&
      this.to.row === other.to.row &&
      this.to.cell === other.to.cell
    )
  }

  public explode(table: TableData) {
    const expandOnce = (current: TableSelection) => {
      if (
        current.to.row >= table.rows.length ||
        current.to.cell >= table.columns.length
      ) {
        throw new Error("Can't expand selection outside of table")
      }
      const { minX, maxX, minY, maxY } = current.normalized()
      for (let row = minY; row <= maxY; ++row) {
        const cellBoundariesMinX = table.getCellBoundaries(row, minX)
        const cellBoundariesMaxX = table.getCellBoundaries(row, maxX)
        if (cellBoundariesMinX.from < minX) {
          if (current.from.cell === minX) {
            return new TableSelection(
              { row: current.from.row, cell: cellBoundariesMinX.from },
              { row: current.to.row, cell: current.to.cell }
            )
          } else {
            return new TableSelection(
              { row: current.from.row, cell: current.from.cell },
              { row: current.to.row, cell: cellBoundariesMinX.from }
            )
          }
        } else if (cellBoundariesMaxX.to > maxX) {
          if (current.to.cell === maxX) {
            return new TableSelection(
              { row: current.from.row, cell: current.from.cell },
              { row: current.to.row, cell: cellBoundariesMaxX.to }
            )
          } else {
            return new TableSelection(
              { row: current.from.row, cell: cellBoundariesMaxX.to },
              { row: current.to.row, cell: current.to.cell }
            )
          }
        }
      }
      return current
    }
    let last: TableSelection = this
    for (
      let current = expandOnce(last);
      !current.eq(last);
      current = expandOnce(last)
    ) {
      last = current
    }
    return last
  }

  moveRight(table: TableData) {
    const totalColumns = table.columns.length
    const newColumn = Math.min(
      totalColumns - 1,
      table.getCellBoundaries(this.to.row, this.to.cell).to + 1
    )
    return new TableSelection({
      row: this.to.row,
      cell: newColumn,
    }).explode(table)
  }

  moveLeft(table: TableData) {
    const row = this.to.row
    const from = table.getCellBoundaries(row, this.to.cell).from
    const newColumn = Math.max(0, from - 1)
    return new TableSelection({ row: this.to.row, cell: newColumn }).explode(
      table
    )
  }

  moveUp(table: TableData) {
    const newRow = Math.max(0, this.to.row - 1)
    return new TableSelection({ row: newRow, cell: this.to.cell }).explode(
      table
    )
  }

  moveDown(table: TableData) {
    const totalRows: number = table.rows.length
    const newRow = Math.min(totalRows - 1, this.to.row + 1)
    const cell = table.getCellBoundaries(this.to.row, this.to.cell).from
    return new TableSelection({ row: newRow, cell }).explode(table)
  }

  moveNext(table: TableData) {
    const totalRows = table.rows.length
    const totalColumns = table.columns.length
    const { row, cell } = this.to
    const boundaries = table.getCellBoundaries(row, cell)
    if (boundaries.to === totalColumns - 1 && row === totalRows - 1) {
      return new TableSelection(this.to).explode(table)
    }
    if (boundaries.to === totalColumns - 1) {
      return new TableSelection({ row: row + 1, cell: 0 }).explode(table)
    }
    return new TableSelection({ row, cell: boundaries.to + 1 }).explode(table)
  }

  movePrevious(table: TableData) {
    const totalColumns = table.columns.length
    const { row, cell } = this.to
    const boundaries = table.getCellBoundaries(row, cell)
    if (boundaries.from === 0 && this.to.row === 0) {
      return new TableSelection(this.to).explode(table)
    }
    if (boundaries.from === 0) {
      return new TableSelection({
        row: this.to.row - 1,
        cell: totalColumns - 1,
      }).explode(table)
    }
    return new TableSelection({
      row: this.to.row,
      cell: boundaries.from - 1,
    })
  }

  extendRight(table: TableData) {
    const totalColumns = table.columns.length
    const { minY, maxY } = this.normalized()
    let newColumn = this.to.cell
    for (let row = minY; row <= maxY; ++row) {
      const boundary = table.getCellBoundaries(row, this.to.cell).to + 1
      newColumn = Math.max(newColumn, boundary)
    }
    newColumn = Math.min(totalColumns - 1, newColumn)
    return new TableSelection(
      { row: this.from.row, cell: this.from.cell },
      { row: this.to.row, cell: newColumn }
    ).explode(table)
  }

  extendLeft(table: TableData) {
    const { minY, maxY } = this.normalized()
    let newColumn = this.to.cell
    for (let row = minY; row <= maxY; ++row) {
      const boundary = table.getCellBoundaries(row, this.to.cell).from - 1
      newColumn = Math.min(newColumn, boundary)
    }
    newColumn = Math.max(0, newColumn)
    return new TableSelection(
      { row: this.from.row, cell: this.from.cell },
      { row: this.to.row, cell: newColumn }
    ).explode(table)
  }

  extendUp(table: TableData) {
    const newRow = Math.max(0, this.to.row - 1)
    return new TableSelection(
      { row: this.from.row, cell: this.from.cell },
      { row: newRow, cell: this.to.cell }
    ).explode(table)
  }

  extendDown(table: TableData) {
    const totalRows = table.rows.length
    const newRow = Math.min(totalRows - 1, this.to.row + 1)
    return new TableSelection(
      { row: this.from.row, cell: this.from.cell },
      { row: newRow, cell: this.to.cell }
    ).explode(table)
  }

  spansEntireTable(table: TableData) {
    const totalRows = table.rows.length
    const totalColumns = table.columns.length
    const { minX, maxX, minY, maxY } = this.normalized()
    return (
      minX === 0 &&
      maxX === totalColumns - 1 &&
      minY === 0 &&
      maxY === totalRows - 1
    )
  }

  isMergedCellSelected(table: TableData) {
    if (this.from.row !== this.to.row) {
      return false
    }
    const boundariesFrom = table.getCellBoundaries(
      this.from.row,
      this.from.cell
    )
    const boundariesTo = table.getCellBoundaries(this.to.row, this.to.cell)
    if (boundariesFrom.from !== boundariesTo.from) {
      // boundaries are for two different cells, so it's not a merged cell
      return false
    }
    const cellData = table.getCell(this.from.row, boundariesFrom.from)
    return cellData && Boolean(cellData.multiColumn)
  }

  isMergeableCells(table: TableData) {
    const { minX, maxX, minY, maxY } = this.normalized()
    if (minY !== maxY) {
      return false
    }
    if (minX === maxX) {
      return false
    }
    for (let cell = minX; cell <= maxX; ++cell) {
      const cellData = table.getCell(this.from.row, cell)
      if (cellData.multiColumn) {
        return false
      }
    }
    return true
  }

  isOnlyFixedWidthColumns(table: TableData) {
    const { minX, maxX } = this.normalized()
    for (let cell = minX; cell <= maxX; ++cell) {
      if (!this.isColumnSelected(cell, table)) {
        return false
      }
      if (!table.columns[cell].isParagraphColumn) {
        return false
      }
    }
    return true
  }

  isOnlyParagraphCells(table: TableData) {
    const { minX, maxX } = this.normalized()
    for (let cell = minX; cell <= maxX; ++cell) {
      if (!table.columns[cell].isParagraphColumn) {
        return false
      }
    }
    return true
  }

  isOnlyNonFixedWidthColumns(table: TableData) {
    const { minX, maxX } = this.normalized()
    for (let cell = minX; cell <= maxX; ++cell) {
      if (!this.isColumnSelected(cell, table)) {
        return false
      }
      if (table.columns[cell].isParagraphColumn) {
        return false
      }
    }
    return true
  }

  width() {
    const { minX, maxX } = this.normalized()
    return maxX - minX + 1
  }

  height() {
    const { minY, maxY } = this.normalized()
    return maxY - minY + 1
  }

  maximumCellWidth(table: TableData) {
    const { minX, maxX, minY, maxY } = this.normalized()
    let maxWidth = 1
    for (let row = minY; row <= maxY; ++row) {
      const start = table.getCellIndex(row, minX)
      const end = table.getCellIndex(row, maxX)
      maxWidth = Math.max(maxWidth, end - start + 1)
    }
    return maxWidth
  }
}

const SelectionContext = createContext<
  | {
      selection: TableSelection | null
      setSelection: Dispatch<SetStateAction<TableSelection | null>>
      dragging: boolean
      setDragging: Dispatch<SetStateAction<boolean>>
    }
  | undefined
>(undefined)

export const useSelectionContext = () => {
  const context = useContext(SelectionContext)

  if (context === undefined) {
    throw new Error(
      'useSelectionContext is only available inside SelectionContext.Provider'
    )
  }

  return context
}

export const SelectionContextProvider: FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [selection, setSelection] = useState<TableSelection | null>(null)
  const [dragging, setDragging] = useState(false)
  return (
    <SelectionContext.Provider
      value={{ selection, setSelection, dragging, setDragging }}
    >
      {children}
    </SelectionContext.Provider>
  )
}
