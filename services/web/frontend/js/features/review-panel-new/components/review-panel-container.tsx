import ReactDOM from 'react-dom'
import { useCodeMirrorViewContext } from '../../source-editor/components/codemirror-context'
import { memo } from 'react'
import ReviewPanel from './review-panel'
import { useLayoutContext } from '@/shared/context/layout-context'
import { useRangesContext } from '../context/ranges-context'
import { useThreadsContext } from '@/features/review-panel-new/context/threads-context'
import { hasActiveRange } from '@/features/review-panel-new/utils/has-active-range'
import TrackChangesOnWidget from './track-changes-on-widget'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import ReviewModeSwitcher from './review-mode-switcher'
import getMeta from '@/utils/meta'

function ReviewPanelContainer() {
  const view = useCodeMirrorViewContext()
  const ranges = useRangesContext()
  const threads = useThreadsContext()
  const { reviewPanelOpen } = useLayoutContext()
  const { wantTrackChanges } = useEditorManagerContext()
  const enableReviewerRole = getMeta('ol-isReviewerRoleEnabled')

  if (!view) {
    return null
  }

  const hasCommentOrChange = hasActiveRange(ranges, threads)
  const showPanel = reviewPanelOpen || hasCommentOrChange
  const showTrackChangesWidget =
    !enableReviewerRole && wantTrackChanges && !reviewPanelOpen

  return ReactDOM.createPortal(
    <>
      {showTrackChangesWidget && <TrackChangesOnWidget />}
      {enableReviewerRole && <ReviewModeSwitcher />}
      {showPanel && <ReviewPanel mini={!reviewPanelOpen} />}
    </>,
    view.scrollDOM
  )
}

export default memo(ReviewPanelContainer)
