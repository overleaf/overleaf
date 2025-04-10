import { useLayoutContext } from '@/shared/context/layout-context'
import { useRangesContext } from '../context/ranges-context'
import { useThreadsContext } from '@/features/review-panel-new/context/threads-context'
import { hasActiveRange } from '@/features/review-panel-new/utils/has-active-range'
import { useRailContext } from '@/features/ide-redesign/contexts/rail-context'
import { useIsNewEditorEnabled } from '@/features/ide-redesign/utils/new-editor-utils'

export default function useReviewPanelLayout(): {
  showPanel: boolean
  showHeader: boolean
  mini: boolean
} {
  const ranges = useRangesContext()
  const threads = useThreadsContext()
  const { selectedTab: selectedRailTab, isOpen: railIsOpen } = useRailContext()
  const { reviewPanelOpen: reviewPanelOpenOldEditor } = useLayoutContext()

  const newEditor = useIsNewEditorEnabled()

  const reviewPanelOpen = newEditor
    ? selectedRailTab === 'review-panel' && railIsOpen
    : reviewPanelOpenOldEditor

  const hasCommentOrChange = hasActiveRange(ranges, threads)
  const showPanel = reviewPanelOpen || !!hasCommentOrChange
  const mini = !reviewPanelOpen
  const showHeader = showPanel && !mini

  return { showPanel, showHeader, mini }
}
