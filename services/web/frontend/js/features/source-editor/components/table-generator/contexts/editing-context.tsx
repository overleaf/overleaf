import { FC, createContext, useCallback, useContext, useState } from 'react'
import { useCodeMirrorViewContext } from '../../codemirror-editor'
import { useTableContext } from './table-context'

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
      startEditing: (
        rowIndex: number,
        cellIndex: number,
        content: string
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
  const { cellPositions } = useTableContext()
  const [cellData, setCellData] = useState<EditingContextData | null>(null)
  const view = useCodeMirrorViewContext()
  const write = useCallback(
    (rowIndex: number, cellIndex: number, content: string) => {
      const { from, to } = cellPositions[rowIndex][cellIndex]
      view.dispatch({
        changes: { from, to, insert: content },
      })
      setCellData(null)
    },
    [view, cellPositions]
  )

  const commitCellData = useCallback(() => {
    if (!cellData) {
      return
    }
    if (!cellData.dirty) {
      setCellData(null)
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
    (rowIndex: number, cellIndex: number, content: string) => {
      if (cellData?.dirty) {
        // We're already editing something else
        commitCellData()
      }
      setCellData({ cellIndex, rowIndex, content, dirty: false })
    },
    [setCellData, cellData, commitCellData]
  )

  const updateCellData = useCallback(
    (content: string) => {
      setCellData(prev => prev && { ...prev, content, dirty: true })
    },
    [setCellData]
  )
  return (
    <EditingContext.Provider
      value={{
        cellData,
        updateCellData,
        cancelEditing,
        commitCellData,
        startEditing,
      }}
    >
      {children}
    </EditingContext.Provider>
  )
}
