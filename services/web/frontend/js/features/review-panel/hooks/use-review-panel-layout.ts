import { useRangesContext } from '../context/ranges-context'
import { useThreadsContext } from '@/features/review-panel/context/threads-context'
import { hasActiveRange } from '@/features/review-panel/utils/has-active-range'
import { useRailContext } from '@/features/ide-react/context/rail-context'
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

  const reviewPanelOpen = selectedRailTab === 'review-panel' && railIsOpen

  const openReviewPanel = useCallback(() => {
    openRailTab('review-panel')
  }, [openRailTab])

  const closeReviewPanel = useCallback(() => {
    setRailIsOpen(false)
  }, [setRailIsOpen])

  const hasCommentOrChange = hasActiveRange(ranges, threads)
  const showPanel = reviewPanelOpen || !!hasCommentOrChange
  const mini = !reviewPanelOpen
  const showHeader = showPanel && !mini

  return { showPanel, showHeader, mini, openReviewPanel, closeReviewPanel }
}
