import ReactDOM from 'react-dom'
import { useCodeMirrorViewContext } from '../../source-editor/components/codemirror-context'
import { memo } from 'react'
import ReviewPanel from './review-panel'
import useReviewPanelLayout from '../hooks/use-review-panel-layout'

function ReviewPanelContainer() {
  const view = useCodeMirrorViewContext()
  const { showPanel, mini } = useReviewPanelLayout()

  if (!view) {
    return null
  }

  return ReactDOM.createPortal(
    <>{showPanel && <ReviewPanel mini={mini} />}</>,
    view.scrollDOM
  )
}

export default memo(ReviewPanelContainer)
