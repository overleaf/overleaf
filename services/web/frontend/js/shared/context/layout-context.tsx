import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useEffect,
  Dispatch,
  SetStateAction,
  FC,
  useState,
} from 'react'
import useDetachLayout from '../hooks/use-detach-layout'
import localStorage from '../../infrastructure/local-storage'
import getMeta from '../../utils/meta'
import { DetachRole } from './detach-context'
import { debugConsole } from '@/utils/debugging'
import { BinaryFile } from '@/features/file-view/types/binary-file'
import useScopeEventEmitter from '@/shared/hooks/use-scope-event-emitter'
import useEventListener from '@/shared/hooks/use-event-listener'
import { isMac } from '@/shared/utils/os'
import { sendSearchEvent } from '@/features/event-tracking/search-events'
import { useRailContext } from '@/features/ide-redesign/contexts/rail-context'
import usePersistedState from '@/shared/hooks/use-persisted-state'

export type IdeLayout = 'sideBySide' | 'flat'
export type IdeView = 'editor' | 'file' | 'pdf' | 'history'

export type LayoutContextValue = {
  reattach: () => void
  detach: () => void
  detachIsLinked: boolean
  detachRole: DetachRole
  changeLayout: (newLayout: IdeLayout, newView?: IdeView) => void
  view: IdeView | null
  setView: (view: IdeView | null) => void
  chatIsOpen: boolean
  setChatIsOpen: Dispatch<SetStateAction<LayoutContextValue['chatIsOpen']>>
  reviewPanelOpen: boolean
  setReviewPanelOpen: Dispatch<
    SetStateAction<LayoutContextValue['reviewPanelOpen']>
  >
  miniReviewPanelVisible: boolean
  setMiniReviewPanelVisible: Dispatch<
    SetStateAction<LayoutContextValue['miniReviewPanelVisible']>
  >
  leftMenuShown: boolean
  setLeftMenuShown: Dispatch<
    SetStateAction<LayoutContextValue['leftMenuShown']>
  >
  loadingStyleSheet: boolean
  setLoadingStyleSheet: Dispatch<
    SetStateAction<LayoutContextValue['loadingStyleSheet']>
  >
  pdfLayout: IdeLayout
  pdfPreviewOpen: boolean
  projectSearchIsOpen: boolean
  setProjectSearchIsOpen: Dispatch<SetStateAction<boolean>>
  openFile: BinaryFile | null
  setOpenFile: Dispatch<SetStateAction<BinaryFile | null>>
}

const debugPdfDetach = getMeta('ol-debugPdfDetach')

export const LayoutContext = createContext<LayoutContextValue | undefined>(
  undefined
)

function setLayoutInLocalStorage(pdfLayout: IdeLayout) {
  localStorage.setItem(
    'pdf.layout',
    pdfLayout === 'sideBySide' ? 'split' : 'flat'
  )
}

const reviewPanelStorageKey = `ui.reviewPanelOpen.${getMeta('ol-project_id')}`

