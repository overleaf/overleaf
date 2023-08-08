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
  // eslint-disable-next-line no-useless-constructor
  constructor(public from: TableCoordinate, public to: TableCoordinate) {}
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

  isColumnSelected(cell: number, totalRows: number) {
    const { minX, maxX, minY, maxY } = this.normalized()
    return cell >= minX && cell <= maxX && minY === 0 && maxY === totalRows - 1
  }
}

const SelectionContext = createContext<
  | {
      selection: TableSelection | null
      setSelection: Dispatch<SetStateAction<TableSelection | null>>
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
  return (
    <SelectionContext.Provider value={{ selection, setSelection }}>
      {children}
    </SelectionContext.Provider>
  )
}
