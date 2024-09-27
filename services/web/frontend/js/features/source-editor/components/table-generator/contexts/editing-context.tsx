import { FC, createContext, useCallback, useContext, useState } from 'react'
import { useCodeMirrorViewContext } from '../../codemirror-context'
import { useTableContext } from './table-context'
import { TableSelection } from './selection-context'
import { debugConsole } from '@/utils/debugging'

type EditingContextData = {
  rowIndex: number
  cellIndex: number
  content: string
  dirty: boolean
}

const EditingContext = createContext<
  | {
      cellData: EditingContextData | null
      updateCellData: (content: string) => void
      cancelEditing: () => void
      commitCellData: () => void
      clearCells: (selection: TableSelection) => void
      startEditing: (
        rowIndex: number,
        cellIndex: number,
        initialContent?: string
      ) => void
    }
  | undefined
>(undefined)

export const useEditingContext = () => {
  const context = useContext(EditingContext)
  if (context === undefined) {
    throw new Error(
      'useEditingContext is only available inside EditingContext.Provider'
    )
  }

  return context
}

export const EditingContextProvider: FC = ({ children }) => {
  const { table } = useTableContext()
  const [cellData, setCellData] = useState<EditingContextData | null>(null)
  const [initialContent, setInitialContent] = useState<string | undefined>(
    undefined
  )
  const view = useCodeMirrorViewContext()
  const write = useCallback(
    (rowIndex: number, cellIndex: number, content: string) => {
      const { from, to } = table.getCell(rowIndex, cellIndex)
      const currentText = view.state.sliceDoc(from, to)
      if (currentText !== initialContent && initialContent !== undefined) {
        // The cell has changed since we started editing, so we don't want to overwrite it
        debugConsole.error(
          'Cell has changed since editing started, not overwriting'
        )
        return
      }
      setInitialContent(undefined)
      view.dispatch({
        changes: { from, to, insert: content },
      })
      view.requestMeasure()
      setCellData(null)
    },
    [view, table, initialContent]
  )

  const commitCellData = useCallback(() => {
    if (!cellData) {
      return
    }
    if (!cellData.dirty) {
      setCellData(null)
      setInitialContent(undefined)
      return
    }
    const { rowIndex, cellIndex, content } = cellData
    write(rowIndex, cellIndex, content)
    setCellData(null)
  }, [setCellData, cellData, write])

  const cancelEditing = useCallback(() => {
    setCellData(null)
  }, [setCellData])

  const startEditing = useCallback(
    (rowIndex: number, cellIndex: number, initialContent = undefined) => {
      if (cellData?.dirty) {
        // We're already editing something else
        commitCellData()
      }
      setInitialContent(initialContent)
      const content = table.getCell(rowIndex, cellIndex).content.trim()
      setCellData({
        cellIndex,
        rowIndex,
        content,
        dirty: false,
      })
    },
    [setCellData, cellData, commitCellData, table]
  )

  const updateCellData = useCallback(
    (content: string) => {
      setCellData(prev => prev && { ...prev, content, dirty: true })
    },
    [setCellData]
  )

  const clearCells = useCallback(
    (selection: TableSelection) => {
      const changes: { from: number; to: number; insert: '' }[] = []
      const { minX, minY, maxX, maxY } = selection.normalized()
      for (let row = minY; row <= maxY; row++) {
        for (let cell = minX; cell <= maxX; cell++) {
          const { from, to } = table.getCell(row, cell)
          changes.push({ from, to, insert: '' })
        }
      }
      view.dispatch({ changes })
    },
    [view, table]
  )

  return (
    <EditingContext.Provider
      value={{
        cellData,
        updateCellData,
        cancelEditing,
        commitCellData,
        startEditing,
        clearCells,
      }}
    >
      {children}
    </EditingContext.Provider>
  )
}
