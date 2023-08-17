import {
  Dispatch,
  FC,
  SetStateAction,
  createContext,
  useContext,
  useState,
} from 'react'

type TableCoordinate = {
  row: number
  cell: number
}

export class TableSelection {
  public readonly from: TableCoordinate
  public readonly to: TableCoordinate

  constructor(from: TableCoordinate, to?: TableCoordinate) {
    this.from = from
    this.to = to ?? from
  }

  contains(point: TableCoordinate) {
    const { minX, maxX, minY, maxY } = this.normalized()

    return (
      point.cell >= minX &&
      point.cell <= maxX &&
      point.row >= minY &&
      point.row <= maxY
    )
  }

  normalized() {
    const minX = Math.min(this.from.cell, this.to.cell)
    const maxX = Math.max(this.from.cell, this.to.cell)
    const minY = Math.min(this.from.row, this.to.row)
    const maxY = Math.max(this.from.row, this.to.row)

    return { minX, maxX, minY, maxY }
  }

  bordersLeft(x: number) {
    const { minX } = this.normalized()
    return minX === x
  }

  bordersRight(x: number) {
    const { maxX } = this.normalized()
    return maxX === x
  }

  bordersTop(y: number) {
    const { minY } = this.normalized()
    return minY === y
  }

  bordersBottom(y: number) {
    const { maxY } = this.normalized()
    return maxY === y
  }

  isRowSelected(row: number, totalColumns: number) {
    const { minX, maxX, minY, maxY } = this.normalized()
    return row >= minY && row <= maxY && minX === 0 && maxX === totalColumns - 1
  }

  isAnyRowSelected(totalColumns: number) {
    const { minX, maxX } = this.normalized()
    return minX === 0 && maxX === totalColumns - 1
  }

  isAnyColumnSelected(totalRows: number) {
    const { minY, maxY } = this.normalized()
    return minY === 0 && maxY === totalRows - 1
  }

  isColumnSelected(cell: number, totalRows: number) {
    const { minX, maxX, minY, maxY } = this.normalized()
    return cell >= minX && cell <= maxX && minY === 0 && maxY === totalRows - 1
  }

  moveRight(totalColumns: number) {
    const newColumn = Math.min(totalColumns - 1, this.to.cell + 1)
    return new TableSelection({ row: this.to.row, cell: newColumn })
  }

  moveLeft() {
    const newColumn = Math.max(0, this.to.cell - 1)
    return new TableSelection({ row: this.to.row, cell: newColumn })
  }

  moveUp() {
    const newRow = Math.max(0, this.to.row - 1)
    return new TableSelection({ row: newRow, cell: this.to.cell })
  }

  moveDown(totalRows: number) {
    const newRow = Math.min(totalRows - 1, this.to.row + 1)
    return new TableSelection({ row: newRow, cell: this.to.cell })
  }

  moveNext(totalColumns: number, totalRows: number) {
    const { row, cell } = this.to
    if (cell === totalColumns - 1 && row === totalRows - 1) {
      return new TableSelection(this.to)
    }
    if (cell === totalColumns - 1) {
      return new TableSelection({ row: row + 1, cell: 0 })
    }
    return new TableSelection({ row, cell: cell + 1 })
  }

  movePrevious(totalColumns: number) {
    if (this.to.cell === 0 && this.to.row === 0) {
      return new TableSelection(this.to)
    }
    if (this.to.cell === 0) {
      return new TableSelection({
        row: this.to.row - 1,
        cell: totalColumns - 1,
      })
    }
    return new TableSelection({ row: this.to.row, cell: this.to.cell - 1 })
  }

  extendRight(totalColumns: number) {
    const newColumn = Math.min(totalColumns - 1, this.to.cell + 1)
    return new TableSelection(
      { row: this.from.row, cell: this.from.cell },
      { row: this.to.row, cell: newColumn }
    )
  }

  extendLeft() {
    const newColumn = Math.max(0, this.to.cell - 1)
    return new TableSelection(
      { row: this.from.row, cell: this.from.cell },
      { row: this.to.row, cell: newColumn }
    )
  }

  extendUp() {
    const newRow = Math.max(0, this.to.row - 1)
    return new TableSelection(
      { row: this.from.row, cell: this.from.cell },
      { row: newRow, cell: this.to.cell }
    )
  }

  extendDown(totalRows: number) {
    const newRow = Math.min(totalRows - 1, this.to.row + 1)
    return new TableSelection(
      { row: this.from.row, cell: this.from.cell },
      { row: newRow, cell: this.to.cell }
    )
  }

  spansEntireTable(totalColumns: number, totalRows: number) {
    const { minX, maxX, minY, maxY } = this.normalized()
    return (
      minX === 0 &&
      maxX === totalColumns - 1 &&
      minY === 0 &&
      maxY === totalRows - 1
    )
  }

  width() {
    const { minX, maxX } = this.normalized()
    return maxX - minX + 1
  }

  height() {
    const { minY, maxY } = this.normalized()
    return maxY - minY + 1
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

export const SelectionContextProvider: FC = ({ children }) => {
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
