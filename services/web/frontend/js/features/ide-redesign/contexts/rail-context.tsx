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

export type RailModalKey = 'keyboard-shortcuts' | 'contact-us' | 'dictionary'

const RailContext = createContext<
  | {
      selectedTab: RailTabKey
      isOpen: boolean
      setIsOpen: Dispatch<SetStateAction<boolean>>
      panelRef: React.RefObject<ImperativePanelHandle>
      togglePane: () => void
      handlePaneExpand: () => void
      handlePaneCollapse: () => void
      resizing: boolean
      setResizing: Dispatch<SetStateAction<boolean>>
      activeModal: RailModalKey | null
      setActiveModal: Dispatch<SetStateAction<RailModalKey | null>>
      openTab: (tab: RailTabKey) => void
    }
  | undefined
>(undefined)

export const RailProvider: FC = ({ children }) => {
  const [isOpen, setIsOpen] = useState(true)
  const [resizing, setResizing] = useState(false)
  const [activeModal, setActiveModalInternal] = useState<RailModalKey | null>(
    null
  )
  const setActiveModal: Dispatch<SetStateAction<RailModalKey | null>> =
    useCallback(modalKey => {
      setActiveModalInternal(modalKey)
    }, [])

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

  const openTab = useCallback(
    (tab: RailTabKey) => {
      setSelectedTab(tab)
      setIsOpen(true)
    },
    [setIsOpen, setSelectedTab]
  )

  const value = useMemo(
    () => ({
      selectedTab,
      isOpen,
      setIsOpen,
      panelRef,
      togglePane,
      handlePaneExpand,
      handlePaneCollapse,
      resizing,
      setResizing,
      activeModal,
      setActiveModal,
      openTab,
    }),
    [
      selectedTab,
      isOpen,
      setIsOpen,
      panelRef,
      togglePane,
      handlePaneExpand,
      handlePaneCollapse,
      resizing,
      setResizing,
      activeModal,
      setActiveModal,
      openTab,
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