export const LayoutProvider: FC<React.PropsWithChildren> = ({ children }) => {
  // what to show in the "flat" view (editor or pdf)
  const [view, _setView] = useState<IdeView | null>('editor')
  const [openFile, setOpenFile] = useState<BinaryFile | null>(null)
  const historyToggleEmitter = useScopeEventEmitter('history:toggle', true)
  const { isOpen: railIsOpen, setIsOpen: setRailIsOpen } = useRailContext()
  const [prevRailIsOpen, setPrevRailIsOpen] = useState(railIsOpen)

  const setView = useCallback(
    (value: IdeView | null) => {
      _setView(oldValue => {
        // ensure that the "history:toggle" event is broadcast when switching in or out of history view
        if (value === 'history' || oldValue === 'history') {
          historyToggleEmitter()
        }

        if (value === 'history') {
          setPrevRailIsOpen(railIsOpen)
          setRailIsOpen(true)
        }

        if (oldValue === 'history') {
          setRailIsOpen(prevRailIsOpen)
        }

        if (value === 'editor' && openFile) {
          // if a file is currently opened, ensure the view is 'file' instead of
          // 'editor' when the 'editor' view is requested. This is to ensure
          // that the entity selected in the file tree is the one visible and
          // that docs don't take precedence over files.
          return 'file'
        }

        return value
      })
    },
    [
      _setView,
      setRailIsOpen,
      openFile,
      historyToggleEmitter,
      prevRailIsOpen,
      setPrevRailIsOpen,
      railIsOpen,
    ]
  )

  // whether the chat pane is open
  const [chatIsOpen, setChatIsOpen] = usePersistedState<boolean>(
    'ui.chatOpen',
    false
  )

  // whether the review pane is open
  const [reviewPanelOpen, setReviewPanelOpen] = usePersistedState<boolean>(
    reviewPanelStorageKey,
    false
  )

  // whether the review pane is collapsed
  const [miniReviewPanelVisible, setMiniReviewPanelVisible] =
    useState<boolean>(false)

  // whether the menu pane is open
  const [leftMenuShown, setLeftMenuShown] = useState<boolean>(false)

  // whether the project search is open
  const [projectSearchIsOpen, setProjectSearchIsOpen] = useState(false)

  useEventListener(
    'ui.toggle-left-menu',
    useCallback(
      (event: CustomEvent<boolean>) => {
        setLeftMenuShown(event.detail)
      },
      [setLeftMenuShown]
    )
  )

  // TODO ide-redesign-cleanup: remove this listener as we have an equivalent in rail-context
  useEventListener(
    'ui.toggle-review-panel',
    useCallback(() => {
      setReviewPanelOpen(open => !open)
    }, [setReviewPanelOpen])
  )

  // TODO ide-redesign-cleanup: remove this listener as we have an equivalent in rail-context
  useEventListener(
    'keydown',
    useCallback((event: KeyboardEvent) => {
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
        setProjectSearchIsOpen(true)
      }
    }, [])
  )

  // whether to display the editor and preview side-by-side or full-width ("flat")
  const [pdfLayout, setPdfLayout] = useState<IdeLayout>('sideBySide')

  // whether stylesheet on theme is loading
  const [loadingStyleSheet, setLoadingStyleSheet] = useState(false)

  const changeLayout = useCallback(
    (newLayout: IdeLayout, newView: IdeView = 'editor') => {
      setPdfLayout(newLayout)
      setView(newLayout === 'sideBySide' ? 'editor' : newView)
      setLayoutInLocalStorage(newLayout)
    },
    [setPdfLayout, setView]
  )

  const {
    reattach,
    detach,
    isLinking: detachIsLinking,
    isLinked: detachIsLinked,
    role: detachRole,
    isRedundant: detachIsRedundant,
  } = useDetachLayout()

  const pdfPreviewOpen =
    pdfLayout === 'sideBySide' || view === 'pdf' || detachRole === 'detacher'

  useEffect(() => {
    if (debugPdfDetach) {
      debugConsole.warn('Layout Effect', {
        detachIsRedundant,
        detachRole,
        detachIsLinking,
        detachIsLinked,
      })
    }

    if (detachRole !== 'detacher') return // not in a PDF detacher layout

    if (detachIsRedundant) {
      changeLayout('sideBySide')
      return
    }

    if (detachIsLinking || detachIsLinked) {
      // the tab is linked to a detached tab (or about to be linked); show
      // editor only
      changeLayout('flat', 'editor')
    }
  }, [
    detachIsRedundant,
    detachRole,
    detachIsLinking,
    detachIsLinked,
    changeLayout,
  ])

  const value = useMemo<LayoutContextValue>(
    () => ({
      reattach,
      detach,
      detachIsLinked,
      detachRole,
      changeLayout,
      chatIsOpen,
      leftMenuShown,
      openFile,
      pdfLayout,
      pdfPreviewOpen,
      projectSearchIsOpen,
      setProjectSearchIsOpen,
      reviewPanelOpen,
      miniReviewPanelVisible,
      loadingStyleSheet,
      setChatIsOpen,
      setLeftMenuShown,
      setOpenFile,
      setPdfLayout,
      setReviewPanelOpen,
      setMiniReviewPanelVisible,
      setLoadingStyleSheet,
      setView,
      view,
    }),
    [
      reattach,
      detach,
      detachIsLinked,
      detachRole,
      changeLayout,
      chatIsOpen,
      leftMenuShown,
      openFile,
      pdfLayout,
      pdfPreviewOpen,
      projectSearchIsOpen,
      setProjectSearchIsOpen,
      reviewPanelOpen,
      miniReviewPanelVisible,
      loadingStyleSheet,
      setChatIsOpen,
      setLeftMenuShown,
      setOpenFile,
      setPdfLayout,
      setReviewPanelOpen,
      setMiniReviewPanelVisible,
      setLoadingStyleSheet,
      setView,
      view,
    ]
  )

  return (
    <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>
  )
}

export function useLayoutContext() {
  const context = useContext(LayoutContext)
  if (!context) {
    throw new Error('useLayoutContext is only available inside LayoutProvider')
  }
  return context
}
