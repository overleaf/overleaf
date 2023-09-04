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
    }
  | undefined
>(undefined)

export const TabularProvider: FC = ({ children }) => {
  const ref = useRef<HTMLDivElement>(null)
  const [helpShown, setHelpShown] = useState(false)
  const showHelp = useCallback(() => setHelpShown(true), [])
  const hideHelp = useCallback(() => setHelpShown(false), [])
  return (
    <TabularContext.Provider value={{ ref, helpShown, showHelp, hideHelp }}>
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
