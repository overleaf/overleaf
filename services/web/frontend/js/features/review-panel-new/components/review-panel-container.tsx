import ReactDOM from 'react-dom'
import { useCodeMirrorViewContext } from '../../source-editor/components/codemirror-context'
import { memo } from 'react'
import ReviewPanel from './review-panel'
import TrackChangesOnWidget from './track-changes-on-widget'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import ReviewModeSwitcher from './review-mode-switcher'
import getMeta from '@/utils/meta'
import useReviewPanelLayout from '../hooks/use-review-panel-layout'

function ReviewPanelContainer() {
  const view = useCodeMirrorViewContext()
  const { showPanel, mini } = useReviewPanelLayout()
  const { wantTrackChanges } = useEditorManagerContext()
  const enableReviewerRole = getMeta('ol-isReviewerRoleEnabled')

  if (!view) {
    return null
  }

  const showTrackChangesWidget = !enableReviewerRole && wantTrackChanges && mini

  return ReactDOM.createPortal(
    <>
      {showTrackChangesWidget && <TrackChangesOnWidget />}
      {enableReviewerRole && <ReviewModeSwitcher />}
      {showPanel && <ReviewPanel mini={mini} />}
    </>,
    view.scrollDOM
  )
}

export default memo(ReviewPanelContainer)
