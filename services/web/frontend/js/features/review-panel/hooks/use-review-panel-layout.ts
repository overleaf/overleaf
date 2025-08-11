import { useLayoutContext } from '@/shared/context/layout-context'
import { useRangesContext } from '../context/ranges-context'
import { useThreadsContext } from '@/features/review-panel/context/threads-context'
import { hasActiveRange } from '@/features/review-panel/utils/has-active-range'
import { useRailContext } from '@/features/ide-redesign/contexts/rail-context'
import { useIsNewEditorEnabled } from '@/features/ide-redesign/utils/new-editor-utils'
import { useCallback } from 'react'

export default function useReviewPanelLayout(): {
  showPanel: boolean
  showHeader: boolean
  mini: boolean
  openReviewPanel: () => void
  closeReviewPanel: () => void
} {
  const ranges = useRangesContext()
  const threads = useThreadsContext()
  const {
    selectedTab: selectedRailTab,
    isOpen: railIsOpen,
    openTab: openRailTab,
    setIsOpen: setRailIsOpen,
  } = useRailContext()
  const { reviewPanelOpen: reviewPanelOpenOldEditor, setReviewPanelOpen } =
    useLayoutContext()

  const newEditor = useIsNewEditorEnabled()

  const reviewPanelOpen = newEditor
    ? selectedRailTab === 'review-panel' && railIsOpen
    : reviewPanelOpenOldEditor

  const openReviewPanel = useCallback(() => {
    if (newEditor) {
      openRailTab('review-panel')
    } else {
      setReviewPanelOpen(true)
    }
  }, [newEditor, setReviewPanelOpen, openRailTab])

  const closeReviewPanel = useCallback(() => {
    if (newEditor) {
      setRailIsOpen(false)
    } else {
      setReviewPanelOpen(false)
    }
  }, [newEditor, setReviewPanelOpen, setRailIsOpen])

  const hasCommentOrChange = hasActiveRange(ranges, threads)
  const showPanel = reviewPanelOpen || !!hasCommentOrChange
  const mini = !reviewPanelOpen
  const showHeader = showPanel && !mini

  return { showPanel, showHeader, mini, openReviewPanel, closeReviewPanel }
}
