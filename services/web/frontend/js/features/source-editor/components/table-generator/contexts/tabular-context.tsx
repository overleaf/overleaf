import {
  FC,
  RefObject,
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react'

const TabularContext = createContext<
  | {
      ref: RefObject<HTMLDivElement>
      showHelp: () => void
      hideHelp: () => void
      helpShown: boolean
      columnWidthModalShown: boolean
      openColumnWidthModal: () => void
      closeColumnWidthModal: () => void
    }
  | undefined
>(undefined)

export const TabularProvider: FC<React.PropsWithChildren> = ({ children }) => {
  const ref = useRef<HTMLDivElement>(null)
  const [helpShown, setHelpShown] = useState(false)
  const [columnWidthModalShown, setColumnWidthModalShown] = useState(false)
  const showHelp = useCallback(() => setHelpShown(true), [])
  const hideHelp = useCallback(() => setHelpShown(false), [])
  const openColumnWidthModal = useCallback(
    () => setColumnWidthModalShown(true),
    []
  )
  const closeColumnWidthModal = useCallback(
    () => setColumnWidthModalShown(false),
    []
  )
  return (
    <TabularContext.Provider
      value={{
        ref,
        helpShown,
        showHelp,
        hideHelp,
        columnWidthModalShown,
        openColumnWidthModal,
        closeColumnWidthModal,
      }}
    >
      {children}
    </TabularContext.Provider>
  )
}

export const useTabularContext = () => {
  const tabularContext = useContext(TabularContext)
  if (!tabularContext) {
    throw new Error('TabularContext must be used within TabularProvider')
  }
  return tabularContext
}
