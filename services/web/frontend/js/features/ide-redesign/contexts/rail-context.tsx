import useCollapsiblePanel from '@/features/ide-react/hooks/use-collapsible-panel'
import {
  createContext,
  Dispatch,
  FC,
  SetStateAction,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'
import { ImperativePanelHandle } from 'react-resizable-panels'

export type RailTabKey =
  | 'file-tree'
  | 'integrations'
  | 'review-panel'
  | 'chat'
  | 'errors'

const RailContext = createContext<
  | {
      selectedTab: RailTabKey
      setSelectedTab: Dispatch<SetStateAction<RailTabKey>>
      isOpen: boolean
      setIsOpen: Dispatch<SetStateAction<boolean>>
      panelRef: React.RefObject<ImperativePanelHandle>
      togglePane: () => void
      handlePaneExpand: () => void
      handlePaneCollapse: () => void
      resizing: boolean
      setResizing: Dispatch<SetStateAction<boolean>>
    }
  | undefined
>(undefined)

export const RailProvider: FC = ({ children }) => {
  const [isOpen, setIsOpen] = useState(true)
  const [resizing, setResizing] = useState(false)
  const panelRef = useRef<ImperativePanelHandle>(null)
  useCollapsiblePanel(isOpen, panelRef)

  const togglePane = useCallback(() => {
    setIsOpen(value => !value)
  }, [])

  const handlePaneExpand = useCallback(() => {
    setIsOpen(true)
  }, [])

  const handlePaneCollapse = useCallback(() => {
    setIsOpen(false)
  }, [])

  // NOTE: The file tree **MUST** be the first tab to be opened
  //       since it is responsible for opening the initial document.
  const [selectedTab, setSelectedTab] = useState<RailTabKey>('file-tree')

  const value = useMemo(
    () => ({
      selectedTab,
      setSelectedTab,
      isOpen,
      setIsOpen,
      panelRef,
      togglePane,
      handlePaneExpand,
      handlePaneCollapse,
      resizing,
      setResizing,
    }),
    [
      selectedTab,
      setSelectedTab,
      isOpen,
      setIsOpen,
      panelRef,
      togglePane,
      handlePaneExpand,
      handlePaneCollapse,
      resizing,
      setResizing,
    ]
  )

  return <RailContext.Provider value={value}>{children}</RailContext.Provider>
}

export const useRailContext = () => {
  const context = useContext(RailContext)
  if (!context) {
    throw new Error('useRailContext is only available inside RailProvider')
  }
  return context
}
