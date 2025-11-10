import { sendSearchEvent } from '@/features/event-tracking/search-events'
import { useProjectContext } from '@/shared/context/project-context'
import useEventListener from '@/shared/hooks/use-event-listener'
import usePersistedState from '@/shared/hooks/use-persisted-state'
import { isMac } from '@/shared/utils/os'
import {
  createContext,
  Dispatch,
  FC,
  SetStateAction,
  useCallback,
  useContext,
  useLayoutEffect,
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
  | 'full-project-search'
  | 'workbench'

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

export const RailProvider: FC<React.PropsWithChildren> = ({ children }) => {
  const { projectId } = useProjectContext()
  const [isOpen, setIsOpen] = usePersistedState(
    `rail-is-open-${projectId}`,
    true
  )
  const [resizing, setResizing] = useState(false)
  const [activeModal, setActiveModalInternal] = useState<RailModalKey | null>(
    null
  )
  const setActiveModal: Dispatch<SetStateAction<RailModalKey | null>> =
    useCallback(modalKey => {
      setActiveModalInternal(modalKey)
    }, [])

  const panelRef = useRef<ImperativePanelHandle>(null)

  const togglePane = useCallback(() => {
    setIsOpen(value => !value)
  }, [setIsOpen])

  const handlePaneExpand = useCallback(() => {
    setIsOpen(true)
  }, [setIsOpen])

  const handlePaneCollapse = useCallback(() => {
    setIsOpen(false)
  }, [setIsOpen])

  const [selectedTab, setSelectedTab] = usePersistedState<RailTabKey>(
    `selected-rail-tab-${projectId}`,
    'file-tree'
  )

  // Keep the panel collapse/expanded state in sync with isOpen and selectedTab
  useLayoutEffect(() => {
    const panelHandle = panelRef.current

    if (panelHandle) {
      if (isOpen) {
        panelHandle.expand()
      } else {
        panelHandle.collapse()
      }
    }
  }, [isOpen, selectedTab])

  const openTab = useCallback(
    (tab: RailTabKey) => {
      setSelectedTab(tab)
      setIsOpen(true)
    },
    [setIsOpen, setSelectedTab]
  )

  useEventListener(
    'ui.toggle-review-panel',
    useCallback(() => {
      if (isOpen && selectedTab === 'review-panel') {
        handlePaneCollapse()
      } else {
        openTab('review-panel')
      }
    }, [handlePaneCollapse, selectedTab, isOpen, openTab])
  )

  useEventListener(
    'keydown',
    useCallback(
      (event: KeyboardEvent) => {
        if (
          (isMac ? event.metaKey : event.ctrlKey) &&
          event.shiftKey &&
          event.code === 'KeyF'
        ) {
          event.preventDefault()
          sendSearchEvent('search-open', {
            searchType: 'full-project',
            method: 'keyboard',
          })
          openTab('full-project-search')
        }
      },
      [openTab]
    )
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
